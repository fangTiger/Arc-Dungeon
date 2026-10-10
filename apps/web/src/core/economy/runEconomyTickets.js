export async function claimDailyTicketsForAccount({ ledger, accountId, now } = {}) {
  const result = await ledger.claimDailyTickets({ accountId, now });

  if (!result.ok) {
    return failure(result.reason, {
      message: result.message ?? "每日门票领取失败",
    });
  }

  return {
    ok: true,
    applied: result.applied === true,
    claimed: result.claimed === true,
    granted: result.granted ?? 0,
    profile: result.profile,
    message: result.claimed ? `领取 ${result.granted ?? 0} 张门票` : "明日可领",
  };
}

export async function buyTicketsForAccount({ ledger, accountId, count = 1 } = {}) {
  const result = await ledger.buyTickets({ accountId, count });

  if (!result.ok) {
    return failure(result.reason, {
      balance: result.balance,
      profile: result.profile,
      required: result.required,
      message: buyTicketFailureMessage(result),
    });
  }

  return {
    ok: true,
    applied: result.applied === true,
    purchased: result.purchased ?? count,
    cost: result.cost,
    balance: result.balance,
    profile: result.profile,
    message: `购买 ${result.purchased ?? count} 张门票`,
  };
}

export function runTicketFailureMessage(result, ticketCount) {
  if (result.reason === "insufficient-tickets") {
    return `门票不足，需要 ${ticketCount} 张`;
  }

  if (result.reason === "ticket-investment-limit") {
    return "单次最多投入 10 张门票";
  }

  if (result.reason === "invalid-ticket-count") {
    return "门票投入必须至少 1 张";
  }

  return "门票支付失败";
}

function buyTicketFailureMessage(result) {
  if (result.reason === "insufficient-tokens") {
    return "Token 不足，无法购买门票";
  }

  if (result.reason === "ticket-cap-reached") {
    return "门票已达上限";
  }

  return result.message ?? "购买门票失败";
}

function failure(reason, fields = {}) {
  return {
    ok: false,
    reason,
    ...fields,
  };
}
