import { createPlayerBaseStats } from "./classes.js";

export function applyBuildBonusesToPlayer(player, bonuses = {}) {
  const baseStats = createPlayerBaseStats(player.classId ?? "knight");
  const previousMaxHp =
    Number.isFinite(player.maxHp) && player.maxHp > 0 ? player.maxHp : baseStats.maxHp;
  const hpRatio = clamp01(clampHp(player.hp, previousMaxHp) / previousMaxHp);
  const nextMaxHp = Math.max(1, Math.round(baseStats.maxHp * safeMultiplier(bonuses.maxHpMultiplier)));

  return {
    ...player,
    maxHp: nextMaxHp,
    hp: Math.round(nextMaxHp * hpRatio),
    attack: roundStat(baseStats.attack * safeMultiplier(bonuses.damageMultiplier)),
    defense: roundStat(baseStats.defense * safeMultiplier(bonuses.defenseMultiplier)),
    critRate: clamp01(baseStats.critRate + (bonuses.critRateBonus ?? 0)),
    critMultiplier: baseStats.critMultiplier,
    incomingDamageMultiplier: safeMultiplier(bonuses.incomingDamageMultiplier),
    movementMultiplier: safeMultiplier(bonuses.movementMultiplier),
    staminaRegenMultiplier: safeMultiplier(bonuses.staminaRegenMultiplier),
    cooldownMultiplier: safeMultiplier(bonuses.cooldownMultiplier),
    sustainMultiplier: safeMultiplier(bonuses.sustainMultiplier),
  };
}

function clampHp(value, maxHp) {
  const fallback = Number.isFinite(maxHp) ? maxHp : 1;
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(fallback, value));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function safeMultiplier(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 1;
}

function roundStat(value) {
  return Math.round(value * 1000) / 1000;
}
