export const ATTACK_DODGE_CANCEL_MS = 150;
export const DASH_SLASH_WINDOW_MS = 250;
export const DASH_SLASH_DAMAGE_MULTIPLIER = 1.6;
export const SKILL_FOLLOW_UP_WINDOW_MS = 600;
export const SKILL_FOLLOW_UP_DAMAGE_MULTIPLIER = 1.35;

const EMPTY_COMBO_STATE = Object.freeze({
  lastAttackStartedAt: -Infinity,
  dodgeStartedAt: -Infinity,
  dodgeUntil: -Infinity,
  lastDodgeEndedAt: -Infinity,
  lastDashSlashConsumedAt: -Infinity,
  lastSkillHitAt: -Infinity,
});

export function createComboState(overrides = {}) {
  return {
    ...EMPTY_COMBO_STATE,
    ...overrides,
  };
}

export function reduceComboState(state = createComboState(), event = {}, now) {
  const current = createComboState(state);
  const timestamp = safeTime(now);

  switch (event.type) {
    case "attackStarted":
      return {
        ...current,
        lastAttackStartedAt: timestamp,
      };

    case "dodgeStarted": {
      const durationMs = Math.max(0, Math.round(event.durationMs ?? 0));

      return {
        ...current,
        dodgeStartedAt: timestamp,
        dodgeUntil: timestamp + durationMs,
        lastDodgeEndedAt: timestamp + durationMs,
      };
    }

    case "dodgeEnded":
      return {
        ...current,
        dodgeUntil: timestamp,
        lastDodgeEndedAt: timestamp,
      };

    case "dashSlashConsumed":
      return {
        ...current,
        lastDashSlashConsumedAt: timestamp,
      };

    case "skillHit":
      return {
        ...current,
        lastSkillHitAt: timestamp,
      };

    default:
      return current;
  }
}

export function canDodgeCancelAttack(state, now) {
  const attackStartedAt = state?.lastAttackStartedAt;
  if (!Number.isFinite(attackStartedAt)) {
    return false;
  }

  return safeTime(now) - attackStartedAt >= ATTACK_DODGE_CANCEL_MS;
}

export function canPerformActionDuringRecovery(state, {
  action,
  attackRecoveryUntil,
  now,
} = {}) {
  const timestamp = safeTime(now);
  const recoveryUntil = Number.isFinite(attackRecoveryUntil) ? attackRecoveryUntil : 0;

  if (timestamp >= recoveryUntil) {
    return true;
  }

  if (action === "dodge") {
    return canDodgeCancelAttack(state, timestamp);
  }

  if (action === "attack") {
    return isWithinDashSlashWindow(state, timestamp);
  }

  return false;
}

export function resolveComboAttack(state, { baseDamage, now } = {}) {
  const damage = safeDamage(baseDamage);
  const timestamp = safeTime(now);
  const isDashSlash = isWithinDashSlashWindow(state, timestamp);
  const hasSkillFollowUp = isWithinSkillFollowUpWindow(state, timestamp);
  const multiplier =
    (isDashSlash ? DASH_SLASH_DAMAGE_MULTIPLIER : 1)
    * (hasSkillFollowUp ? SKILL_FOLLOW_UP_DAMAGE_MULTIPLIER : 1);

  return {
    damage: roundDamage(damage * multiplier),
    multiplier: roundDamage(multiplier),
    isDashSlash,
    hasSkillFollowUp,
    lunge: isDashSlash,
  };
}

export function isWithinDashSlashWindow(state, now) {
  const timestamp = safeTime(now);
  const dodgeUntil = state?.dodgeUntil ?? -Infinity;
  const lastDodgeEndedAt = state?.lastDodgeEndedAt ?? -Infinity;
  const dodgeStartedAt = state?.dodgeStartedAt ?? -Infinity;
  const consumedAt = state?.lastDashSlashConsumedAt ?? -Infinity;

  if (Number.isFinite(consumedAt) && consumedAt >= dodgeStartedAt) {
    return false;
  }

  if (timestamp <= dodgeUntil) {
    return true;
  }

  const endedAt = Math.max(dodgeUntil, lastDodgeEndedAt);
  return Number.isFinite(endedAt) && timestamp - endedAt <= DASH_SLASH_WINDOW_MS;
}

export function isWithinSkillFollowUpWindow(state, now) {
  const skillHitAt = state?.lastSkillHitAt;
  if (!Number.isFinite(skillHitAt)) {
    return false;
  }

  const elapsed = safeTime(now) - skillHitAt;
  return elapsed >= 0 && elapsed <= SKILL_FOLLOW_UP_WINDOW_MS;
}

function safeTime(value) {
  if (!Number.isFinite(value)) {
    throw new RangeError("连招时间必须由调用方注入为有限数字");
  }

  return value;
}

function safeDamage(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function roundDamage(value) {
  return Math.round(value * 1000) / 1000;
}
