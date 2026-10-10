export const DEATH_LOOT_RETENTION = 0.5;
export const EVACUATED_LOOT_RETENTION = 1;
export const EXPLORATION_LOOT_BONUS = 0.3;
export const FLOOR_LOOT_BONUS_PER_DEPTH = 0.1;

export const TOKEN_DROP_RANGES = Object.freeze({
  enemy: Object.freeze({ min: 1, max: 3 }),
  chest: Object.freeze({ min: 8, max: 15 }),
  boss: Object.freeze({ min: 15, max: 30 }),
});

export function createRunBag(initial = {}) {
  return {
    tokens: normalizeTokenCount(initial.tokens),
  };
}

export function resetRunBag() {
  return createRunBag();
}

export function addTokensToRunBag(bag = createRunBag(), amount = 0) {
  const current = createRunBag(bag);
  const nextTokens = current.tokens + normalizeSignedTokenCount(amount);

  return {
    tokens: Math.max(0, nextTokens),
  };
}

export function addEnemyTokenDrop(bag, options = {}) {
  return addRolledDropToBag(bag, rollEnemyTokenDrop(options));
}

export function addChestTokenDrop(bag, options = {}) {
  return addRolledDropToBag(bag, rollChestTokenDrop(options));
}

export function addBossTokenDrop(bag, options = {}) {
  return addRolledDropToBag(bag, rollBossTokenDrop(options));
}

export function rollEnemyTokenDrop(options = {}) {
  return rollTokenDrop({
    ...options,
    range: TOKEN_DROP_RANGES.enemy,
  });
}

export function rollChestTokenDrop(options = {}) {
  return rollTokenDrop({
    ...options,
    range: TOKEN_DROP_RANGES.chest,
  });
}

export function rollBossTokenDrop(options = {}) {
  return rollTokenDrop({
    ...options,
    range: TOKEN_DROP_RANGES.boss,
  });
}

export function rollTokenDrop({
  rng,
  range,
  depth = 1,
  lootMultiplier = 1,
} = {}) {
  assertRng(rng);
  const normalizedRange = normalizeDropRange(range);
  const base = rng.int(normalizedRange.min, normalizedRange.max + 1);
  const scaled = base * normalizeLootMultiplier(lootMultiplier) * depthLootMultiplier(depth);

  return Math.max(0, Math.floor(scaled));
}

export function depthLootMultiplier(depth = 1) {
  const normalizedDepth = normalizeDepth(depth);

  return 1 + Math.max(0, normalizedDepth - 1) * FLOOR_LOOT_BONUS_PER_DEPTH;
}

export function settleRunBag({
  bag = createRunBag(),
  reason = "evacuated",
  explorationRate = 0,
} = {}) {
  const current = createRunBag(bag);
  const retentionRate = retentionRateForReason(reason);
  const explorationMultiplier = 1 + clamp01(explorationRate) * EXPLORATION_LOOT_BONUS;
  const creditedTokens = Math.floor(current.tokens * retentionRate * explorationMultiplier);

  return {
    creditedTokens,
    retentionRate,
    explorationMultiplier,
    remainingBag: resetRunBag(),
  };
}

function addRolledDropToBag(bag, drop) {
  return {
    drop,
    bag: addTokensToRunBag(bag, drop),
  };
}

function retentionRateForReason(reason) {
  if (reason === "death") {
    return DEATH_LOOT_RETENTION;
  }

  return EVACUATED_LOOT_RETENTION;
}

function normalizeDropRange(range) {
  const min = normalizeTokenCount(range?.min);
  const max = normalizeTokenCount(range?.max);

  if (min < 1 || max < min) {
    throw new RangeError("掉落区间必须是有效的正整数闭区间");
  }

  return { min, max };
}

function normalizeDepth(value) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
}

function normalizeLootMultiplier(value) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(0, value);
}

function normalizeTokenCount(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function normalizeSignedTokenCount(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.floor(value);
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function assertRng(rng) {
  if (!rng || typeof rng.int !== "function") {
    throw new TypeError("Token 掉落必须传入可复现 rng");
  }
}
