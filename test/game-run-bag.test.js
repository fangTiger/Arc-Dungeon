import test from "node:test";
import assert from "node:assert/strict";

import { createRng, hashSeed } from "../apps/web/src/core/rng.js";
import {
  DEATH_LOOT_RETENTION,
  addBossTokenDrop,
  addChestTokenDrop,
  addEnemyTokenDrop,
  addTokensToRunBag,
  createRunBag,
  rollBossTokenDrop,
  rollChestTokenDrop,
  rollEnemyTokenDrop,
  settleRunBag,
} from "../apps/web/src/core/run/runBag.js";

test("Token 掉落先进本局背包，不会直接改账户余额", () => {
  const balance = { tokens: 100 };
  const result = addEnemyTokenDrop(createRunBag(), {
    rng: createRng(hashSeed("enemy-drop")),
    depth: 1,
    lootMultiplier: 1,
  });

  assert.equal(result.bag.tokens >= 1 && result.bag.tokens <= 3, true);
  assert.deepEqual(balance, { tokens: 100 });
});

test("敌人、宝箱、Boss 掉落在基础区间内且同 seed 可复现", () => {
  const firstSeed = hashSeed("drop-ranges");
  const first = {
    enemy: rollEnemyTokenDrop({ rng: createRng(firstSeed), depth: 1, lootMultiplier: 1 }),
    chest: rollChestTokenDrop({ rng: createRng(firstSeed), depth: 1, lootMultiplier: 1 }),
    boss: rollBossTokenDrop({ rng: createRng(firstSeed), depth: 1, lootMultiplier: 1 }),
  };
  const second = {
    enemy: rollEnemyTokenDrop({ rng: createRng(firstSeed), depth: 1, lootMultiplier: 1 }),
    chest: rollChestTokenDrop({ rng: createRng(firstSeed), depth: 1, lootMultiplier: 1 }),
    boss: rollBossTokenDrop({ rng: createRng(firstSeed), depth: 1, lootMultiplier: 1 }),
  };

  assert.equal(first.enemy >= 1 && first.enemy <= 3, true);
  assert.equal(first.chest >= 8 && first.chest <= 15, true);
  assert.equal(first.boss >= 15 && first.boss <= 30, true);
  assert.deepEqual(second, first);
});

test("层数加成和投入掉落倍率会提高掉落结果", () => {
  const seed = hashSeed("drop-scaling");
  const shallow = rollBossTokenDrop({ rng: createRng(seed), depth: 1, lootMultiplier: 1 });
  const deeper = rollBossTokenDrop({ rng: createRng(seed), depth: 5, lootMultiplier: 1.7 });

  assert.equal(deeper >= shallow, true);
});

test("同一背包撤离入账大于死亡入账，死亡按 50% 与探索加成结算", () => {
  const bag = addTokensToRunBag(createRunBag(), 40);
  const evacuated = settleRunBag({ bag, reason: "evacuated", explorationRate: 0.5 });
  const death = settleRunBag({ bag, reason: "death", explorationRate: 0.5 });

  assert.equal(DEATH_LOOT_RETENTION, 0.5);
  assert.equal(evacuated.creditedTokens > death.creditedTokens, true);
  assert.equal(death.creditedTokens, 40 * DEATH_LOOT_RETENTION * 1.15);
  assert.deepEqual(death.remainingBag, { tokens: 0 });
});

test("settleRunBag 对小数结果统一向下取整，避免 rewards 与余额不一致", () => {
  const settlement = settleRunBag({
    bag: { tokens: 1 },
    reason: "death",
    explorationRate: 1,
  });

  assert.equal(settlement.creditedTokens, 0);
});

test("空背包死亡入账为 0，余额不减少", () => {
  const balance = { tokens: 30 };
  const settlement = settleRunBag({
    bag: createRunBag(),
    reason: "death",
    explorationRate: 1,
  });
  const nextBalance = {
    tokens: balance.tokens + settlement.creditedTokens,
  };

  assert.equal(settlement.creditedTokens, 0);
  assert.deepEqual(nextBalance, balance);
});

test("背包数值会钳制为非负，宝箱和 Boss 掉落也只进入背包", () => {
  const afterNegative = addTokensToRunBag({ tokens: 2 }, -5);
  const afterChest = addChestTokenDrop(afterNegative, {
    rng: createRng(hashSeed("chest-to-bag")),
    depth: 1,
    lootMultiplier: 1,
  });
  const afterBoss = addBossTokenDrop(afterChest.bag, {
    rng: createRng(hashSeed("boss-to-bag")),
    depth: 1,
    lootMultiplier: 1,
  });

  assert.deepEqual(afterNegative, { tokens: 0 });
  assert.equal(afterChest.bag.tokens >= 8 && afterChest.bag.tokens <= 15, true);
  assert.equal(afterBoss.bag.tokens > afterChest.bag.tokens, true);
});
