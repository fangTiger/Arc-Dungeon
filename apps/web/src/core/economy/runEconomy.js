import { LEDGER_FAILURE_REASONS, normalizeRunId } from "./ledger.js";
import { SKIN_BOX_TOKEN_COST } from "./constants.js";
import { calculateRunRewards } from "../run/scoring.js";
import { explorationRate } from "../run/runState.js";
import { createRunBag, settleRunBag } from "../run/runBag.js";
import { normalizeRunSummary } from "./profile.js";

export { requestRunStart } from "./runEconomyStart.js";
export {
  buyTicketsForAccount,
  claimDailyTicketsForAccount,
} from "./runEconomyTickets.js";

export async function settleRunEconomy({ ledger, accountId, run, runId = run?.runId } = {}) {
  const normalizedRunId = normalizeRunId(runId);
  const summary = createRunSummary(run);

  if (!ledger || !normalizedRunId || !summary) {
    return failure(LEDGER_FAILURE_REASONS.INVALID_INPUT, {
      message: "无法结算 run：参数不完整",
    });
  }

  const settlementDetails = calculateSettlementRewards(run, summary);
  const rewards = settlementDetails.rewards;
  const settlement = await ledger.settleRun({ accountId, runId: normalizedRunId, rewards });

  if (!settlement.ok) {
    return failure(settlement.reason, { summary, rewards, message: "结算发奖失败" });
  }

  const proof = await ledger.recordRunProof({
    accountId,
    runId: normalizedRunId,
    proof: createRunProof(run, summary, rewards),
  });

  if (!proof.ok) {
    return failure(proof.reason, { summary, rewards, balance: settlement.balance });
  }

  const profile = await ledger.recordRunProfile({ accountId, runId: normalizedRunId, summary });

  if (!profile.ok) {
    return failure(profile.reason, { summary, rewards, balance: settlement.balance });
  }

  return {
    ok: true,
    runId: normalizedRunId,
    applied: settlement.applied === true,
    idempotent: settlement.idempotent === true,
    ...summary,
    rewards,
    bagSettlement: settlementDetails.bagSettlement,
    balance: settlement.balance,
    profile: profile.profile,
  };
}

export async function getEconomySnapshot({ ledger, accountId } = {}) {
  const balance = await ledger.getBalance(accountId);
  const profile = await ledger.getProfile(accountId);

  return {
    ok: balance.ok && profile.ok,
    balance: balance.balance,
    profile: profile.profile,
    progressWillNotPersist: ledger.persistenceUnavailable === true,
  };
}

export async function refreshEconomySnapshotState({
  previousSnapshot = null,
  readSnapshot,
} = {}) {
  if (typeof readSnapshot !== "function") {
    return {
      snapshot: previousSnapshot,
      readFailed: false,
      message: "",
    };
  }

  try {
    return {
      snapshot: await readSnapshot(),
      readFailed: false,
      message: "",
    };
  } catch {
    return {
      snapshot: previousSnapshot,
      readFailed: true,
      message: "数据读取失败，重试中",
    };
  }
}

export async function craftSkinForAccount({ ledger, accountId } = {}) {
  const result = await ledger.craftSkin({ accountId });

  if (!result.ok) {
    const missingTokens = Math.max(0, SKIN_BOX_TOKEN_COST - (result.tokens ?? 0));

    return failure(result.reason, {
      tokens: result.tokens ?? 0,
      required: result.required ?? SKIN_BOX_TOKEN_COST,
      missingTokens,
      message: `Token 不足，还差 ${missingTokens}`,
    });
  }

  return {
    ok: true,
    applied: result.applied === true,
    balance: result.balance,
    profile: result.profile,
    skin: result.skin,
    cost: result.cost,
    message: `盲盒开启成功：${result.skin.name}（${result.skin.rarityLabel}）`,
  };
}

export async function exchangeSkinBoxForAccount({ ledger, accountId } = {}) {
  const result = await ledger.exchangeSkinBox({ accountId });

  if (!result.ok) {
    const missingTokens = Math.max(0, SKIN_BOX_TOKEN_COST - (result.tokens ?? 0));

    return failure(result.reason, {
      tokens: result.tokens ?? 0,
      required: result.required ?? SKIN_BOX_TOKEN_COST,
      missingTokens,
      message: `Token 不足，还差 ${missingTokens}`,
    });
  }

  return {
    ok: true,
    applied: result.applied === true,
    balance: result.balance,
    profile: result.profile,
    box: result.box,
    cost: result.cost,
    message: "盲盒兑换成功",
  };
}

export async function openSkinBoxForAccount({ ledger, accountId } = {}) {
  const result = await ledger.openSkinBox({ accountId });

  if (!result.ok) {
    return failure(result.reason, {
      tokens: result.tokens ?? 0,
      boxCount: result.boxCount ?? 0,
      message: result.message ?? "没有可开启的盲盒",
    });
  }

  return {
    ok: true,
    applied: result.applied === true,
    balance: result.balance,
    profile: result.profile,
    skin: result.skin,
    cost: result.cost,
    message: `盲盒开启成功：${result.skin.name}（${result.skin.rarityLabel}）`,
  };
}

function calculateSettlementRewards(run, summary) {
  if (run?.bag) {
    const reason = run.settlementReason ?? run.endReason ?? "evacuated";
    const bag = createRunBag(run.bag);
    const bagSettlement = settleRunBag({
      bag,
      reason,
      explorationRate: summary.explorationRate,
    });

    return {
      rewards: {
        tokens: bagSettlement.creditedTokens,
      },
      bagSettlement: {
        bagTokens: bag.tokens,
        creditedTokens: bagSettlement.creditedTokens,
        retentionRate: bagSettlement.retentionRate,
        explorationMultiplier: bagSettlement.explorationMultiplier,
        reason,
      },
    };
  }

  return {
    rewards: calculateRunRewards(summary),
    bagSettlement: null,
  };
}

function createRunSummary(run) {
  if (!run) {
    return null;
  }

  return normalizeRunSummary({
    depthReached: run.depth,
    bossesDefeated: run.stats?.bossesDefeated,
    explorationRate: explorationRate(run),
  });
}

function createRunProof(run, summary, rewards) {
  return {
    runId: run.runId,
    seed: run.seed,
    heroClass: run.heroClass,
    ...summary,
    rewards,
  };
}

function failure(reason, fields = {}) {
  return {
    ok: false,
    reason,
    ...fields,
  };
}
