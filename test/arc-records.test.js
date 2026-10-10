import assert from "node:assert/strict";
import test from "node:test";
import { createArcWallet } from "../apps/web/src/arc/wallet.js";
import { createRunRecord, createRunPublisher } from "../apps/web/src/arc/records.js";
import { ACCOUNT, createProvider } from "./provider.js";

const HASH = `0x${"c".repeat(64)}`;
const run = { runId: "run:示例", seed: "seed", heroClass: "knight", settlementReason: "death" };
const result = { ok: true, runId: run.runId, depthReached: 3, bossesDefeated: 1, explorationRate: 0.5 };
const record = () => createRunRecord(run, result);
function storage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
async function setup(store = storage()) {
  const provider = createProvider();
  const request = provider.request.bind(provider);
  provider.receipt = null;
  provider.request = async (args) => {
    if (args.method === "eth_sendTransaction") {
      provider.calls.push(args);
      provider.tx = { ...args.params[0], input: args.params[0].data, hash: HASH };
      return HASH;
    }
    if (args.method === "eth_getTransactionReceipt") return provider.receipt;
    if (args.method === "eth_getTransactionByHash") return provider.tx;
    return request(args);
  };
  const wallet = createArcWallet({ provider });
  await wallet.connect();
  return { provider, wallet, store, publisher: createRunPublisher({ wallet, storage: store }) };
}

test("只接受成功结算的有限战绩字段，不包含身份与奖励资料", () => {
  assert.equal(createRunRecord(run, { ok: false }), null);
  assert.equal(record().protocol, "arc-rpg:run:v1");
  assert.equal(record().runId, run.runId);
  assert.equal(record().depthReached, 3);
  assert.equal(record().heroClass, "knight");
  assert.equal("profile" in record(), false);
  assert.throws(() => createRunRecord(run, { ...result, depthReached: Infinity }), /战绩/);
});

test("战绩发送零金额自转账，收到 hash 后仅为 pending", async () => {
  const { provider, publisher } = await setup();
  const entry = await publisher.submit(record());
  assert.equal(entry.status, "pending");
  const tx = provider.tx;
  assert.equal(tx.from, ACCOUNT);
  assert.equal(tx.to, ACCOUNT);
  assert.equal(tx.value, "0x0");
  assert.equal(tx.chainId, "0x4cef52");
  const json = Buffer.from(tx.data.slice(2), "hex").toString("utf8");
  assert.deepEqual(JSON.parse(json), record());
  assert.equal(entry.txHash, HASH);
});

test("重复点击和刷新恢复不会广播第二笔交易", async () => {
  const { provider, wallet, publisher, store } = await setup();
  await Promise.all([publisher.submit(record()), publisher.submit(record())]);
  const restored = createRunPublisher({ wallet, storage: store });
  const entry = await restored.submit(record());
  assert.equal(entry.txHash, HASH);
  assert.equal(provider.calls.filter(({ method }) => method === "eth_sendTransaction").length, 1);
});

test("两个已打开的发布器共享战绩状态，不重复广播或丢失其他战绩", async () => {
  const { provider, wallet, publisher, store } = await setup();
  const second = createRunPublisher({ wallet, storage: store });
  await Promise.all([publisher.submit(record()), second.submit(record())]);
  assert.equal(provider.calls.filter(({ method }) => method === "eth_sendTransaction").length, 1);
  const other = { ...record(), runId: "run:second" };
  await second.submit(other);
  await publisher.refresh(record());
  const restored = createRunPublisher({ wallet, storage: store });
  assert.equal(restored.getEntries().length, 2);
});

test("收据成功且原交易一致才显示 confirmed", async () => {
  const { provider, publisher } = await setup();
  await publisher.submit(record());
  provider.receipt = { status: "0x1", transactionHash: HASH, from: ACCOUNT, to: ACCOUNT, blockNumber: "0x1" };
  const entry = await publisher.refresh(record());
  assert.equal(entry.status, "confirmed");
  assert.equal(publisher.getEntries().length, 1);
  await publisher.submit(record());
  assert.equal(provider.calls.filter(({ method }) => method === "eth_sendTransaction").length, 1);
});

test("RPC 查询失败仍保留 pending 与 hash，不允许重发", async () => {
  const { provider, publisher } = await setup();
  await publisher.submit(record());
  const request = provider.request.bind(provider);
  provider.request = async (args) => {
    if (args.method === "eth_getTransactionReceipt") throw new Error("网络异常");
    return request(args);
  };
  const entry = await publisher.refresh(record());
  assert.equal(entry.status, "pending");
  assert.equal(entry.txHash, HASH);
  assert.match(entry.error, /网络异常/);
  await publisher.submit(record());
  assert.equal(provider.calls.filter(({ method }) => method === "eth_sendTransaction").length, 1);
});

test("执行回滚可重试；交易输入不一致保持待确认并报错", async () => {
  const { provider, publisher } = await setup();
  await publisher.submit(record());
  provider.receipt = { status: "0x0", transactionHash: HASH, from: ACCOUNT, to: ACCOUNT };
  assert.equal((await publisher.refresh(record())).status, "failed");
  await publisher.submit(record());
  provider.receipt.status = "0x1";
  provider.tx.input = "0x00";
  const mismatched = await publisher.refresh(record());
  assert.equal(mismatched.status, "pending");
  assert.match(mismatched.error, /不匹配/);
});

test("账户变化或错误网络不会广播；拒签可重新提交", async () => {
  const { provider, publisher } = await setup();
  provider.chainId = "0x1";
  await assert.rejects(publisher.submit(record()), /Arc Testnet/);
  assert.equal(provider.tx, undefined);
  provider.chainId = "0x4cef52";
  const request = provider.request.bind(provider);
  provider.request = async (args) => {
    if (args.method === "eth_sendTransaction") throw Object.assign(new Error("拒签"), { code: 4001 });
    return request(args);
  };
  await assert.rejects(publisher.submit(record()), /拒绝/);
  provider.request = request;
  assert.equal((await publisher.submit(record())).status, "pending");
});

test("禁用浏览器存储时，当前会话仍保留 pending 并阻止重复广播", async () => {
  const { provider, publisher } = await setup(null);
  await publisher.submit(record());
  assert.equal(publisher.getEntries().length, 1);
  assert.equal(publisher.persistenceUnavailable, true);
  await publisher.submit(record());
  assert.equal(provider.calls.filter(({ method }) => method === "eth_sendTransaction").length, 1);
});

test("读取正常但写入失败时，不用旧存储覆盖已广播的内存记录", async () => {
  const store = { getItem: () => "[]", setItem: () => { throw new Error("存储空间不足"); } };
  const { provider, publisher } = await setup(store);
  await publisher.submit(record());
  assert.equal(publisher.persistenceUnavailable, true);
  assert.equal(publisher.getEntries().length, 1);
  await publisher.submit(record());
  assert.equal(provider.calls.filter(({ method }) => method === "eth_sendTransaction").length, 1);
});
