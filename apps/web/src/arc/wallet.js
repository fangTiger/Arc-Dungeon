import { ARC_TESTNET, normalizeAccount } from "./network.js";

export function createArcWallet({ provider = globalThis.ethereum, onChange = () => {} } = {}) {
  let account = null;
  let chainId = null;
  let revision = 0;
  const listeners = {
    accountsChanged: (accounts) => { revision += 1; account = normalizeAccount(accounts?.[0]); emit(); },
    chainChanged: (value) => { revision += 1; chainId = normalizeChain(value); emit(); },
    disconnect: () => { revision += 1; account = null; chainId = null; emit(); },
  };
  for (const [event, listener] of Object.entries(listeners)) provider?.on?.(event, listener);

  function getState() {
    return { available: typeof provider?.request === "function", account, chainId,
      onTestnet: chainId === ARC_TESTNET.chainId };
  }
  function emit() { onChange(getState()); }
  async function request(method, params) {
    if (typeof provider?.request !== "function") throw new Error("请安装 MetaMask 等 EVM 钱包后刷新页面。");
    try {
      return await provider.request({ method, ...(params === undefined ? {} : { params }) });
    } catch (error) {
      if (Number(error?.code) === 4001) {
        throw Object.assign(new Error("已拒绝钱包请求，可稍后重试。"), { code: 4001 });
      }
      throw error;
    }
  }
  async function connect() {
    const accounts = await request("eth_requestAccounts");
    const initialRevision = revision;
    const value = await request("eth_chainId");
    if (initialRevision !== revision) throw new Error("钱包账户或网络发生变化，请重新连接。");
    account = normalizeAccount(accounts?.[0]);
    chainId = normalizeChain(value);
    emit();
    if (!account) throw new Error("钱包未提供可用账户。");
    return getState();
  }
  async function switchNetwork() {
    try {
      await request("wallet_switchEthereumChain", [{ chainId: ARC_TESTNET.chainId }]);
    } catch (error) {
      if (Number(error?.code) !== 4902) throw error;
      await request("wallet_addEthereumChain", [{
        chainId: ARC_TESTNET.chainId, chainName: ARC_TESTNET.chainName,
        nativeCurrency: ARC_TESTNET.nativeCurrency, rpcUrls: [...ARC_TESTNET.rpcUrls],
        blockExplorerUrls: [...ARC_TESTNET.blockExplorerUrls],
      }]);
      await request("wallet_switchEthereumChain", [{ chainId: ARC_TESTNET.chainId }]);
    }
    chainId = normalizeChain(await request("eth_chainId"));
    emit();
    if (chainId !== ARC_TESTNET.chainId) throw new Error("请在钱包中切换到 Arc Testnet。");
    return getState();
  }
  async function requireAccount(expected = account) {
    if (!expected) throw new Error("请先连接钱包。");
    const initialRevision = revision;
    const accounts = await request("eth_accounts");
    const value = await request("eth_chainId");
    if (initialRevision !== revision) throw new Error("钱包账户或网络发生变化，请重新确认。");
    const current = normalizeAccount(accounts?.[0]);
    account = current;
    chainId = normalizeChain(value);
    emit();
    if (!current || current !== normalizeAccount(expected)) {
      throw new Error("钱包账户或网络发生变化，请重新确认。");
    }
    if (chainId !== ARC_TESTNET.chainId) throw new Error("请先切换到 Arc Testnet，再发布战绩。");
    return current;
  }
  function destroy() {
    for (const [event, listener] of Object.entries(listeners)) provider?.removeListener?.(event, listener);
  }
  return { connect, switchNetwork, requireAccount, getState, request, destroy };
}

function normalizeChain(value) {
  try { return `0x${BigInt(value).toString(16)}`; } catch { return null; }
}
