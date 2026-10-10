import test from "node:test";
import assert from "node:assert/strict";

import {
  EXTRA_TICKET_TOKEN_COST,
  NEW_ACCOUNT_INITIAL_TOKENS,
  SKIN_BOX_TOKEN_COST,
} from "../apps/web/src/core/economy/constants.js";
import { createMockLedger } from "../apps/web/src/core/economy/mockLedger.js";
import {
  craftSkinForAccount,
  exchangeSkinBoxForAccount,
  getEconomySnapshot,
  refreshEconomySnapshotState,
  openSkinBoxForAccount,
  settleRunEconomy,
} from "../apps/web/src/core/economy/runEconomy.js";

const ACCOUNT_ID = "test-player";

test("端到端结算使用本局背包且同一 run 只入账一次", async () => {
  const ledger = createMockLedger({
    storage: createMemoryStorage(),
    initialBalances: {
      [ACCOUNT_ID]: { tokens: 10 },
    },
  });
  const run = createRunSnapshot({
    runId: "run-double-settle",
    depth: 5,
    bossesDefeated: 1,
    bag: { tokens: 40 },
    settlementReason: "evacuated",
  });

  const first = await settleRunEconomy({ ledger, accountId: ACCOUNT_ID, run });
  const second = await settleRunEconomy({ ledger, accountId: ACCOUNT_ID, run });
  const snapshot = await getEconomySnapshot({ ledger, accountId: ACCOUNT_ID });
  assert.equal(first.ok, true);
  assert.equal(first.applied, true);
  assert.equal(second.ok, true);
  assert.equal(second.applied, false);
  assert.deepEqual(first.rewards, { tokens: 52 });
  assert.deepEqual(first.bagSettlement, {
    bagTokens: 40,
    creditedTokens: 52,
    retentionRate: 1,
    explorationMultiplier: 1.3,
    reason: "evacuated",
  });
  assert.deepEqual(snapshot.balance, { tokens: 62 });
  assert.equal(snapshot.profile.completedRuns, 1);
});

test("profile 连续三次 run 后累计战绩正确", async () => {
  const ledger = createMockLedger({
    storage: createMemoryStorage(),
    initialBalances: {
      [ACCOUNT_ID]: { tokens: 0 },
    },
  });

  await settleRunEconomy({
    ledger,
    accountId: ACCOUNT_ID,
    run: createRunSnapshot({ runId: "profile-1", depth: 4, bossesDefeated: 0 }),
  });
  await settleRunEconomy({
    ledger,
    accountId: ACCOUNT_ID,
    run: createRunSnapshot({ runId: "profile-2", depth: 12, bossesDefeated: 1 }),
  });
  await settleRunEconomy({
    ledger,
    accountId: ACCOUNT_ID,
    run: createRunSnapshot({ runId: "profile-3", depth: 8, bossesDefeated: 2 }),
  });
  const snapshot = await getEconomySnapshot({ ledger, accountId: ACCOUNT_ID });

  assert.equal(snapshot.profile.highestDepth, 12);
  assert.equal(snapshot.profile.totalBossesDefeated, 3);
  assert.equal(snapshot.profile.completedRuns, 3);
});

test("存储不可用时经济快照暴露降级提示标志", async () => {
  const ledger = createMockLedger({
    storage: createFailingStorage(),
    defaultBalance: { tokens: NEW_ACCOUNT_INITIAL_TOKENS },
  });

  const snapshot = await getEconomySnapshot({ ledger, accountId: ACCOUNT_ID });

  assert.equal(snapshot.progressWillNotPersist, true);
  assert.deepEqual(snapshot.balance, { tokens: NEW_ACCOUNT_INITIAL_TOKENS });
});

