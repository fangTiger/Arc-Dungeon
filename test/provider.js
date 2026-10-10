export const ACCOUNT = `0x${"a".repeat(40)}`;
const OTHER = `0x${"b".repeat(40)}`;

export function createProvider({ chainId = "0x4cef52", accounts = [ACCOUNT] } = {}) {
  const listeners = new Map();
  return {
    chainId, accounts, calls: [], listeners,
    on(event, callback) { listeners.set(event, callback); },
    removeListener(event) { listeners.delete(event); },
    emit(event, value) { listeners.get(event)?.(value); },
    async request({ method, params }) {
      this.calls.push({ method, params });
      if (method === "eth_requestAccounts" || method === "eth_accounts") return this.accounts;
      if (method === "eth_chainId") return this.chainId;
      if (method === "wallet_switchEthereumChain") { this.chainId = params[0].chainId; return null; }
      if (method === "wallet_addEthereumChain") return null;
      throw new Error(`未处理 RPC：${method}`);
    },
  };
}

