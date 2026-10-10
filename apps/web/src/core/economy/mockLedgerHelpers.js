import {
  LEDGER_FAILURE_REASONS,
  ledgerFailure,
  ledgerSuccess,
  normalizeBalance,
  normalizeRewards,
  sameRewards,
} from "./ledger.js";
import { cloneLedgerJson } from "./mockLedgerStorage.js";
import {
  createDefaultEconomyProfile,
  normalizeEconomyProfile,
  sameRunSummary,
} from "./profile.js";

export function payTicketIdempotentResult({ existing, accountId, amount, state, defaultBalance }) {
  if (existing.accountId !== accountId || existing.amount !== amount) {
    return operationConflict("runId 已用于不同门票支付");
  }

  return ledgerSuccess({
    applied: false,
    idempotent: true,
    balance: readAccountBalance(state, accountId, defaultBalance),
  });
}

export function settleRunIdempotentResult({ existing, accountId, rewards, state, defaultBalance }) {
  if (existing.accountId !== accountId || !sameRewards(existing.rewards, rewards)) {
    return operationConflict("runId 已用于不同结算");
  }

  return ledgerSuccess({
    applied: false,
    idempotent: true,
    balance: readAccountBalance(state, accountId, defaultBalance),
  });
}

export function proofIdempotentResult({ existing, accountId, serializedProof }) {
  if (existing.accountId !== accountId || existing.proofJson !== serializedProof) {
    return operationConflict("runId 已用于不同战绩证明");
  }

  return ledgerSuccess({
    applied: false,
    idempotent: true,
    proof: cloneLedgerJson(existing.proof),
  });
}

export function profileRunIdempotentResult({ existing, accountId, summary, state }) {
  if (existing.accountId !== accountId || !sameRunSummary(existing.summary, summary)) {
    return operationConflict("runId 已用于不同 profile 战绩");
  }

  return ledgerSuccess({
    applied: false,
    idempotent: true,
    profile: readAccountProfile(state, accountId),
  });
}

export function readAccountBalance(state, accountId, defaultBalance) {
  return normalizeBalance(state.accounts[accountId] ?? defaultBalance);
}

export function readAccountProfile(state, accountId) {
  return normalizeEconomyProfile(state.profiles[accountId] ?? createDefaultEconomyProfile());
}

export function serializeProof(proof) {
  if (proof === null || typeof proof !== "object" || Array.isArray(proof)) {
    return null;
  }

  try {
    const serialized = JSON.stringify(canonicalizeJson(proof));
    return typeof serialized === "string" ? serialized : null;
  } catch (_error) {
    return null;
  }
}

export function normalizeSettlementRewards(rewards) {
  if (!isRecord(rewards)) {
    return null;
  }

  if (!isNonNegativeNumber(rewards.tokens)) {
    return null;
  }

  return normalizeRewards(rewards);
}

export function invalidInput(message) {
  return ledgerFailure(LEDGER_FAILURE_REASONS.INVALID_INPUT, { message });
}

export function operationConflict(message) {
  return ledgerFailure(LEDGER_FAILURE_REASONS.OPERATION_CONFLICT, { message });
}

export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalizeJson(value) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      const normalized = canonicalizeJson(item);
      return normalized === undefined ? null : normalized;
    });
  }

  if (isRecord(value)) {
    const normalized = {};

    for (const key of Object.keys(value).sort()) {
      const item = canonicalizeJson(value[key]);

      if (item !== undefined) {
        normalized[key] = item;
      }
    }

    return normalized;
  }

  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }

  return value;
}

function isNonNegativeNumber(value) {
  return Number.isFinite(value) && value >= 0;
}
