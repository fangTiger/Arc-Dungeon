import { canMoveToDungeonRoom } from "./roomMap.js";

export const MINIMAP_NORMAL_ALPHA = 1;
export const MINIMAP_FADED_ALPHA = 0.25;
export const MINIMAP_FADE_DURATION_MS = 180;

/**
 * 玩家进入小地图矩形时，计算整张小地图的绘制透明度。
 *
 * 调用方不提供上一帧状态时直接返回目标值，便于纯逻辑调用；
 * 运行时传入当前 alpha 和相邻帧时间后，会按固定时长线性逼近目标值。
 */
export function minimapFadeAlpha({
  playerX,
  playerY,
  minimapRect,
  currentAlpha,
  previousElapsedMs,
  elapsedMs,
} = {}) {
  const rect = normalizeRectangle(minimapRect);
  const targetAlpha = pointInsideRectangle(playerX, playerY, rect)
    ? MINIMAP_FADED_ALPHA
    : MINIMAP_NORMAL_ALPHA;

  if (!hasTransitionState({ currentAlpha, previousElapsedMs, elapsedMs })) {
    return targetAlpha;
  }

  const alpha = clamp(currentAlpha, MINIMAP_FADED_ALPHA, MINIMAP_NORMAL_ALPHA);
  const deltaMs = Math.max(0, elapsedMs - previousElapsedMs);
  const fullRange = MINIMAP_NORMAL_ALPHA - MINIMAP_FADED_ALPHA;
  const maxStep = fullRange * Math.min(1, deltaMs / MINIMAP_FADE_DURATION_MS);

  return moveTowards(alpha, targetAlpha, maxStep);
}

/**
 * 若玩家当前位置不可站立，则返回距离玩家最近的合法格中心。
 *
 * 候选点按欧氏距离排序，等价于以玩家为圆心逐圈外扩；同距离时按行列
 * 固定排序，确保结果完全确定且不依赖任何随机源。
 */
export function resolveStuckPosition({ roomMap, x, y, radius }) {
  assertRoomMap(roomMap);
  assertFiniteNumber(x, "玩家 x 坐标必须是有限数值");
  assertFiniteNumber(y, "玩家 y 坐标必须是有限数值");
  assertNonNegativeNumber(radius, "玩家半径必须是非负有限数值");

  if (canMoveToDungeonRoom(roomMap, x, y, radius)) {
    return { x, y };
  }

  const nearest = collectCandidateCenters(roomMap, x, y)
    .find((candidate) =>
      canMoveToDungeonRoom(roomMap, candidate.x, candidate.y, radius));

  if (!nearest) {
    throw new RangeError("当前地牢房间没有可供玩家站立的合法格");
  }

  return { x: nearest.x, y: nearest.y };
}

function collectCandidateCenters(roomMap, playerX, playerY) {
  const candidates = [];

  for (let tileY = 0; tileY < roomMap.height; tileY += 1) {
    for (let tileX = 0; tileX < roomMap.width; tileX += 1) {
      const x = tileX * roomMap.tileSize + roomMap.tileSize / 2;
      const y = tileY * roomMap.tileSize + roomMap.tileSize / 2;

      candidates.push({
        x,
        y,
        tileX,
        tileY,
        distanceSquared: (x - playerX) ** 2 + (y - playerY) ** 2,
      });
    }
  }

  return candidates.sort(compareCandidateCenters);
}

function compareCandidateCenters(first, second) {
  const distanceDifference = first.distanceSquared - second.distanceSquared;

  if (distanceDifference !== 0) {
    return distanceDifference;
  }

  if (first.tileY !== second.tileY) {
    return first.tileY - second.tileY;
  }

  return first.tileX - second.tileX;
}

function pointInsideRectangle(x, y, rect) {
  return Number.isFinite(x)
    && Number.isFinite(y)
    && x >= rect.x
    && x <= rect.x + rect.width
    && y >= rect.y
    && y <= rect.y + rect.height;
}

function hasTransitionState({ currentAlpha, previousElapsedMs, elapsedMs }) {
  return Number.isFinite(currentAlpha)
    && Number.isFinite(previousElapsedMs)
    && Number.isFinite(elapsedMs);
}

function moveTowards(current, target, maxStep) {
  if (target < current) {
    return Math.max(target, current - maxStep);
  }

  return Math.min(target, current + maxStep);
}

function normalizeRectangle(rect) {
  if (rect === null || typeof rect !== "object") {
    throw new TypeError("小地图矩形必须是对象");
  }

  assertFiniteNumber(rect.x, "小地图 x 坐标必须是有限数值");
  assertFiniteNumber(rect.y, "小地图 y 坐标必须是有限数值");
  assertNonNegativeNumber(rect.width, "小地图宽度必须是非负有限数值");
  assertNonNegativeNumber(rect.height, "小地图高度必须是非负有限数值");

  return rect;
}

function assertRoomMap(roomMap) {
  if (roomMap === null || typeof roomMap !== "object") {
    throw new TypeError("地牢房间地图必须是对象");
  }

  assertPositiveInteger(roomMap.width, "地牢房间宽度必须是正整数");
  assertPositiveInteger(roomMap.height, "地牢房间高度必须是正整数");
  assertNonNegativeNumber(roomMap.tileSize, "地牢格尺寸必须是正有限数值");

  if (roomMap.tileSize === 0) {
    throw new RangeError("地牢格尺寸必须是正有限数值");
  }
}

function assertPositiveInteger(value, message) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(message);
  }
}

function assertNonNegativeNumber(value, message) {
  assertFiniteNumber(value, message);

  if (value < 0) {
    throw new RangeError(message);
  }
}

function assertFiniteNumber(value, message) {
  if (!Number.isFinite(value)) {
    throw new TypeError(message);
  }
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
