import {
  LEDGER_FAILURE_REASONS,
  ledgerFailure,
  ledgerSuccess,
} from "./ledger.js";
import { cloneLedgerJson } from "./mockLedgerStorage.js";
import {
  normalizeSettlementRewards,
  payTicketIdempotentResult,
  profileRunIdempotentResult,
  proofIdempotentResult,
  readAccountBalance,
  readAccountProfile,
  serializeProof,
  settleRunIdempotentResult,
} from "./mockLedgerHelpers.js";
import {
  applyRunSummaryToProfile,
  normalizeRunSummary,
  setHeroIdentityOnProfile,
} from "./profile.js";

export function payTicketInLedgerState({ state, accountId, runId, amount, defaultBalance }) {
  const existing = state.ticketPayments[runId];
  if (existing) {
    return payTicketIdempotentResult({ existing, accountId, amount, state, defaultBalance });
  }

  const balance = readAccountBalance(state, accountId, defaultBalance);
  if (balance.tokens < amount) {
    return ledgerFailure(LEDGER_FAILURE_REASONS.INSUFFICIENT_BALANCE, {
      balance,
      required: amount,
    });
  }

  const nextBalance = { tokens: balance.tokens - amount };
  state.accounts[accountId] = nextBalance;
  state.ticketPayments[runId] = { accountId, amount };

  return ledgerSuccess({
    applied: true,
    balance: nextBalance,
  });
}

export function settleRunInLedgerState({ state, accountId, runId, rewards, defaultBalance }) {
  const normalizedRewards = normalizeSettlementRewards(rewards);
  if (normalizedRewards === null) {
    return null;
  }

  const existing = state.settledRuns[runId];
  if (existing) {
    return settleRunIdempotentResult({ existing, accountId, rewards: normalizedRewards, state, defaultBalance });
  }

  const balance = readAccountBalance(state, accountId, defaultBalance);
  const nextBalance = { tokens: balance.tokens + normalizedRewards.tokens };
  state.accounts[accountId] = nextBalance;
  state.settledRuns[runId] = { accountId, rewards: normalizedRewards };

  return ledgerSuccess({
    applied: true,
    balance: nextBalance,
  });
}

export function recordRunProofInLedgerState({ state, accountId, runId, proof }) {
  const serializedProof = serializeProof(proof);
  if (serializedProof === null) {
    return null;
  }

  const proofRecord = JSON.parse(serializedProof);
  const existing = state.runProofs[runId];
  if (existing) {
    return proofIdempotentResult({ existing, accountId, serializedProof });
  }

  state.runProofs[runId] = {
    accountId,
    proof: proofRecord,
    proofJson: serializedProof,
  };

  return ledgerSuccess({
    applied: true,
    proof: cloneLedgerJson(proofRecord),
  });
}

export function recordRunProfileInLedgerState({ state, accountId, runId, summary }) {
  const normalizedSummary = normalizeRunSummary(summary);
  if (!normalizedSummary) {
    return null;
  }

  const existing = state.profileRuns[runId];
  if (existing) {
    return profileRunIdempotentResult({ existing, accountId, summary: normalizedSummary, state });
  }

  const profile = applyRunSummaryToProfile(readAccountProfile(state, accountId), normalizedSummary);
  state.profiles[accountId] = profile;
  state.profileRuns[runId] = { accountId, summary: normalizedSummary };

  return ledgerSuccess({
    applied: true,
    profile,
  });
}

export function setProfileIdentityInLedgerState({ state, accountId, identity }) {
  const profile = setHeroIdentityOnProfile(readAccountProfile(state, accountId), identity);
  if (!profile.heroIdentity) {
    return null;
  }

  state.profiles[accountId] = profile;

  return ledgerSuccess({
    applied: true,
    profile,
  });
}
