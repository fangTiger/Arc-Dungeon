import { createArcWallet } from "./wallet.js";
import { createRunPublisher, encodeRecord } from "./records.js";
import { transactionUrl } from "./network.js";

const LOCAL_RECORD_KEY = "arc:latest-run:v1";
const STATUS_TEXT = { pending: "待确认", confirmed: "已确认", failed: "执行失败" };

export function initializeArcPanel(document = globalThis.document, target = globalThis.window) {
  const connectButton = document.querySelector("#arc-connect");
  const switchButton = document.querySelector("#arc-switch");
  const submitButton = document.querySelector("#arc-submit");
  const walletStatus = document.querySelector("#arc-wallet-status");
  const recordStatus = document.querySelector("#arc-record-status");
  const preview = document.querySelector("#arc-preview");
  const history = document.querySelector("#arc-history");
  let currentRecord = null;
  let busy = false;
  let polling = false;
  let storage = null;
  try {
    storage = target.localStorage;
    const saved = JSON.parse(storage?.getItem(LOCAL_RECORD_KEY) ?? "null");
    if (saved) { encodeRecord(saved); currentRecord = saved; }
  } catch { /* 存储不可用或记录损坏时，当前会话仍可游玩。 */ }
  const wallet = createArcWallet({ provider: target.ethereum, onChange: render });
  const publisher = createRunPublisher({ wallet, storage });

  function render() {
    const state = wallet.getState();
    walletStatus.textContent = state.account
      ? `${state.account.slice(0, 6)}…${state.account.slice(-4)} · ${state.onTestnet ? "Arc Testnet" : "请切换测试网"}`
      : state.available ? "钱包未连接 · 可先游客游玩" : "未检测到 EVM 钱包 · 可先游客游玩";
    connectButton.disabled = busy;
    connectButton.textContent = state.account ? "重新连接" : "连接钱包";
    switchButton.disabled = busy || !state.account || state.onTestnet;
    const entries = publisher.getEntries();
    const existing = entries.find((entry) => entry.record.runId === currentRecord?.runId);
    submitButton.disabled = busy || !state.account || !state.onTestnet || !currentRecord
      || (existing && existing.status !== "failed");
    submitButton.textContent = busy ? "等待钱包…" : "发布本局战绩";
    preview.textContent = currentRecord
      ? `职业 ${currentRecord.heroClass} · 第 ${currentRecord.depthReached} 层 · Boss ${currentRecord.bossesDefeated} · 探索 ${Math.round(currentRecord.explorationRate * 100)}%`
      : "完成一次地牢探索后，可发布本局战绩。";
    history.replaceChildren();
    for (const entry of entries.slice().reverse()) {
      const row = document.createElement("article");
      row.className = "arc-record";
      const status = document.createElement("p");
      status.textContent = `第 ${entry.record.depthReached} 层 · ${STATUS_TEXT[entry.status]}${entry.error ? ` · ${entry.error}` : ""}`;
      const link = document.createElement("a");
      link.href = transactionUrl(entry.txHash);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `查看交易 ${entry.txHash.slice(0, 10)}…`;
      row.append(status, link);
      if (entry.status === "pending" || entry.status === "failed") {
        const button = document.createElement("button");
        button.textContent = entry.status === "pending" ? "继续查询" : "重新发布此局";
        button.disabled = busy || !state.onTestnet;
        button.addEventListener("click", () => void act(async () => {
          const refreshed = entry.status === "pending"
            ? await publisher.refresh(entry.record) : await publisher.submit(entry.record);
          recordStatus.textContent = refreshed.error || STATUS_TEXT[refreshed.status];
        }));
        row.append(button);
      }
      history.append(row);
    }
    if (publisher.persistenceUnavailable) {
      recordStatus.textContent = "浏览器存储不可用，请保存交易链接；刷新后无法恢复待确认交易。";
    }
  }
  async function act(operation) {
    if (busy) return;
    busy = true;
    render();
    try { await operation(); }
    catch (error) { recordStatus.textContent = error?.message ?? "操作失败，请重试。"; }
    finally { busy = false; render(); }
  }
  connectButton.addEventListener("click", () => void act(async () => {
    await wallet.connect();
    recordStatus.textContent = "钱包已连接。战绩发布需要 Arc Testnet。";
  }));
  switchButton.addEventListener("click", () => void act(async () => {
    await wallet.switchNetwork();
    recordStatus.textContent = "已连接 Arc Testnet。";
  }));
  submitButton.addEventListener("click", () => void act(async () => {
    const entry = await publisher.submit(currentRecord);
    recordStatus.textContent = `${STATUS_TEXT[entry.status]}，可通过交易链接查看进度。`;
  }));
  function onSettlement(event) {
    try {
      encodeRecord(event.detail);
      currentRecord = structuredClone(event.detail);
      try { storage?.setItem(LOCAL_RECORD_KEY, JSON.stringify(currentRecord)); } catch { /* 保留当前会话战绩。 */ }
      recordStatus.textContent = "本局已结算，打开链上战绩面板即可发布。";
      document.querySelector("#arc-records").open = true;
      render();
    } catch { recordStatus.textContent = "战绩数据不可用，本地游戏已正常结算。"; }
  }
  target.addEventListener("arc:run-settled", onSettlement);
  const timer = target.setInterval(async () => {
    if (polling || busy || !wallet.getState().onTestnet) return;
    polling = true;
    try {
      for (const entry of publisher.getEntries().filter((entry) => entry.status === "pending")) {
        await publisher.refresh(entry.record);
      }
      render();
    } finally { polling = false; }
  }, 5000);
  render();
  return { destroy() {
    wallet.destroy();
    target.clearInterval(timer);
    target.removeEventListener("arc:run-settled", onSettlement);
  } };
}
