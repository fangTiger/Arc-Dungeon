import { LOCAL_ACCOUNT_ID, NEW_ACCOUNT_INITIAL_BALANCE } from "../core/economy/constants.js";
import { createMockLedger } from "../core/economy/mockLedger.js";
import { createI18n } from "../core/i18n/index.js";
import { readBrowserOption } from "./browserOptions.js";

export function normalizeUpgradeIds(rawUpgradeIds) {
  return Array.isArray(rawUpgradeIds) ? rawUpgradeIds : String(rawUpgradeIds).split(",");
}

export function createBrowserI18n() {
  try {
    return createI18n({ storage: globalThis.window?.localStorage ?? false });
  } catch {
    return createI18n();
  }
}

export function createDebugEconomyOptions() {
  if (readBrowserOption("rialoDebug") !== "1") {
    return {};
  }

  const tokens = readPositiveIntegerOption("rialoDebugTokens", null);
  if (tokens === null) {
    return {};
  }

  return {
    ledger: createMockLedger({
      storage: false,
      defaultBalance: NEW_ACCOUNT_INITIAL_BALANCE,
      initialBalances: {
        [LOCAL_ACCOUNT_ID]: { tokens },
      },
    }),
  };
}

export function readPositiveIntegerOption(name, fallback) {
  const value = Number.parseInt(readBrowserOption(name) ?? "", 10);
  return Number.isInteger(value) && value >= 1 ? value : fallback;
}
