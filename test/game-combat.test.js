import test from "node:test";
import assert from "node:assert/strict";

import {
  addExperience,
  applyDepthScaling,
  createEnemy,
  createPlayer,
  createProjectile,
  damagePlayer,
  defeatEnemy,
  ENEMY_TYPES,
  healPlayer,
  hitsCircle,
  isInvulnerable,
  isExpired,
  markProjectileHit,
  pickEnemyTypeForDepth,
  PLAYER_CLASSES,
  respawnIfDefeated,
  resolveDamage,
  startDodge,
  stepProjectile,
  triggerAttack,
  useCircularSlash,
} from "../apps/web/src/core/combat.js";
import { difficultyForDepth } from "../apps/web/src/core/dungeon/progression.js";
import { createRng } from "../apps/web/src/core/rng.js";

test("剑士普攻在连击窗口内推进到第三段且第三段更强", () => {
  let player = createPlayer();

  let result = triggerAttack(player, 100);
  assert.equal(result.attack.comboStep, 1);

  result = triggerAttack(result.player, 320);
  assert.equal(result.attack.comboStep, 2);

  result = triggerAttack(result.player, 540);
  assert.equal(result.attack.comboStep, 3);
  assert.ok(result.attack.damage > 14);
});

test("翻滚消耗耐力并提供短暂无敌", () => {
  const player = createPlayer({ stamina: 60 });
  const result = startDodge(player, { x: 1, y: 0 }, 1000);

  assert.equal(result.started, true);
  assert.equal(result.player.stamina, 38);
  assert.equal(isInvulnerable(result.player, 1180), true);
  assert.equal(isInvulnerable(result.player, 1500), false);
});

test("圆形斩命中范围大并受到冷却限制", () => {
  const player = createPlayer();
  const first = useCircularSlash(player, 2000);
  const second = useCircularSlash(first.player, 2500);

  assert.equal(first.activated, true);
  assert.ok(first.attack.radius >= 70);
  assert.equal(second.activated, false);
});

test("敌人死亡会按世界词缀给予 XP、金币和材料", () => {
  const enemy = createEnemy("goblin");
  const reward = defeatEnemy(enemy, { xpMultiplier: 1.1, lootMultiplier: 1.25 });

  assert.deepEqual(reward, {
    xp: 24,
    coins: 10,
    materials: 1,
  });
});

test("玩家获得足够 XP 会升级并保留溢出经验", () => {
  const player = createPlayer({ xp: 45, xpToNext: 50, level: 1 });
  const leveled = addExperience(player, 20);

  assert.equal(leveled.level, 2);
  assert.equal(leveled.xp, 15);
  assert.ok(leveled.xpToNext > 50);
});

test("玩家倒下后会在主城复活", () => {
  const player = createPlayer({ hp: 0, x: 700, y: 500 });
  const respawned = respawnIfDefeated(player, { x: 210, y: 180 });

  assert.equal(respawned.hp, respawned.maxHp);
  assert.equal(respawned.x, 210);
  assert.equal(respawned.y, 180);
});

test("玩家死亡后伤害结算停止且生命钳到 0", () => {
  const player = createPlayer({ hp: 3 });
  const defeated = damagePlayer(player, {
    damage: 8,
    now: 1000,
    invulnerableMs: 1100,
  });
  const repeated = damagePlayer(defeated.player, {
    damage: 8,
    now: 2300,
    invulnerableMs: 1100,
  });

  assert.equal(defeated.applied, true);
  assert.equal(defeated.player.hp, 0);
  assert.equal(repeated.applied, false);
  assert.equal(repeated.player.hp, 0);
});

test("多个敌人同一时刻围攻只结算一次玩家受击", () => {
  const player = createPlayer({ hp: 80 });
  const firstHit = damagePlayer(player, {
    damage: 10,
    now: 5000,
    invulnerableMs: 1100,
  });
  const secondHit = damagePlayer(firstHit.player, {
    damage: 10,
    now: 5000,
    invulnerableMs: 1100,
  });

  assert.equal(firstHit.applied, true);
  assert.equal(secondHit.applied, false);
  assert.equal(secondHit.player.hp, 70);
});

test("回复药水恢复缺失生命且不超过上限", () => {
  const player = createPlayer({ hp: 96 });
  const healed = healPlayer(player, 30);
  const full = healPlayer(healed.player, 30);

  assert.equal(healed.healed, 24);
  assert.equal(healed.player.hp, player.maxHp);
  assert.equal(full.healed, 0);
  assert.equal(full.player.hp, player.maxHp);
});

