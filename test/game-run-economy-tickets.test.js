import test from "node:test";
import assert from "node:assert/strict";

import { createMockLedger } from "../apps/web/src/core/economy/mockLedger.js";
import {
  buyTicketsForAccount,
  claimDailyTicketsForAccount,
  getEconomySnapshot,
  requestRunStart,
} from "../apps/web/src/core/economy/runEconomy.js";

const ACCOUNT_ID = "ticket-player";

test("requestRunStart 默认不再扣 Token 门票费", async () => {
  const ledger = createMockLedger({
    storage: createMemoryStorage(),
    initialBalances: { [ACCOUNT_ID]: { tokens: 2 } },
  });
  let createdRuns = 0;
  await claimDailyTicketsForAccount({ ledger, accountId: ACCOUNT_ID, now: "2026-08-10T00:00:00Z" });
  const result = await requestRunStart({
    ledger,
    accountId: ACCOUNT_ID,
    runId: "run-ticket-denied",
    createRun() {
      createdRuns += 1;
      return createRunSnapshot({ runId: "should-not-exist" });
    },
  });
  const snapshot = await getEconomySnapshot({ ledger, accountId: ACCOUNT_ID });
  assert.equal(result.ok, true);
  assert.equal(createdRuns, 1);
  assert.deepEqual(snapshot.balance, { tokens: 2 });
  assert.equal(snapshot.profile.tickets, 9);
  assert.deepEqual(result.run.ticketInvestment, { count: 1, lootMultiplier: 1, difficultyMultiplier: 1 });
});

test("门票领取、购买与投入扣除形成闭环", async () => {
  const ledger = createMockLedger({
    storage: createMemoryStorage(),
    initialBalances: { [ACCOUNT_ID]: { tokens: 100 } },
  });
  const claimed = await claimDailyTicketsForAccount({ ledger, accountId: ACCOUNT_ID, now: "2026-08-10T00:00:00Z" });
  const repeated = await claimDailyTicketsForAccount({ ledger, accountId: ACCOUNT_ID, now: "2026-08-10T23:59:59Z" });
  const bought = await buyTicketsForAccount({ ledger, accountId: ACCOUNT_ID, count: 2 });
  const started = await requestRunStart({
    ledger,
    accountId: ACCOUNT_ID,
    runId: "run-ticket-investment",
    ticketCount: 3,
    createRun: () => createRunSnapshot({ runId: "ignored" }),
  });
  const snapshot = await getEconomySnapshot({ ledger, accountId: ACCOUNT_ID });
  assert.equal(claimed.granted, 10);
  assert.equal(repeated.claimed, false);
  assert.deepEqual(bought.balance, { tokens: 50 });
  assert.equal(started.ok, true);
  assert.deepEqual(started.run.ticketInvestment, { count: 3, lootMultiplier: 3.3, difficultyMultiplier: 1.8 });
  assert.equal(snapshot.profile.tickets, 9);
  assert.equal(snapshot.profile.lastDailyTicketClaimDate, "2026-08-10");
});

test("requestRunStart 门票不足时拒绝且不创建 run", async () => {
  const ledger = createMockLedger({
    storage: createMemoryStorage(),
    initialBalances: { [ACCOUNT_ID]: { tokens: 100 } },
  });
  let createdRuns = 0;
  const result = await requestRunStart({
    ledger,
    accountId: ACCOUNT_ID,
    runId: "run-without-ticket",
    ticketCount: 1,
    createRun() {
      createdRuns += 1;
      return createRunSnapshot({ runId: "should-not-exist" });
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "insufficient-tickets");
  assert.equal(createdRuns, 0);
});

test("requestRunStart 创建 run 失败时不消耗已持有门票", async () => {
  const ledger = createMockLedger({
    storage: createMemoryStorage(),
    initialBalances: { [ACCOUNT_ID]: { tokens: 100 } },
  });
  await claimDailyTicketsForAccount({ ledger, accountId: ACCOUNT_ID, now: "2026-08-10T00:00:00Z" });
  const result = await requestRunStart({
    ledger,
    accountId: ACCOUNT_ID,
    runId: "run-create-fails",
    ticketCount: 3,
    createRun() {
      throw new Error("创建失败");
    },
  });
  const snapshot = await getEconomySnapshot({ ledger, accountId: ACCOUNT_ID });
  assert.equal(result.ok, false);
  assert.equal(snapshot.profile.tickets, 10);
});

function createRunSnapshot({ runId } = {}) {
  return {
    runId,
    seed: `${runId}-seed`,
    heroClass: "knight",
    depth: 1,
    bag: { tokens: 0 },
    stats: { bossesDefeated: 0, visitedRoomCount: 10, totalRoomCount: 10 },
  };
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}
