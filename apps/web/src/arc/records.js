import { ARC_TESTNET, normalizeAccount, transactionUrl } from "./network.js";

export const RECORD_STORAGE_KEY = "arc:run-records:v1";
const STATUSES = new Set(["pending", "confirmed", "failed"]);
const submissionLocks = new Map();

export function createRunRecord(run, settlement) {
  if (!settlement?.ok) return null;
  const record = {
    protocol: "arc-rpg:run:v1", runId: settlement.runId,
    seed: run?.seed, heroClass: run?.heroClass,
    depthReached: settlement.depthReached, bossesDefeated: settlement.bossesDefeated,
    explorationRate: settlement.explorationRate, reason: run?.settlementReason ?? "evacuated",
  };
  validateRecord(record);
  return record;
}

function validateRecord(record) {
  if (record?.protocol !== "arc-rpg:run:v1"
    || ![record.runId, record.seed, record.heroClass, record.reason].every((v) => typeof v === "string" && v.length > 0 && v.length <= 200)
    || !Number.isSafeInteger(record.depthReached) || record.depthReached < 1
    || !Number.isSafeInteger(record.bossesDefeated) || record.bossesDefeated < 0
    || !Number.isFinite(record.explorationRate) || record.explorationRate < 0 || record.explorationRate > 1
    || Object.keys(record).length !== 8) throw new Error("战绩数据无效。");
}

export function encodeRecord(record) {
  validateRecord(record);
  return `0x${Array.from(new TextEncoder().encode(JSON.stringify(record)), (v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function createRunPublisher({ wallet, storage = safeStorage(), lockManager = globalThis.navigator?.locks } = {}) {
  let entries = [];
  let persistenceUnavailable = !storage;
  const inflight = new Map();
  function reload() {
    if (!storage || persistenceUnavailable) return;
    try {
      const raw = storage.getItem(RECORD_STORAGE_KEY);
      if (raw === null) return;
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved)) throw new Error("战绩存储格式无效");
      entries = saved.filter((entry) => {
        try {
          validateRecord(entry.record);
          return STATUSES.has(entry.status) && entry.chainId === ARC_TESTNET.id
            && normalizeAccount(entry.account) === entry.account && transactionUrl(entry.txHash);
        } catch { return false; }
      });
    } catch { persistenceUnavailable = true; }
  }
  reload();

  function persist(changed) {
    const local = entries;
    reload();
    if (!storage || persistenceUnavailable) entries = local;
    const index = entries.findIndex((entry) => entry.account === changed.account && entry.record.runId === changed.record.runId);
    if (index >= 0) entries[index] = changed;
    else entries.push(changed);
    try { storage?.setItem(RECORD_STORAGE_KEY, JSON.stringify(entries)); }
    catch { persistenceUnavailable = true; }
  }
  function find(record, account = wallet.getState().account) {
    return entries.find((entry) => entry.account === account && entry.record.runId === record?.runId);
  }
  function getEntries() {
    reload();
    return structuredClone(entries.filter((entry) => entry.account === wallet.getState().account));
  }
  function submit(record) {
    validateRecord(record);
    const expected = wallet.getState().account;
    const key = `${expected}:${record.runId}`;
    if (inflight.has(key)) return inflight.get(key);
    const operation = withLock(() => send(record, expected)).finally(() => inflight.delete(key));
    inflight.set(key, operation);
    return operation;
  }
  async function send(record, expected) {
    const account = await wallet.requireAccount(expected);
    reload();
    const existing = find(record, account);
    if (existing && existing.status !== "failed") return structuredClone(existing);
    const txHash = await wallet.request("eth_sendTransaction", [{
      from: account, to: account, value: "0x0", chainId: ARC_TESTNET.chainId, data: encodeRecord(record),
    }]);
    if (!transactionUrl(txHash)) throw new Error("钱包未返回有效交易哈希，请在钱包中检查交易状态后再操作。");
    const entry = { account, chainId: ARC_TESTNET.id, record: structuredClone(record),
      txHash, status: "pending", error: "", submittedAt: new Date().toISOString() };
    if (existing) Object.assign(existing, entry);
    else entries.push(entry);
    persist(entry);
    return structuredClone(entry);
  }
  function refresh(record) { return withLock(() => query(record)); }
  async function query(record) {
    reload();
    const entry = find(record);
    if (!entry) throw new Error("没有该账户的已提交战绩。");
    if (entry.status !== "pending") return structuredClone(entry);
    try {
      await wallet.requireAccount(entry.account);
      const receipt = await wallet.request("eth_getTransactionReceipt", [entry.txHash]);
      if (!receipt) { entry.error = ""; return structuredClone(entry); }
      if (receipt.transactionHash?.toLowerCase() !== entry.txHash.toLowerCase()
        || normalizeAccount(receipt.from) !== entry.account || normalizeAccount(receipt.to) !== entry.account) {
        throw new Error("链上交易与战绩不匹配。");
      }
      if (receipt.status === "0x0") {
        entry.status = "failed";
        entry.error = "交易执行失败，可重新发布。";
      } else if (receipt.status === "0x1") {
        const tx = await wallet.request("eth_getTransactionByHash", [entry.txHash]);
        if (!tx || tx.hash?.toLowerCase() !== entry.txHash.toLowerCase()
          || normalizeAccount(tx.from) !== entry.account || normalizeAccount(tx.to) !== entry.account
          || BigInt(tx.value) !== 0n || (tx.input ?? tx.data)?.toLowerCase() !== encodeRecord(entry.record).toLowerCase()
          || (tx.chainId != null && BigInt(tx.chainId) !== BigInt(ARC_TESTNET.id))) {
          throw new Error("链上交易数据与战绩不匹配。");
        }
        entry.status = "confirmed";
        entry.blockNumber = receipt.blockNumber;
        entry.error = "";
      } else throw new Error("无法识别交易收据状态。");
    } catch (error) { entry.error = error?.message ?? "查询失败，可继续查询。"; }
    finally { persist(entry); }
    return structuredClone(entry);
  }
  function withLock(operation) {
    const key = "arc:run-journal:v1";
    if (lockManager?.request) return lockManager.request(key, operation);
    // 广播和确认共用日志锁，避免不同战绩的跨标签页写入相互覆盖。
    const previous = submissionLocks.get(key) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    submissionLocks.set(key, current);
    return current.finally(() => { if (submissionLocks.get(key) === current) submissionLocks.delete(key); });
  }
  return { submit, refresh, getEntries, get persistenceUnavailable() { return persistenceUnavailable; } };
}

function safeStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