test("两职业基础数值公平且同职业创建结果一致", () => {
  const strength = (stats) =>
    stats.maxHp * stats.attack * (1 + stats.critRate * (stats.critMultiplier - 1));
  const knight = PLAYER_CLASSES.knight.baseStats;
  const wizzard = PLAYER_CLASSES.wizzard.baseStats;
  const averageStrength = (strength(knight) + strength(wizzard)) / 2;
  const strengthGap =
    Math.abs(strength(knight) - strength(wizzard)) / averageStrength;

  assert.equal(PLAYER_CLASSES.knight.spritePrefix, "knight_m");
  assert.equal(PLAYER_CLASSES.wizzard.spritePrefix, "wizzard_m");
  assert.equal(PLAYER_CLASSES.knight.attackMode, "meleeArc");
  assert.equal(PLAYER_CLASSES.wizzard.attackMode, "projectile");
  assert.ok(knight.maxHp > wizzard.maxHp);
  assert.ok(knight.critRate < wizzard.critRate);
  assert.ok(strengthGap <= 0.08);
  assert.deepEqual(createPlayer({ classId: "knight" }), createPlayer({ classId: "knight" }));
  assert.deepEqual(
    pickBaseStats(
      createPlayer({
        classId: "knight",
        maxHp: 999,
        attack: 999,
        defense: 999,
        critRate: 1,
      }),
    ),
    {
      maxHp: knight.maxHp,
      attack: knight.attack,
      defense: knight.defense,
      critRate: knight.critRate,
      critMultiplier: knight.critMultiplier,
    },
  );
});

test("投射物按生命周期移动过期并只对同一目标命中一次", () => {
  const projectile = createProjectile({
    x: 0,
    y: 0,
    dirX: 1,
    dirY: 0,
    speed: 120,
    damage: 15,
    maxLifeMs: 1000,
    radius: 4,
  });

  const stepped = stepProjectile(projectile, 250);
  assert.equal(projectile.x, 0);
  assert.equal(stepped.x, 30);
  assert.equal(stepped.ageMs, 250);
  assert.equal(isExpired(stepped), false);
  assert.equal(isExpired(stepProjectile(stepped, 750)), true);

  const target = { id: "enemy-1", x: 34, y: 0, radius: 8 };
  assert.equal(hitsCircle(stepped, target), true);

  const afterHit = markProjectileHit(stepped, target);
  assert.deepEqual(afterHit.hitTargetIds, ["enemy-1"]);
  assert.equal(hitsCircle(afterHit, target), false);
  assert.equal(hitsCircle(afterHit, { ...target, id: "enemy-2" }), true);
  assert.equal(hitsCircle(stepped, { id: "far", x: 60, y: 0, radius: 4 }), false);
});

test("敌人层数缩放在 1 到 30 层生命与伤害单调不减", () => {
  const baseStats = { maxHp: 31, damage: 7 };
  let previous = applyDepthScaling(baseStats, 1);

  for (let depth = 2; depth <= 30; depth += 1) {
    const scaled = applyDepthScaling(baseStats, depth);
    assert.ok(scaled.maxHp >= previous.maxHp, `第 ${depth} 层生命不应降低`);
    assert.ok(scaled.damage >= previous.damage, `第 ${depth} 层伤害不应降低`);
    previous = scaled;
  }
});

test("第 1 层敌人使用最弱伤害基线", () => {
  assert.deepEqual(difficultyForDepth(1), {
    enemyHpScale: 1,
    enemyDamageScale: 1,
    rewardScale: 1,
  });
  assert.deepEqual(
    ["tiny_zombie", "goblin", "imp"].map((type) => createEnemy(type, { depth: 1 }).attack),
    [6, 8, 9],
  );
});

test("玩家基础数值不随层数变化", () => {
  const baseFields = ({ maxHp, attack, defense, critRate, critMultiplier, attackMode }) => ({
    maxHp,
    attack,
    defense,
    critRate,
    critMultiplier,
    attackMode,
  });

  assert.deepEqual(
    baseFields(createPlayer({ classId: "wizzard", depth: 1 })),
    baseFields(createPlayer({ classId: "wizzard", depth: 30 })),
  );
});

test("暴击结算只使用传入 rng 且同 seed 序列可复现", () => {
  const sequence = (seed) => {
    const rng = createRng(seed);

    return Array.from({ length: 16 }, () =>
      resolveDamage({
        attack: 18,
        defense: 3,
        critRate: 0.35,
        critMultiplier: 1.8,
        rng,
      }),
    );
  };

  assert.deepEqual(sequence(20260809), sequence(20260809));
});

test("按层数抽取的敌人类型合法且帧名前缀存在于图集中", async () => {
  const tileList = await readFixture("../apps/web/assets/dungeon/tile_list_v1.7.txt");
  const rng = createRng(42);
  const knownTypeIds = new Set(Object.keys(ENEMY_TYPES));

  for (const enemyType of Object.values(ENEMY_TYPES)) {
    assert.match(tileList, new RegExp(`^${enemyType.framePrefix}_idle_anim_f0\\b`, "m"));
  }

  for (let depth = 1; depth <= 30; depth += 1) {
    assert.ok(knownTypeIds.has(pickEnemyTypeForDepth(depth, rng).id));
  }
});

async function readFixture(relativePath) {
  const { readFile } = await import("node:fs/promises");

  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

function pickBaseStats(player) {
  return {
    maxHp: player.maxHp,
    attack: player.attack,
    defense: player.defense,
    critRate: player.critRate,
    critMultiplier: player.critMultiplier,
  };
}
