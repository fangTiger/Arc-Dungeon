import test from "node:test";
import assert from "node:assert/strict";

import {
  DAILY_FREE_TICKETS,
  EXTRA_TICKET_TOKEN_COST,
  MAX_TICKET_HOLDINGS,
  MAX_TICKET_INVESTMENT,
  buyTicketsWithTokens,
  claimDailyTickets,
  consumeTicketsForRun,
  ticketInvestmentModifiers,
} from "../apps/web/src/core/economy/tickets.js";

test("claimDailyTickets 同 UTC 日重复领取无效，跨 UTC 日可再领", () => {
  const first = claimDailyTickets({ tickets: 0 }, "2026-08-10T23:30:00Z");
  const repeated = claimDailyTickets(first.state, "2026-08-10T23:59:59Z");
  const nextDay = claimDailyTickets(repeated.state, "2026-08-11T00:00:00Z");

  assert.equal(first.ok, true);
  assert.equal(first.granted, DAILY_FREE_TICKETS);
  assert.equal(first.state.tickets, 10);
  assert.equal(repeated.claimed, false);
  assert.equal(repeated.granted, 0);
  assert.equal(repeated.state.tickets, 10);
  assert.equal(nextDay.claimed, true);
  assert.equal(nextDay.granted, DAILY_FREE_TICKETS);
  assert.equal(nextDay.state.tickets, 20);
});

test("claimDailyTickets 只按 UTC 日期判定且不会超过持有上限", () => {
  const state = { tickets: 95, lastDailyTicketClaimDate: "2026-08-09" };
  const result = claimDailyTickets(state, "2026-08-10T01:00:00+08:00");

  assert.equal(result.state.lastDailyTicketClaimDate, "2026-08-09");
  assert.equal(result.claimed, false);

  const utcNextDay = claimDailyTickets(state, "2026-08-10T00:00:00Z");

  assert.equal(utcNextDay.claimed, true);
  assert.equal(utcNextDay.granted, 5);
  assert.equal(utcNextDay.state.tickets, MAX_TICKET_HOLDINGS);
});

test("ticketInvestmentModifiers 投入 1 到 10 张时倍率单调不减", () => {
  let previous = ticketInvestmentModifiers(1);

  for (let count = 2; count <= MAX_TICKET_INVESTMENT; count += 1) {
    const current = ticketInvestmentModifiers(count);

    assert.equal(current.lootMultiplier >= previous.lootMultiplier, true);
    assert.equal(current.difficultyMultiplier >= previous.difficultyMultiplier, true);
    previous = current;
  }
});

test("ticketInvestmentModifiers 每张票产出单调不减且掉落至少等于投入", () => {
  let previousPerTicket = 0;

  for (let count = 1; count <= MAX_TICKET_INVESTMENT; count += 1) {
    const current = ticketInvestmentModifiers(count);
    const perTicket = current.lootMultiplier / count;

    assert.equal(perTicket >= previousPerTicket, true);
    assert.equal(current.lootMultiplier >= count, true);
    previousPerTicket = perTicket;
  }
});

test("ticketInvestmentModifiers 难度倍率随投入单调递增", () => {
  let previous = ticketInvestmentModifiers(1);

  for (let count = 2; count <= MAX_TICKET_INVESTMENT; count += 1) {
    const current = ticketInvestmentModifiers(count);

    assert.equal(current.difficultyMultiplier > previous.difficultyMultiplier, true);
    previous = current;
  }
});

test("consumeTicketsForRun 拒绝非法投入且状态不变", () => {
  const state = { tickets: 5, tokens: 200, lastDailyTicketClaimDate: "2026-08-10" };

  for (const count of [0, -1, 6, 11]) {
    const result = consumeTicketsForRun(state, count);

    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  }
});

test("consumeTicketsForRun 成功时扣票并返回投入倍率", () => {
  const result = consumeTicketsForRun({ tickets: 5 }, 3);

  assert.equal(result.ok, true);
  assert.equal(result.state.tickets, 2);
  assert.deepEqual(result.modifiers, {
    count: 3,
    lootMultiplier: 3.3,
    difficultyMultiplier: 1.8,
  });
});

test("buyTicketsWithTokens Token 不足或达上限时拒绝，成功时同步变化", () => {
  const poor = { tokens: EXTRA_TICKET_TOKEN_COST - 1, tickets: 0 };
  const capped = { tokens: 1000, tickets: MAX_TICKET_HOLDINGS };
  const success = { tokens: 100, tickets: 2 };

  const poorResult = buyTicketsWithTokens(poor, 1);
  const cappedResult = buyTicketsWithTokens(capped, 1);
  const successResult = buyTicketsWithTokens(success, 2);

  assert.equal(poorResult.ok, false);
  assert.deepEqual(poorResult.state, poor);
  assert.equal(cappedResult.ok, false);
  assert.deepEqual(cappedResult.state, capped);
  assert.equal(successResult.ok, true);
  assert.deepEqual(successResult.state, { tokens: 50, tickets: 4 });
});
