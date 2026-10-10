export const POISE_REGEN_PER_SECOND = 1.2;
export const POISE_REGEN_DELAY_MS = 900;
export const POISE_BREAK_STUN_MS = 420;
export const POISE_BREAK_IMMUNE_MS = 600;
export const BOSS_MAX_POISE = 8;

export const POISE_COST_BY_SOURCE = Object.freeze({
  basic: 1,
  comboFinisher: 2,
  dashSlash: 2,
  skill: 3,
});

const NORMAL_MIN_POISE = 2;
const NORMAL_MAX_POISE = 6;
const MS_PER_SECOND = 1000;

export function maxPoiseForEnemy({ baseHp, maxHp, isBoss } = {}) {
  if (isBoss) {
    return BOSS_MAX_POISE;
  }

  const hpForPoise = Number.isFinite(baseHp) ? baseHp : maxHp;
  const tier = Math.round((Number.isFinite(hpForPoise) ? hpForPoise : 0) / 20);

  return clamp(tier, NORMAL_MIN_POISE, NORMAL_MAX_POISE);
}

export function createPoiseState(enemy = {}) {
  const maxPoise = maxPoiseForEnemy(enemy);

  return {
    poise: maxPoise,
    maxPoise,
    lastHitAt: -Infinity,
    breakImmuneUntil: 0,
  };
}

export function applyPoiseHit(state, { source = "basic", now } = {}) {
  const timestamp = safeTime(now);
  const maxPoise = normalizedMaxPoise(state);
  const poise = normalizedPoise(state?.poise, maxPoise);
  const breakImmuneUntil = safeTime(state?.breakImmuneUntil);

  if (timestamp < breakImmuneUntil) {
    return {
      ...state,
      poise,
      maxPoise,
      lastHitAt: timestamp,
      breakImmuneUntil,
      broken: false,
    };
  }

  const nextPoise = poise - poiseCostForSource(source);

  if (nextPoise <= 0) {
    return {
      ...state,
      poise: maxPoise,
      maxPoise,
      lastHitAt: timestamp,
      breakImmuneUntil: timestamp + POISE_BREAK_IMMUNE_MS,
      broken: true,
    };
  }

  return {
    ...state,
    poise: nextPoise,
    maxPoise,
    lastHitAt: timestamp,
    breakImmuneUntil,
    broken: false,
  };
}

export function regeneratePoise(state, { now } = {}) {
  const maxPoise = normalizedMaxPoise(state);
  const poise = normalizedPoise(state?.poise, maxPoise);

  if (poise >= maxPoise) {
    return { ...state, poise: maxPoise, maxPoise };
  }

  const timestamp = safeTime(now);
  const lastHitAt = safeTime(state?.lastHitAt);
  const regenStartAt = lastHitAt + POISE_REGEN_DELAY_MS;

  if (timestamp < regenStartAt) {
    return { ...state, poise, maxPoise, lastHitAt };
  }

  const recovered = ((timestamp - regenStartAt) / MS_PER_SECOND) * POISE_REGEN_PER_SECOND;
  const nextPoise = Math.min(maxPoise, poise + recovered);

  return {
    ...state,
    poise: nextPoise,
    maxPoise,
    // 回复按帧增量推进，避免每帧重复累计同一段回复时间。
    lastHitAt: timestamp - POISE_REGEN_DELAY_MS,
  };
}

export function poiseCostForSource(source) {
  return POISE_COST_BY_SOURCE[source] ?? POISE_COST_BY_SOURCE.basic;
}

function normalizedMaxPoise(state) {
  if (Number.isFinite(state?.maxPoise) && state.maxPoise > 0) {
    return state.maxPoise;
  }

  return maxPoiseForEnemy(state);
}

function normalizedPoise(value, maxPoise) {
  const poise = Number.isFinite(value) ? value : maxPoise;

  return clamp(poise, 0, maxPoise);
}

function safeTime(value) {
  return Number.isFinite(value) ? value : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