test("经济快照读取失败只记录可恢复错误并保留上次成功数据", async () => {
  const readSnapshot = createFlakySnapshotReader([
    {
      ok: true,
      balance: { tokens: 15 },
      profile: { tickets: 10 },
      progressWillNotPersist: false,
    },
    new Error("临时读取失败"),
  ]);

  const loaded = await refreshEconomySnapshotState({
    previousSnapshot: null,
    readSnapshot,
  });
  const failed = await refreshEconomySnapshotState({
    previousSnapshot: loaded.snapshot,
    readSnapshot,
  });

  assert.equal(loaded.readFailed, false);
  assert.equal(loaded.snapshot.profile.tickets, 10);
  assert.equal(failed.readFailed, true);
  assert.equal(failed.message, "数据读取失败，重试中");
  assert.equal(failed.snapshot.profile.tickets, 10);
  assert.equal(failed.snapshot.progressWillNotPersist, false);
});

test("盲盒可作为账户资产保留，开启不额外扣 Token", async () => {
  const ledger = createMockLedger({
    storage: createMemoryStorage(),
    initialBalances: {
      [ACCOUNT_ID]: { tokens: SKIN_BOX_TOKEN_COST + 25 },
    },
  });

  const exchanged = await exchangeSkinBoxForAccount({ ledger, accountId: ACCOUNT_ID });
  const afterExchange = await getEconomySnapshot({ ledger, accountId: ACCOUNT_ID });
  const opened = await openSkinBoxForAccount({ ledger, accountId: ACCOUNT_ID });
  const afterOpen = await getEconomySnapshot({ ledger, accountId: ACCOUNT_ID });

  assert.equal(exchanged.ok, true);
  assert.deepEqual(afterExchange.balance, { tokens: 25 });
  assert.equal(afterExchange.profile.skinBoxes, 1);
  assert.deepEqual(afterExchange.profile.ownedSkins, []);
  assert.equal(opened.ok, true);
  assert.deepEqual(afterOpen.balance, { tokens: 25 });
  assert.equal(afterOpen.profile.skinBoxes, 0);
  assert.equal(afterOpen.profile.craftCount, 1);
  assert.deepEqual(afterOpen.profile.ownedSkins, [opened.skin]);
});

test("兼容皮肤入口仍可用 Token 兑换并立即开启", async () => {
  const ledger = createMockLedger({
    storage: createMemoryStorage(),
    initialBalances: {
      [ACCOUNT_ID]: { tokens: SKIN_BOX_TOKEN_COST },
    },
  });

  const result = await craftSkinForAccount({ ledger, accountId: ACCOUNT_ID });
  const snapshot = await getEconomySnapshot({ ledger, accountId: ACCOUNT_ID });

  assert.equal(result.ok, true);
  assert.deepEqual(snapshot.balance, { tokens: 0 });
  assert.equal(snapshot.profile.skinBoxes, 0);
  assert.deepEqual(snapshot.profile.ownedSkins, [result.skin]);
});

test("经济参数使用规格定值", () => {
  assert.equal(EXTRA_TICKET_TOKEN_COST, 25);
  assert.equal(SKIN_BOX_TOKEN_COST, 100);
  assert.equal(NEW_ACCOUNT_INITIAL_TOKENS, 15);
});

function createRunSnapshot({
  runId,
  depth = 1,
  bossesDefeated = 0,
  visitedRoomCount = 10,
  totalRoomCount = 10,
  bag = { tokens: 0 },
  settlementReason = "evacuated",
} = {}) {
  return {
    runId,
    seed: `${runId}-seed`,
    heroClass: "knight",
    depth,
    bag,
    settlementReason,
    stats: {
      bossesDefeated,
      visitedRoomCount,
      totalRoomCount,
    },
  };
}

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function createFailingStorage() {
  return {
    getItem() {
      throw new Error("存储不可用");
    },
    setItem() {
      throw new Error("存储不可用");
    },
    removeItem() {
      throw new Error("存储不可用");
    },
  };
}

function createFlakySnapshotReader(results) {
  let index = 0;
  return async () => {
    const result = results[index];
    index += 1;
    if (result instanceof Error) {
      throw result;
    }
    return result;
  };
}
