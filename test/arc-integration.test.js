import assert from "node:assert/strict";
import test from "node:test";
import { createEconomySession } from "../apps/web/src/runtime/economySession.js";
import { createMockLedger } from "../apps/web/src/core/economy/mockLedger.js";
import { createRun } from "../apps/web/src/core/run/runState.js";
import { RIALO_STORAGE_PREFIX } from "../apps/web/src/core/economy/ledger.js";
import { I18N_STORAGE_KEY } from "../apps/web/src/core/i18n/index.js";
import { readBrowserOption } from "../apps/web/src/runtime/browserOptions.js";

test("ARC 经济和语言键与 Rialo 隔离", () => {
  assert.equal(RIALO_STORAGE_PREFIX, "arc:");
  assert.equal(I18N_STORAGE_KEY, "arc.language");
});

test("浏览器开发偏好也使用 ARC 键名，不读取原版偏好", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const keys = [];
  Object.defineProperty(globalThis, "localStorage", { configurable: true,
    value: { getItem: (key) => { keys.push(key); return null; } } });
  try {
    readBrowserOption("rialoHeroClass");
    assert.deepEqual(keys, ["arcHeroClass"]);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  }
});

test("真实游戏本地结算成功才通知链上面板，回调失败不破坏结算", async () => {
  const calls = [];
  const economy = createEconomySession({
    ledger: createMockLedger({ storage: false }),
    onRunSettled: (run, result) => { calls.push({ run, result }); throw new Error("面板异常"); },
  });
  await economy.settleRun(null);
  assert.equal(calls.length, 0);
  const run = { ...createRun({ seed: "arc-test", heroClass: "knight" }), runId: "run:arc-test", settlementReason: "death" };
  const result = await economy.settleRun(run);
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].run.runId, run.runId);
  assert.equal(calls[0].result.depthReached, 1);
});
