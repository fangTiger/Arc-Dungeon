import {
  RIALO_STORAGE_PREFIX,
  ZERO_BALANCE,
  normalizeAccountId,
  normalizeBalance,
  normalizeRewards,
  normalizeRunId,
} from "./ledger.js";
import {
  normalizeEconomyProfile,
  normalizeRunSummary,
} from "./profile.js";
import {
  normalizeTicketInvestmentModifiersSnapshot,
  ticketInvestmentModifiers,
} from "./tickets.js";

export const MOCK_LEDGER_STORAGE_KEY = `${RIALO_STORAGE_PREFIX}economy-ledger:v1`;

let storageProbeCounter = 0;

export function createLedgerStateController({
  storage,
  initialBalances = {},
  defaultBalance = ZERO_BALANCE,
  storageKind = "localStorage",
} = {}) {
  const initialState = createInitialState(initialBalances, defaultBalance);
  let persistent = false;
  let activeStorage = null;
  let activeStorageKind = "memory";
  let stateCache = cloneLedgerJson(initialState);

  if (isStorageUsable(storage)) {
    persistent = true;
    activeStorage = storage;
    activeStorageKind = storageKind;

    try {
      stateCache = loadState(activeStorage, initialState);
      saveState(activeStorage, stateCache);
    } catch (_error) {
      downgradeToMemory(initialState);
    }
  }

  return {
    readState() {
      if (!persistent) {
        return cloneLedgerJson(stateCache);
      }

      try {
        stateCache = loadState(activeStorage, stateCache);
      } catch (_error) {
        downgradeToMemory(stateCache);
      }

      return cloneLedgerJson(stateCache);
    },

    writeState(nextState) {
      stateCache = normalizeState(nextState, stateCache);

      if (!persistent) {
        return;
      }

      try {
        saveState(activeStorage, stateCache);
      } catch (_error) {
        downgradeToMemory(stateCache);
      }
    },

    isPersistent() {
      return persistent;
    },

    storageKind() {
      return activeStorageKind;
    },
  };

  function downgradeToMemory(nextState) {
    persistent = false;
    activeStorage = null;
    activeStorageKind = "memory";
    stateCache = cloneLedgerJson(nextState);
  }
}

export function readGlobalLocalStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch (_error) {
    return null;
  }
}

export function cloneLedgerJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createInitialState(initialBalances, defaultBalance) {
  return normalizeState({
    version: 1,
    accounts: normalizeAccounts(initialBalances, defaultBalance),
    ticketPayments: {},
    ticketInvestments: {},
    settledRuns: {},
    runProofs: {},
    profiles: {},
    profileRuns: {},
  });
}

function loadState(storage, fallbackState) {
  const raw = storage.getItem(MOCK_LEDGER_STORAGE_KEY);

  if (raw === null || raw === undefined || raw === "") {
    return cloneLedgerJson(fallbackState);
  }

  return normalizeState(JSON.parse(raw), fallbackState);
}

function saveState(storage, state) {
  storage.setItem(MOCK_LEDGER_STORAGE_KEY, JSON.stringify(normalizeState(state)));
}

function normalizeState(value, fallbackState = {}) {
  const source = isRecord(value) ? value : {};
  const fallback = isRecord(fallbackState) ? fallbackState : {};

  return {
    version: 1,
    accounts: normalizeAccounts({
      ...(fallback.accounts ?? {}),
      ...(source.accounts ?? {}),
    }),
    ticketPayments: normalizeRecordMap(source.ticketPayments),
    ticketInvestments: normalizeTicketInvestments(source.ticketInvestments),
    settledRuns: normalizeSettledRuns(source.settledRuns),
    runProofs: normalizeRecordMap(source.runProofs ?? source.proofs),
    profiles: normalizeProfiles({
      ...(fallback.profiles ?? {}),
      ...(source.profiles ?? {}),
    }),
    profileRuns: normalizeProfileRuns(source.profileRuns),
  };
}

function normalizeAccounts(accounts, defaultBalance = ZERO_BALANCE) {
  const normalized = {};

  for (const [accountId, balance] of Object.entries(accounts ?? {})) {
    const normalizedAccountId = normalizeAccountId(accountId);

    if (normalizedAccountId) {
      normalized[normalizedAccountId] = normalizeBalance(balance ?? defaultBalance);
    }
  }

  return normalized;
}

function normalizeSettledRuns(settledRuns) {
  const normalized = {};

  for (const [runId, settlement] of Object.entries(settledRuns ?? {})) {
    const normalizedRunId = normalizeRunId(runId);
    const normalizedAccountId = normalizeAccountId(settlement?.accountId);

    if (normalizedRunId && normalizedAccountId) {
      normalized[normalizedRunId] = {
        accountId: normalizedAccountId,
        rewards: normalizeRewards(settlement.rewards),
      };
    }
  }

  return normalized;
}

function normalizeProfiles(profiles) {
  const normalized = {};

  for (const [accountId, profile] of Object.entries(profiles ?? {})) {
    const normalizedAccountId = normalizeAccountId(accountId);

    if (normalizedAccountId) {
      normalized[normalizedAccountId] = normalizeEconomyProfile(profile);
    }
  }

  return normalized;
}

function normalizeProfileRuns(profileRuns) {
  const normalized = {};

  for (const [runId, record] of Object.entries(profileRuns ?? {})) {
    const normalizedRunId = normalizeRunId(runId);
    const normalizedAccountId = normalizeAccountId(record?.accountId);
    const normalizedSummary = normalizeRunSummary(record?.summary);

    if (normalizedRunId && normalizedAccountId && normalizedSummary) {
      normalized[normalizedRunId] = {
        accountId: normalizedAccountId,
        summary: normalizedSummary,
      };
    }
  }

  return normalized;
}

function normalizeTicketInvestments(ticketInvestments) {
  const normalized = {};

  for (const [runId, record] of Object.entries(ticketInvestments ?? {})) {
    const normalizedRunId = normalizeRunId(runId);
    const normalizedAccountId = normalizeAccountId(record?.accountId);
    const count = Number.isInteger(record?.count) ? record.count : null;

    if (normalizedRunId && normalizedAccountId && count !== null) {
      try {
        normalized[normalizedRunId] = {
          accountId: normalizedAccountId,
          count,
          modifiers: normalizeTicketInvestmentModifiersSnapshot(record.modifiers, count)
            ?? ticketInvestmentModifiers(count),
        };
      } catch (_error) {
        // 损坏存档中的非法投入记录直接丢弃。
      }
    }
  }

  return normalized;
}

function normalizeRecordMap(records) {
  const normalized = {};

  for (const [key, value] of Object.entries(records ?? {})) {
    if (typeof key === "string" && isRecord(value)) {
      normalized[key] = cloneLedgerJson(value);
    }
  }

  return normalized;
}

function isStorageUsable(storage) {
  if (!storage) {
    return false;
  }

  const probeKey = `${RIALO_STORAGE_PREFIX}ledger-probe:${storageProbeCounter}`;
  storageProbeCounter += 1;

  try {
    storage.setItem(probeKey, "1");
    const ok = storage.getItem(probeKey) === "1";
    storage.removeItem(probeKey);
    return ok;
  } catch (_error) {
    return false;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
