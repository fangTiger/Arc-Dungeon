export const LOOT_ARM_DELAY_MS = 260;
export const LOOT_ATTRACT_RADIUS = 38;
export const LOOT_PICKUP_RADIUS = 9;
export const LOOT_LIFETIME_MS = 18000;
export const LOOT_ATTRACT_SPEED = 190;
export const LOOT_HOP_HEIGHT = 9;
export const BIG_DROP_THRESHOLD = 10;

const SCATTER_MIN_DISTANCE = 5;
const SCATTER_MAX_DISTANCE = 12;

export function createLootDrop({ id, x, y, amount, now, rng } = {}) {
  assertRng(rng);
  const angle = rng.next() * Math.PI * 2;
  const distance = SCATTER_MIN_DISTANCE + rng.next() * (SCATTER_MAX_DISTANCE - SCATTER_MIN_DISTANCE);

  return {
    id,
    kind: "token",
    x: normalizeCoordinate(x),
    y: normalizeCoordinate(y),
    amount: normalizeAmount(amount),
    spawnedAt: normalizeTime(now),
    collectibleAt: normalizeTime(now) + LOOT_ARM_DELAY_MS,
    expiresAt: normalizeTime(now) + LOOT_LIFETIME_MS,
    hopSeed: rng.next(),
    scatterX: Math.round(Math.cos(angle) * distance),
    scatterY: Math.round(Math.sin(angle) * distance),
  };
}

/**
 * 推进掉落物。
 *
 * `pauseExpiry` 在房间仍被锁住（战斗未结束）时置真：这段时间玩家没有安全窗口去捡，
 * 让掉落物过期等于凭空销毁本该属于玩家的 Token。深层房间清空耗时会逼近甚至超过
 * `LOOT_LIFETIME_MS`，不暂停就会形成静默的经济泄漏。
 */
export function stepLootDrops({
  drops = [],
  player = {},
  now,
  dtMs,
  forceCollect = false,
  pauseExpiry = false,
} = {}) {
  const remaining = [];
  const collected = [];
  const expired = [];
  const currentTime = normalizeTime(now);

  for (const drop of Array.isArray(drops) ? drops : []) {
    if (!pauseExpiry && currentTime >= drop.expiresAt) {
      expired.push(drop.id);
      continue;
    }

    if (currentTime < drop.collectibleAt) {
      remaining.push(scatterDrop(drop, currentTime, dtMs));
      continue;
    }

    const stepped = stepCollectibleDrop(drop, player, dtMs, Boolean(forceCollect));

    if (stepped.collected) {
      collected.push({ id: drop.id, amount: drop.amount });
    } else {
      remaining.push(stepped.drop);
    }
  }

  return {
    drops: remaining,
    collected,
    expired,
  };
}

export function lootHopOffset(drop, now) {
  const spawnedAt = normalizeTime(drop?.spawnedAt);
  const collectibleAt = normalizeTime(drop?.collectibleAt);

  if (collectibleAt <= spawnedAt) {
    return 0;
  }

  const progress = (normalizeTime(now) - spawnedAt) / (collectibleAt - spawnedAt);

  if (progress <= 0 || progress >= 1) {
    return 0;
  }

  const height = LOOT_HOP_HEIGHT + Math.round(clamp01(drop?.hopSeed) * 3);
  return -Math.round(Math.sin(progress * Math.PI) * height);
}

function scatterDrop(drop, now, dtMs) {
  const totalMs = Math.max(1, drop.collectibleAt - drop.spawnedAt);
  const previousTime = Math.max(drop.spawnedAt, now - normalizeDelta(dtMs));
  const previousProgress = clamp01((previousTime - drop.spawnedAt) / totalMs);
  const nextProgress = clamp01((now - drop.spawnedAt) / totalMs);
  const progressDelta = Math.max(0, nextProgress - previousProgress);

  return {
    ...drop,
    x: drop.x + drop.scatterX * progressDelta,
    y: drop.y + drop.scatterY * progressDelta,
  };
}

function stepCollectibleDrop(drop, player, dtMs, forceCollect) {
  const target = {
    x: normalizeCoordinate(player?.x),
    y: normalizeCoordinate(player?.y),
  };
  const distance = distanceBetween(drop, target);

  if (distance <= LOOT_PICKUP_RADIUS) {
    return { collected: true, drop };
  }

  if (!forceCollect && distance > LOOT_ATTRACT_RADIUS) {
    return { collected: false, drop };
  }

  const movedDrop = moveToward(drop, target, LOOT_ATTRACT_SPEED * normalizeDelta(dtMs) / 1000);

  if (distanceBetween(movedDrop, target) <= LOOT_PICKUP_RADIUS) {
    return { collected: true, drop: movedDrop };
  }

  return { collected: false, drop: movedDrop };
}

function moveToward(drop, target, maxDistance) {
  const distance = distanceBetween(drop, target);

  if (distance <= 0 || maxDistance <= 0) {
    return drop;
  }

  const step = Math.min(distance, maxDistance);
  const ratio = step / distance;

  return {
    ...drop,
    x: drop.x + (target.x - drop.x) * ratio,
    y: drop.y + (target.y - drop.y) * ratio,
  };
}

function distanceBetween(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function normalizeCoordinate(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return value;
}

function normalizeTime(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}

function normalizeDelta(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}

function normalizeAmount(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function assertRng(rng) {
  if (!rng || typeof rng.next !== "function") {
    throw new TypeError("Token 掉落物必须传入可复现 rng");
  }
}
