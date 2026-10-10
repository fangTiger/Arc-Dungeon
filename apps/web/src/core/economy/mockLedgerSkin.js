import {
  LEDGER_FAILURE_REASONS,
  ledgerFailure,
  ledgerSuccess,
  normalizeAccountId,
} from "./ledger.js";
import { createRng, hashSeed } from "../rng.js";
import {
  addSkinBoxToProfile,
  markHudHintSeenOnProfile,
  openSkinBoxOnProfile,
  setEquippedSkinOnProfile,
} from "./profile.js";
import {
  invalidInput,
  readAccountBalance,
  readAccountProfile,
} from "./mockLedgerHelpers.js";
import {
  exchangeSkinBox,
  openSkinBox,
} from "./skins.js";

export function exchangeSkinBoxInLedgerState({ state, accountId, defaultBalance }) {
  const balance = readAccountBalance(state, accountId, defaultBalance);
  const profile = readAccountProfile(state, accountId);
  const result = exchangeSkinBox({
    tokens: balance.tokens,
    boxCount: profile.skinBoxes,
    rng: createRng(hashSeed(`${accountId}:box:${profile.skinBoxes}:${profile.craftCount}`)),
  });

  if (!result.ok) {
    return ledgerFailure(LEDGER_FAILURE_REASONS.INSUFFICIENT_BALANCE, {
      tokens: result.tokens,
      required: result.required,
    });
  }

  const nextBalance = { tokens: result.remainingTokens };
  const nextProfile = addSkinBoxToProfile(profile);

  state.accounts[accountId] = nextBalance;
  state.profiles[accountId] = nextProfile;

  return ledgerSuccess({
    applied: true,
    balance: nextBalance,
    profile: nextProfile,
    box: result.box,
    cost: result.cost,
  });
}

export function openSkinBoxInLedgerState({ state, accountId, defaultBalance }) {
  const balance = readAccountBalance(state, accountId, defaultBalance);
  const profile = readAccountProfile(state, accountId);
  const result = openSkinBox({
    tokens: balance.tokens,
    boxCount: profile.skinBoxes,
    rng: createRng(hashSeed(`${accountId}:open:${profile.craftCount}`)),
  });

  if (!result.ok) {
    return ledgerFailure(LEDGER_FAILURE_REASONS.INVALID_INPUT, {
      tokens: result.tokens,
      boxCount: result.boxCount,
      message: "没有可开启的盲盒",
    });
  }

  const nextProfile = openSkinBoxOnProfile(profile, result.skin);

  state.profiles[accountId] = nextProfile;

  return ledgerSuccess({
    applied: true,
    balance,
    profile: nextProfile,
    skin: result.skin,
    cost: 0,
  });
}

export function craftSkinInLedgerState({ state, accountId, defaultBalance }) {
  const exchanged = exchangeSkinBoxInLedgerState({ state, accountId, defaultBalance });
  if (!exchanged.ok) {
    return exchanged;
  }

  const opened = openSkinBoxInLedgerState({ state, accountId, defaultBalance });
  return opened.ok
    ? ledgerSuccess({
        ...opened,
        balance: readAccountBalance(state, accountId, defaultBalance),
        cost: exchanged.cost,
      })
    : opened;
}

export function setEquippedSkinInLedgerState({ state, accountId, skinId }) {
  const profile = readAccountProfile(state, accountId);
  const normalizedSkinId = normalizeEquippedSkinInput(skinId);

  if (normalizedSkinId === undefined) {
    return ledgerFailure(LEDGER_FAILURE_REASONS.INVALID_INPUT, {
      profile,
      message: "服饰 ID 不合法",
    });
  }

  const nextProfile = setEquippedSkinOnProfile(profile, normalizedSkinId);

  if (normalizedSkinId !== null && nextProfile.equippedSkinId !== normalizedSkinId) {
    return ledgerFailure(LEDGER_FAILURE_REASONS.INVALID_INPUT, {
      profile,
      skinId: normalizedSkinId,
      message: "尚未拥有该服饰",
    });
  }

  state.profiles[accountId] = nextProfile;

  return ledgerSuccess({
    applied: true,
    profile: nextProfile,
  });
}

export function markHudHintSeenInLedgerState({ state, accountId }) {
  const profile = readAccountProfile(state, accountId);
  const nextProfile = markHudHintSeenOnProfile(profile);

  state.profiles[accountId] = nextProfile;

  return ledgerSuccess({
    applied: true,
    profile: nextProfile,
  });
}

export function runSkinAssetOperation({
  accountIdOrOptions,
  controller,
  defaultBalance,
  operationName,
  operation,
}) {
  const accountId = typeof accountIdOrOptions === "string" ? accountIdOrOptions : accountIdOrOptions.accountId;
  const normalizedAccountId = normalizeAccountId(accountId);

  if (!normalizedAccountId) {
    return invalidInput(`${operationName} 需要 accountId`);
  }

  const state = controller.readState();
  const result = operation({
    state,
    accountId: normalizedAccountId,
    defaultBalance,
  });
  if (result.ok) {
    controller.writeState(state);
  }
  return result;
}

function normalizeEquippedSkinInput(skinId) {
  if (skinId === null) {
    return null;
  }

  if (typeof skinId !== "string") {
    return undefined;
  }

  const normalized = skinId.trim();
  return normalized.length > 0 ? normalized : undefined;
}
