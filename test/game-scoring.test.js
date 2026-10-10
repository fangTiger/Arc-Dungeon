import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateRunRewards,
  calculateRunRewardsFromStats,
} from "../apps/web/src/core/run/scoring.js";

test("calculateRunRewards 对层数和 Boss 数单调不减且只产出 Token", () => {
  const shallow = calculateRunRewards({
    depthReached: 10,
    bossesDefeated: 1,
    explorationRate: 0.75,
  });
  const deeper = calculateRunRewards({
    depthReached: 27,
    bossesDefeated: 1,
    explorationRate: 0.75,
  });
  const moreBosses = calculateRunRewards({
    depthReached: 27,
    bossesDefeated: 2,
    explorationRate: 0.75,
  });
  const anchor = calculateRunRewards({
    depthReached: 27,
    bossesDefeated: 2,
    explorationRate: 1,
  });

  assert.equal(deeper.tokens >= shallow.tokens, true);
  assert.equal(moreBosses.tokens > deeper.tokens, true);
  assert.deepEqual(anchor, { tokens: 20 });
  assert.equal(Object.hasOwn(anchor, "shards"), false);
});

test("calculateRunRewardsFromStats 可消费当前 runState 形状", () => {
  const rewards = calculateRunRewardsFromStats({
    depth: 27,
    stats: {
      bossesDefeated: 2,
      visitedRoomCount: 81,
      totalRoomCount: 81,
    },
  });

  assert.deepEqual(rewards, { tokens: 20 });
});

test("calculateRunRewards 在首层死亡且探索率为 0 时不产生负数", () => {
  const rewards = calculateRunRewards({
    depthReached: 1,
    bossesDefeated: 0,
    explorationRate: 0,
  });

  assert.equal(rewards.tokens >= 0, true);
  assert.equal(Object.hasOwn(rewards, "shards"), false);
});
