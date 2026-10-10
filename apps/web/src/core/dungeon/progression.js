export const BOSS_FLOOR_INTERVAL = 5;

export function isBossFloor(depth) {
  return depth % BOSS_FLOOR_INTERVAL === 0 && depth > 0;
}

export function roomCountForDepth(depth) {
  return Math.min(7 + Math.floor(depth / 3), 12);
}

export function difficultyForDepth(depth) {
  const step = Math.max(0, depth - 1);

  return {
    enemyHpScale: roundScale(1 + step * 0.01),
    enemyDamageScale: roundScale(1 + step * 0.015),
    rewardScale: roundScale(1 + step * 0.06),
  };
}

function roundScale(value) {
  return Math.round(value * 1000) / 1000;
}
