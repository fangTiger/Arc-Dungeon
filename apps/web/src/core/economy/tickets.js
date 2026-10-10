export const DAILY_FREE_TICKETS = 10;
export const MAX_TICKET_HOLDINGS = 100;
export const MIN_TICKET_INVESTMENT = 1;
export const MAX_TICKET_INVESTMENT = 10;
export const EXTRA_TICKET_TOKEN_COST = 25;

/*
 * 纯前端只能按传入时间计算每日领取，无法防止玩家修改系统时间作弊。
 * 真实防作弊需要由服务端签发日期、领取记录和门票余额。
 */

export function claimDailyTickets(state = {}, now = new Date()) {
  const current = normalizeTicketState(state);
  const unchanged = cloneTicketState(state);
  const claimDate = utcDateKey(now);

  if (!claimDate) {
    return failure("invalid-now", unchanged);
  }

  if (current.lastDailyTicketClaimDate === claimDate) {
    return {
      ok: true,
      claimed: false,
      granted: 0,
      state: current,
    };
  }

  const granted = Math.max(0, Math.min(DAILY_FREE_TICKETS, MAX_TICKET_HOLDINGS - current.tickets));

  return {
    ok: true,
    claimed: true,
    granted,
    state: {
      ...current,
      tickets: current.tickets + granted,
      lastDailyTicketClaimDate: claimDate,
    },
  };
}

export function ticketInvestmentModifiers(count) {
  const normalizedCount = normalizeInvestmentCount(count);

  if (normalizedCount === null) {
    throw new RangeError("门票投入张数必须是 1 到 10 的整数");
  }

  return {
    count: normalizedCount,
    lootMultiplier: roundMultiplier(normalizedCount * (1 + (normalizedCount - 1) * 0.05)),
    difficultyMultiplier: roundMultiplier(1 + (normalizedCount - 1) * 0.4),
  };
}

export function normalizeTicketInvestmentModifiersSnapshot(value, fallbackCount = null) {
  if (!isRecord(value)) {
    return null;
  }

  const count = Number.isInteger(value.count) ? value.count : fallbackCount;
  if (normalizeInvestmentCount(count) === null) {
    return null;
  }

  if (!Number.isFinite(value.lootMultiplier) || !Number.isFinite(value.difficultyMultiplier)) {
    return null;
  }

  return {
    count,
    lootMultiplier: Math.max(0, value.lootMultiplier),
    difficultyMultiplier: Math.max(0, value.difficultyMultiplier),
  };
}

export function consumeTicketsForRun(state = {}, count = MIN_TICKET_INVESTMENT) {
  const current = normalizeTicketState(state);
  const unchanged = cloneTicketState(state);
  const normalizedCount = Number.isInteger(count) ? count : null;

  if (normalizedCount === null || normalizedCount < MIN_TICKET_INVESTMENT) {
    return failure("invalid-ticket-count", unchanged);
  }

  if (normalizedCount > MAX_TICKET_INVESTMENT) {
    return failure("ticket-investment-limit", unchanged);
  }

  if (normalizedCount > current.tickets) {
    return failure("insufficient-tickets", unchanged);
  }

  return {
    ok: true,
    spent: normalizedCount,
    state: {
      ...current,
      tickets: current.tickets - normalizedCount,
    },
    modifiers: ticketInvestmentModifiers(normalizedCount),
  };
}

export function buyTicketsWithTokens(state = {}, count = 1) {
  const current = normalizeTicketState(state);
  const unchanged = cloneTicketState(state);
  const normalizedCount = Number.isInteger(count) ? count : null;

  if (normalizedCount === null || normalizedCount < 1) {
    return failure("invalid-ticket-count", unchanged);
  }

  if (current.tickets >= MAX_TICKET_HOLDINGS || current.tickets + normalizedCount > MAX_TICKET_HOLDINGS) {
    return failure("ticket-cap-reached", unchanged);
  }

  const cost = normalizedCount * EXTRA_TICKET_TOKEN_COST;

  if (current.tokens < cost) {
    return failure("insufficient-tokens", unchanged, { required: cost });
  }

  return {
    ok: true,
    cost,
    purchased: normalizedCount,
    state: {
      ...current,
      tokens: current.tokens - cost,
      tickets: current.tickets + normalizedCount,
    },
  };
}

export function normalizeTicketState(state = {}) {
  const source = isRecord(state) ? state : {};
  const normalized = {
    ...source,
    tokens: normalizeNonNegativeInteger(source.tokens),
    tickets: Math.min(MAX_TICKET_HOLDINGS, normalizeNonNegativeInteger(source.tickets)),
  };
  const claimDate = normalizeDateKey(source.lastDailyTicketClaimDate);

  if (claimDate) {
    normalized.lastDailyTicketClaimDate = claimDate;
  } else {
    delete normalized.lastDailyTicketClaimDate;
  }

  return normalized;
}

function failure(reason, state, fields = {}) {
  return {
    ok: false,
    reason,
    ...fields,
    state,
  };
}

function cloneTicketState(state) {
  return isRecord(state) ? { ...state } : {};
}

function normalizeInvestmentCount(count) {
  if (!Number.isInteger(count) || count < MIN_TICKET_INVESTMENT || count > MAX_TICKET_INVESTMENT) {
    return null;
  }

  return count;
}

function utcDateKey(now) {
  const date = now instanceof Date ? new Date(now.getTime()) : new Date(now);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function normalizeDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeNonNegativeInteger(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function roundMultiplier(value) {
  return Number(value.toFixed(6));
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
