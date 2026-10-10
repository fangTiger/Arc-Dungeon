import test from "node:test";
import assert from "node:assert/strict";

import {
  addBossTokenDropToRun,
  addCombatTokenDropsToRun,
  applyTicketDifficultyToEnemy,
  rollBossLootDrop,
  rollEnemyLootDrop,
} from "../apps/web/src/core/run/runRewards.js";

test("applyTicketDifficultyToEnemy 会按门票难度倍率提高生命和攻击", () => {
  const enemy = { hp: 10, maxHp: 10, attack: 4, damage: 4 };
  const scaled = applyTicketDifficultyToEnemy(enemy, {
    ticketInvestment: { difficultyMultiplier: 2.6 },
  });

  assert.deepEqual(scaled, {
    hp: 26,
    maxHp: 26,
    attack: 10,
    damage: 10,
  });
});

test("敌人 Token 掉落逐个掷点但总量保持旧清房实现不变", () => {
  const enemies = [
    { hp: 0, state: "dead" },
    { hp: 0, state: "dead" },
    { hp: 1, state: "patrol" },
  ];
  const base = addCombatTokenDropsToRun({
    run: createRun({ lootMultiplier: 1 }),
    roomId: "battle-1",
    enemies,
  });
  const boosted = addCombatTokenDropsToRun({
    run: createRun({ lootMultiplier: 6 }),
    roomId: "battle-1",
    enemies,
  });
  const rolledTotal = enemies
    .filter((enemy) => enemy.hp <= 0 && enemy.state === "dead")
    .reduce((sum, enemy, killIndex) => sum + rollEnemyLootDrop({
      run: createRun({ lootMultiplier: 1 }),
      roomId: "battle-1",
      enemy,
      killIndex,
    }), 0);

  assert.equal(base.totalDrop > 0, true);
  assert.equal(base.totalDrop, 4);
  assert.equal(rolledTotal, 4);
  assert.equal(boosted.totalDrop >= base.totalDrop * 6, true);
  assert.equal(base.run.bag.tokens, 0);
  assert.equal(boosted.run.bag.tokens, 0);
});

test("Boss Token 掉落只返回数量并保留旧 seed 总量", () => {
  const base = addBossTokenDropToRun({
    run: createRun({ lootMultiplier: 1 }),
    roomId: "boss-1",
  });
  const boosted = addBossTokenDropToRun({
    run: createRun({ lootMultiplier: 6 }),
    roomId: "boss-1",
  });

  assert.equal(base.totalDrop > 0, true);
  assert.equal(base.totalDrop, 19);
  assert.equal(rollBossLootDrop({ run: createRun({ lootMultiplier: 1 }), roomId: "boss-1" }), 19);
  assert.equal(boosted.totalDrop >= base.totalDrop * 6, true);
  assert.equal(base.run.bag.tokens, 0);
  assert.equal(boosted.run.bag.tokens, 0);
});

function createRun({ lootMultiplier }) {
  return {
    seed: "reward-seed",
    depth: 3,
    bag: { tokens: 0 },
    ticketInvestment: { lootMultiplier },
    build: { bonuses: { lootMultiplier: 1 } },
  };
}
