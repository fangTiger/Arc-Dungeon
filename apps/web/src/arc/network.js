// 官方配置核验于 2026-10-10：https://docs.arc.io/arc/references/connect-to-arc
export const ARC_TESTNET = Object.freeze({
  id: 5042002,
  chainId: "0x4cef52",
  chainName: "Arc Testnet",
  nativeCurrency: Object.freeze({ name: "USDC", symbol: "USDC", decimals: 18 }),
  rpcUrls: Object.freeze(["https://rpc.testnet.arc.io"]),
  blockExplorerUrls: Object.freeze(["https://explorer.testnet.arc.io"]),
});

export function transactionUrl(hash) {
  return /^0x[\da-f]{64}$/i.test(hash)
    ? `${ARC_TESTNET.blockExplorerUrls[0]}/tx/${hash}`
    : null;
}

export function normalizeAccount(value) {
  return typeof value === "string" && /^0x[\da-f]{40}$/i.test(value)
    ? value.toLowerCase() : null;
}
