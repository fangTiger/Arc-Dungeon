import { LEDGER_FAILURE_REASONS, normalizeRunId } from "./ledger.js";
import { RUN_TICKET_TOKEN_COST } from "./constants.js";
import {
  MAX_TICKET_INVESTMENT,
  MIN_TICKET_INVESTMENT,
} from "./tickets.js";
import { runTicketFailureMessage } from "./runEconomyTickets.js";

export async function requestRunStart({
  ledger,
  accountId,
  runId,
  createRun,
  ticketCost = RUN_TICKET_TOKEN_COST,
  ticketCount = MIN_TICKET_INVESTMENT,
} = {}) {
  const normalizedRunId = normalizeRunId(runId);
  if (!ledger || !normalizedRunId || typeof createRun !== "function") {
    return failure(LEDGER_FAILURE_REASONS.INVALID_INPUT, {
      run: null,
      message: "无法创建 run：参数不完整",
    });
  }

  const ticketPreflight = await checkRunTicketAvailability({ ledger, accountId, ticketCount });
  if (!ticketPreflight.ok) {
    return ticketPreflight;
  }

  const createdRun = createRunSafely(createRun);
  if (!createdRun.ok) {
    return createdRun;
  }

  const payment = await payRunTicketIfNeeded({ ledger, accountId, runId: normalizedRunId, ticketCost });
  if (!payment.ok) {
    return failure(payment.reason, {
      run: null,
      balance: payment.balance,
      required: payment.required ?? ticketCost,
      message: ticketFailureMessage(payment, ticketCost),
    });
  }

  const investment = await ledger.consumeRunTickets({ accountId, runId: normalizedRunId, count: ticketCount });
  if (!investment.ok) {
    return failure(investment.reason, {
      run: null,
      balance: payment.balance,
      profile: investment.profile,
      required: investment.required ?? ticketCount,
      message: runTicketFailureMessage(investment, ticketCount),
    });
  }

  return {
    ok: true,
    runId: normalizedRunId,
    run: { ...createdRun.run, runId: normalizedRunId, ticketInvestment: investment.modifiers },
    balance: payment.balance,
    profile: investment.profile,
    ticketCost,
    ticketInvestment: investment.modifiers,
  };
}

async function checkRunTicketAvailability({ ledger, accountId, ticketCount }) {
  const count = Number.isInteger(ticketCount) ? ticketCount : null;
  if (count === null || count < MIN_TICKET_INVESTMENT) {
    return ticketFailure("invalid-ticket-count", ticketCount);
  }

  if (count > MAX_TICKET_INVESTMENT) {
    return ticketFailure("ticket-investment-limit", count);
  }

  const profile = await ledger.getProfile(accountId);
  if (!profile.ok) {
    return failure(profile.reason, { run: null, message: profile.message ?? "无法读取门票状态" });
  }

  if ((profile.profile?.tickets ?? 0) < count) {
    return ticketFailure("insufficient-tickets", count, profile.profile);
  }

  return { ok: true };
}

function ticketFailure(reason, count, profile = null) {
  return failure(reason, {
    run: null,
    profile,
    required: count,
    message: runTicketFailureMessage({ reason }, count),
  });
}

function createRunSafely(createRun) {
  try {
    const run = createRun();
    return isRecord(run)
      ? { ok: true, run }
      : failure(LEDGER_FAILURE_REASONS.INVALID_INPUT, { run: null, message: "无法创建 run：结果无效" });
  } catch (error) {
    return failure(LEDGER_FAILURE_REASONS.INVALID_INPUT, {
      run: null,
      message: error instanceof Error ? error.message : "无法创建 run",
    });
  }
}

async function payRunTicketIfNeeded({ ledger, accountId, runId, ticketCost }) {
  if (Number.isFinite(ticketCost) && ticketCost > 0) {
    return ledger.payTicket({ accountId, runId, amount: ticketCost });
  }

  const balance = await ledger.getBalance(accountId);
  return balance.ok ? { ok: true, applied: false, balance: balance.balance } : balance;
}

function ticketFailureMessage(payment, ticketCost) {
  if (payment.reason === "insufficient-balance") {
    return `Token 不足，需要 ${payment.required ?? ticketCost} Token`;
  }

  return "门票支付失败";
}

function failure(reason, fields = {}) {
  return { ok: false, reason, ...fields };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
