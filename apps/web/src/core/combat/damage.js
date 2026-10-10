import { difficultyForDepth } from "../dungeon/progression.js";

export const DEFENSE_MITIGATION_K = 7;

export function resolveDamage({
  attack,
  defense = 0,
  critRate = 0,
  critMultiplier = 1,
  damageMultiplier = 1,
  rng,
}) {
  if (!rng || typeof rng.next !== "function") {
    throw new TypeError("伤害结算必须传入 rng");
  }

  const baseDamage = damageAfterDefense(attack, defense);
  const isCrit = rng.next() < clamp(critRate, 0, 1);
  const multiplier = isCrit ? Math.max(1, critMultiplier) : 1;
  const safeDamageMultiplier = Number.isFinite(damageMultiplier)
    ? Math.max(0, damageMultiplier)
    : 1;

  return {
    damage: Math.max(1, Math.round(baseDamage * multiplier * safeDamageMultiplier)),
    isCrit,
  };
}

export function damageAfterDefense(attack, defense = 0) {
  const safeAttack = Number.isFinite(attack) ? Math.max(0, attack) : 0;

  return Math.max(1, safeAttack * defenseDamageMultiplier(defense));
}

export function defenseDamageMultiplier(defense = 0) {
  const safeDefense = Number.isFinite(defense) ? Math.max(0, defense) : 0;

  return DEFENSE_MITIGATION_K / (safeDefense + DEFENSE_MITIGATION_K);
}

export function applyDepthScaling(baseStats, depth) {
  const difficulty = difficultyForDepth(depth);
  const scaled = { ...baseStats };

  if (Number.isFinite(baseStats.maxHp)) {
    scaled.maxHp = scaleStat(baseStats.maxHp, difficulty.enemyHpScale);
  }

  if (Number.isFinite(baseStats.hp)) {
    scaled.hp = scaleStat(baseStats.hp, difficulty.enemyHpScale);
  }

  if (Number.isFinite(baseStats.baseHp)) {
    scaled.baseHp = scaleStat(baseStats.baseHp, difficulty.enemyHpScale);
  }

  if (Number.isFinite(baseStats.damage)) {
    scaled.damage = scaleStat(baseStats.damage, difficulty.enemyDamageScale);
  }

  if (Number.isFinite(baseStats.attack)) {
    scaled.attack = scaleStat(baseStats.attack, difficulty.enemyDamageScale);
  }

  return scaled;
}

function scaleStat(value, scale) {
  return Math.max(value, Math.round(value * scale));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
