import {
  LEDGER_FAILURE_REASONS,
  ledgerFailure,
  ledgerSuccess,
} from "./ledger.js";
import {
  operationConflict,
  readAccountBalance,
  readAccountProfile,
} from "./mockLedgerHelpers.js";
import { setTicketStateOnProfile } from "./profile.js";
import {
  buyTicketsWithTokens,
  claimDailyTickets as claimDailyTicketState,
  consumeTicketsForRun,
  normalizeTicketInvestmentModifiersSnapshot,
} from "./tickets.js";

export function claimDailyTicketsInLedgerState({ state, accountId, now }) {
  const profile = readAccountProfile(state, accountId);
  const result = claimDailyTicketState(profile, now);

  if (!result.ok) {
    return ledgerFailure(LEDGER_FAILURE_REASONS.INVALID_INPUT, {
      message: "claimDailyTickets 需要有效日期",
    });
  }

  const nextProfile = setTicketStateOnProfile(profile, result.state);
  state.profiles[accountId] = nextProfile;

  return ledgerSuccess({
    applied: result.claimed === true,
    claimed: result.claimed,
    granted: result.granted,
    profile: nextProfile,
  });
}

export function buyTicketsInLedgerState({ state, accountId, defaultBalance, count }) {
  const balance = readAccountBalance(state, accountId, defaultBalance);
  const profile = readAccountProfile(state, accountId);
  const result = buyTicketsWithTokens({
    tokens: balance.tokens,
    tickets: profile.tickets,
  }, count);

  if (!result.ok) {
    return ledgerFailure(result.reason, {
      balance,
      profile,
      required: result.required,
      cost: result.required,
    });
  }

  const nextBalance = { tokens: result.state.tokens };
  const nextProfile = setTicketStateOnProfile(profile, result.state);
  state.accounts[accountId] = nextBalance;
  state.profiles[accountId] = nextProfile;

  return ledgerSuccess({
    applied: true,
    purchased: result.purchased,
    cost: result.cost,
    balance: nextBalance,
    profile: nextProfile,
  });
}

export function consumeRunTicketsInLedgerState({ state, accountId, runId, count }) {
  const existing = state.ticketInvestments[runId];
  if (existing) {
    if (existing.accountId !== accountId || existing.count !== count) {
      return operationConflict("runId 已用于不同门票投入");
    }

    return ledgerSuccess({
      applied: false,
      idempotent: true,
      spent: existing.count,
      modifiers: normalizeTicketInvestmentModifiersSnapshot(existing.modifiers, existing.count),
      profile: readAccountProfile(state, accountId),
    });
  }

  const profile = readAccountProfile(state, accountId);
  const result = consumeTicketsForRun(profile, count);

  if (!result.ok) {
    return ledgerFailure(result.reason, {
      profile,
      required: count,
    });
  }

  const nextProfile = setTicketStateOnProfile(profile, result.state);
  state.profiles[accountId] = nextProfile;
  state.ticketInvestments[runId] = {
    accountId,
    count: result.spent,
    modifiers: result.modifiers,
  };

  return ledgerSuccess({
    applied: true,
    spent: result.spent,
    modifiers: result.modifiers,
    profile: nextProfile,
  });
}
