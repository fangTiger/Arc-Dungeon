import test from "node:test";
import assert from "node:assert/strict";

import {
  COMBAT_ROOM_DAMAGE_SHARE_CAP,
  combatRoomDamageShare,
  estimateEffectiveHp,
  estimatePlayerDps,
  typicalBuildForDepth,
} from "../apps/web/src/core/combat/balance.js";
import { createBossForDepth } from "../apps/web/src/core/combat/bosses.js";
import { PLAYER_CLASSES } from "../apps/web/src/core/combat/classes.js";
import { resolveDamage } from "../apps/web/src/core/combat/damage.js";
import { difficultyForDepth } from "../apps/web/src/core/dungeon/progression.js";
import { calculateBuildBonuses } from "../apps/web/src/core/run/upgrades.js";

const BOSS_DEPTHS = Object.freeze([5, 10, 15, 20, 25, 30]);
const BOSS_DURATION_DEPTHS = Object.freeze([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
const COMBAT_ROOM_DEPTHS = Object.freeze(Array.from({ length: 50 }, (_, index) => index + 1));
const CLASS_IDS = Object.freeze(Object.keys(PLAYER_CLASSES));
const BOSS_DAMAGE_SHARE_MIN = 0.07;
const BOSS_DAMAGE_SHARE_MAX = 0.135;
const BOSS_LETHAL_HIT_CAP = 15;
const BALANCE_SEED = "balance-regression";

test("Boss 战时长在典型 build 下保持在 25 到 58 秒", () => {
  for (const depth of BOSS_DURATION_DEPTHS) {
    const build = typicalBuildForDepth(depth);

    for (const classId of CLASS_IDS) {
      const boss = createBossForDepth({ seed: BALANCE_SEED, depth });
      const durationSeconds = boss.maxHp / estimatePlayerDps({ classId, build });

      assert.ok(
        durationSeconds >= 25 && durationSeconds <= 58,
        `${depth} 层 ${classId} Boss 战时长 ${durationSeconds.toFixed(1)} 秒超出目标`,
      );
    }
  }
});

test("Boss 单次伤害对全部职业落在有效生命的 7% 到 13.5% 且伤害随层数不减", () => {
  const previousDamages = new Map(CLASS_IDS.map((classId) => [classId, 0]));

  for (const depth of BOSS_DEPTHS) {
    const build = typicalBuildForDepth(depth);
    const boss = createBossForDepth({ seed: BALANCE_SEED, depth });

    for (const classId of CLASS_IDS) {
      const effectiveHp = estimateEffectiveHp({ classId, build });
      const share = boss.damage / effectiveHp;
      const previousDamage = previousDamages.get(classId);

      assert.ok(
        boss.damage >= previousDamage,
        `${depth} 层 ${classId} Boss 伤害数值不应低于上一档`,
      );

      assert.ok(
        share >= BOSS_DAMAGE_SHARE_MIN && share <= BOSS_DAMAGE_SHARE_MAX,
        `${depth} 层 ${classId} Boss 单次伤害占比 ${(share * 100).toFixed(1)}% 超出目标`,
      );

      previousDamages.set(classId, boss.damage);
    }
  }
});

test("Boss 对全部职业致死击数不超过 15 次", () => {
  for (const depth of BOSS_DEPTHS) {
    const build = typicalBuildForDepth(depth);
    const boss = createBossForDepth({ seed: BALANCE_SEED, depth });

    for (const classId of CLASS_IDS) {
      const effectiveHp = estimateEffectiveHp({ classId, build });
      const share = boss.damage / effectiveHp;
      const lethalHits = Math.ceil(1 / share);

      assert.ok(
        lethalHits <= BOSS_LETHAL_HIT_CAP,
        `${depth} 层 ${classId} Boss 致死击数 ${lethalHits} 次超出目标`,
      );
    }
  }
});

test("典型 build 在 10 到 50 层之间提供至少 40% 生存成长", () => {
  const shallowBuild = typicalBuildForDepth(10);
  const deepBuild = typicalBuildForDepth(50);

  for (const classId of CLASS_IDS) {
    const shallowEffectiveHp = estimateEffectiveHp({ classId, build: shallowBuild });
    const deepEffectiveHp = estimateEffectiveHp({ classId, build: deepBuild });
    const growth = deepEffectiveHp / shallowEffectiveHp - 1;

    assert.ok(
      growth >= 0.4,
      `${classId} 10 到 50 层有效生命只增长 ${(growth * 100).toFixed(1)}%`,
    );
  }
});

test("防御类强化会让实际承受伤害至少下降 6%", () => {
  const baseBuild = calculateBuildBonuses([]);
  const guardedBuild = calculateBuildBonuses(["major-iron-skin"]);

  for (const classId of CLASS_IDS) {
    const baseDamage = resolveDamageForBuild({ classId, build: baseBuild, attack: 24 });
    const guardedDamage = resolveDamageForBuild({ classId, build: guardedBuild, attack: 24 });
    const reduction = 1 - guardedDamage / baseDamage;

    assert.ok(
      reduction >= 0.06,
      `${classId} 钢铁皮肤实际减伤只有 ${(reduction * 100).toFixed(1)}%`,
    );
  }
});

test("普通敌人伤害缩放随层数递增且第 50 层至少 1.5 倍", () => {
  let previous = difficultyForDepth(1).enemyDamageScale;

  for (let depth = 2; depth <= 50; depth += 1) {
    const current = difficultyForDepth(depth).enemyDamageScale;

    assert.ok(
      current >= previous,
      `${depth} 层敌人伤害倍率 ${current} 不应低于上一层 ${previous}`,
    );
    previous = current;
  }

  assert.ok(
    difficultyForDepth(50).enemyDamageScale >= 1.5,
    `第 50 层敌人伤害倍率 ${difficultyForDepth(50).enemyDamageScale} 低于 1.5`,
  );
});

test("普通战斗房不会消耗超过典型有效生命的 52%", () => {
  for (const depth of COMBAT_ROOM_DEPTHS) {
    const build = typicalBuildForDepth(depth);

    for (const classId of CLASS_IDS) {
      const share = combatRoomDamageShare({ depth, classId, build });

      assert.ok(
        share <= COMBAT_ROOM_DAMAGE_SHARE_CAP,
        `${depth} 层 ${classId} 普通房消耗占比 ${(share * 100).toFixed(1)}% 超出目标`,
      );
    }
  }
});

test("第 1 层普通战斗房消耗落在有效生命的 12% 到 18%", () => {
  const build = typicalBuildForDepth(1);

  for (const classId of CLASS_IDS) {
    const share = combatRoomDamageShare({ depth: 1, classId, build });

    assert.ok(
      share >= 0.12 && share <= 0.18,
      `第 1 层 ${classId} 普通房消耗占比 ${(share * 100).toFixed(1)}% 超出目标`,
    );
  }
});

test("每房小怪数量在第 1、8、15 层依次为 4、5、6", async () => {
  const balance = await import("../apps/web/src/core/combat/balance.js");
  const combatLogic = await import("../apps/web/src/runtime/scenes/dungeonCombatLogic.js");
  const expectedCounts = [
    [1, 4],
    [8, 5],
    [15, 6],
  ];

  assert.equal(typeof balance.enemyCountForDepth, "function");

  for (const [depth, expectedCount] of expectedCounts) {
    assert.equal(balance.enemyCountForDepth(depth), expectedCount);
    assert.equal(combatLogic.enemyCountForDepth(depth), expectedCount);
  }
});

test("typicalBuildForDepth 随层数单调不减", () => {
  let previous = typicalBuildForDepth(1);

  for (let depth = 2; depth <= 50; depth += 1) {
    const current = typicalBuildForDepth(depth);

    assert.ok(current.minorUpgradeCount >= previous.minorUpgradeCount);
    assert.ok(current.majorUpgradeCount >= previous.majorUpgradeCount);
    assert.ok(current.damageMultiplier >= previous.damageMultiplier);
    assert.ok(current.effectiveHpMultiplier >= previous.effectiveHpMultiplier);
    assert.ok(current.effectiveUpgradeScore >= previous.effectiveUpgradeScore);

    previous = current;
  }
});

function resolveDamageForBuild({ classId, build, attack }) {
  const classDefense = PLAYER_CLASSES[classId].baseStats.defense;
  const result = resolveDamage({
    attack,
    defense: classDefense * build.defenseMultiplier,
    damageMultiplier: build.incomingDamageMultiplier,
    rng: { next: () => 1 },
  });

  return result.damage;
}
