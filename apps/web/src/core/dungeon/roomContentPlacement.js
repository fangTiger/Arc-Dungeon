import { createRng, hashSeed } from "../rng.js";
import { ROOM_DIRECTION_NAMES } from "./roomTransitions.js";

export const ROOM_CONTENT_MIN_SPAWN_DISTANCE = 48;

const WALL_TOP_ROWS = 2;
const WALL_BOTTOM_ROWS = 2;
const WALL_SIDE_COLUMNS = 1;
const ALL_DOORS = Object.freeze({ north: true, south: true, east: true, west: true });
const NEIGHBOR_OFFSETS = Object.freeze([{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }]);

export function chooseRoomContentPlacement(options) {
  const { seed, depth, roomId, width, height, tileSize, minSpawnDistance = ROOM_CONTENT_MIN_SPAWN_DISTANCE, blockedTiles = [], contentBlocks = true } = options;
  validatePlacementInput({ seed, depth, roomId });
  const candidates = collectRoomContentCandidates({ width, height, tileSize, minSpawnDistance, blockedTiles });

  if (candidates.length === 0) {
    throw new RangeError("没有合法的房间交互物位置");
  }

  const rng = createRng(hashSeed(`${seed}:depth:${depth}:room:${roomId}:content`));
  if (!contentBlocks) {
    return rng.pick(candidates);
  }

  const ranked = rankCandidatesByConnectivity({ width, height, blockedTiles, candidates });
  const connected = ranked.filter((entry) => entry.missingCount === 0).map((entry) => entry.candidate);

  if (connected.length > 0) {
    return rng.pick(connected);
  }

  const fallback = ranked[0];
  throw new RangeError(`没有保持房间连通的交互物位置，最少丢失 ${fallback?.missingCount ?? 0} 格`);
}

export function collectRoomContentCandidates(options) {
  const { width, height, tileSize, minSpawnDistance = ROOM_CONTENT_MIN_SPAWN_DISTANCE, blockedTiles = [] } = options;
  validateRoomMetrics({ width, height, tileSize });
  validateMinSpawnDistance(minSpawnDistance);

  const forbidden = new Set([
    ...collectDoorPathTiles({ width, height }).map(tileKey),
    ...normalizeBlockedTiles(blockedTiles),
  ]);
  const entries = collectPossibleEntryPositions({ width, height, tileSize });
  const bounds = getWalkableBounds(width, height);
  const candidates = [];

  for (let tileY = bounds.top; tileY <= bounds.bottom; tileY += 1) {
    for (let tileX = bounds.left; tileX <= bounds.right; tileX += 1) {
      const point = tileToPoint({ tileX, tileY, tileSize });
      if (!forbidden.has(tileKey({ tileX, tileY })) && entries.every((entry) => distance(point, entry) >= minSpawnDistance)) {
        candidates.push(Object.freeze({ tileX, tileY }));
      }
    }
  }

  return Object.freeze(candidates);
}

export function collectDoorPathTiles(options) {
  const { width, height, doors = ALL_DOORS, extendToCenter = true } = options;
  validateRoomSize(width, height);

  const activeDoors = normalizeDoors(doors);
  const bounds = getWalkableBounds(width, height);
  const center = getRoomCenterTiles(width, height);
  const tiles = [];
  const paths = [
    activeDoors.north ? ["vertical", center.leftX, center.rightX, bounds.top, extendToCenter ? center.y : bounds.top] : null,
    activeDoors.south ? ["vertical", center.leftX, center.rightX, extendToCenter ? center.y : bounds.bottom, bounds.bottom] : null,
    activeDoors.west ? ["horizontal", bounds.left, extendToCenter ? center.rightX : bounds.left, center.y] : null,
    activeDoors.east ? ["horizontal", extendToCenter ? center.leftX : bounds.right, bounds.right, center.y] : null,
  ];

  for (const path of paths) {
    if (path) {
      addPathTiles(tiles, path, width, height);
    }
  }

  return freezeUniqueTiles(tiles);
}

export function isRoomContentTileWalkable({ tileX, tileY, width, height }) {
  validateRoomSize(width, height);

  if (!Number.isInteger(tileX) || !Number.isInteger(tileY)) {
    return false;
  }

  const bounds = getWalkableBounds(width, height);
  return tileX >= bounds.left && tileX <= bounds.right && tileY >= bounds.top && tileY <= bounds.bottom;
}

function rankCandidatesByConnectivity({ width, height, blockedTiles, candidates }) {
  const baseBlocked = new Set(normalizeBlockedTiles(blockedTiles));

  return candidates
    .map((candidate) => {
      const blocked = new Set(baseBlocked);
      blocked.add(tileKey(candidate));

      return {
        candidate,
        missingCount: summarizeConnectivity({ width, height, blocked }).missingCount,
      };
    })
    .sort((left, right) => left.missingCount - right.missingCount);
}

function summarizeConnectivity({ width, height, blocked }) {
  const walkableKeys = collectWalkableKeys(width, height, blocked);
  const startKey = walkableKeys.values().next().value;

  if (!startKey) {
    return { missingCount: 0 };
  }

  const [tileX, tileY] = startKey.split(",").map(Number);
  const reached = floodFill({ tileX, tileY }, blocked, width, height);

  return { missingCount: walkableKeys.size - reached.size };
}

function floodFill(start, blocked, width, height) {
  const visited = new Set();
  const queue = [start];
  let cursor = 0;

  while (cursor < queue.length) {
    const tile = queue[cursor];
    cursor += 1;
    const key = tileKey(tile);

    if (visited.has(key) || blocked.has(key) || !isRoomContentTileWalkable({ ...tile, width, height })) {
      continue;
    }

    visited.add(key);
    for (const offset of NEIGHBOR_OFFSETS) {
      queue.push({ tileX: tile.tileX + offset.dx, tileY: tile.tileY + offset.dy });
    }
  }

  return visited;
}

function collectWalkableKeys(width, height, blocked) {
  const bounds = getWalkableBounds(width, height);
  const keys = new Set();

  for (let tileY = bounds.top; tileY <= bounds.bottom; tileY += 1) {
    for (let tileX = bounds.left; tileX <= bounds.right; tileX += 1) {
      const key = tileKey({ tileX, tileY });
      if (!blocked.has(key)) {
        keys.add(key);
      }
    }
  }

  return keys;
}

function collectPossibleEntryPositions({ width, height, tileSize }) {
  const bounds = getWalkableBounds(width, height);
  const halfTile = tileSize / 2;
  const centerX = Math.round((width * tileSize) / 2);
  const centerY = Math.floor(height / 2) * tileSize + halfTile;
  const defaultSpawnY = Math.max(bounds.top, height - 4) * tileSize + halfTile;

  return Object.freeze([
    Object.freeze({ x: centerX, y: defaultSpawnY }),
    Object.freeze({ x: centerX, y: bounds.bottom * tileSize + halfTile }),
    Object.freeze({ x: centerX, y: bounds.top * tileSize + halfTile }),
    Object.freeze({ x: bounds.right * tileSize + halfTile, y: centerY }),
    Object.freeze({ x: bounds.left * tileSize + halfTile, y: centerY }),
  ]);
}

function addPathTiles(tiles, path, width, height) {
  const [axis, fromX, toX, fromY, toY = fromY] = path;

  if (axis === "vertical") {
    for (let tileY = Math.min(fromY, toY); tileY <= Math.max(fromY, toY); tileY += 1) {
      for (let tileX = fromX; tileX <= toX; tileX += 1) {
        addWalkableTile(tiles, tileX, tileY, width, height);
      }
    }
    return;
  }

  for (let tileX = Math.min(fromX, toX); tileX <= Math.max(fromX, toX); tileX += 1) {
    addWalkableTile(tiles, tileX, fromY, width, height);
  }
}

function addWalkableTile(tiles, tileX, tileY, width, height) {
  if (isRoomContentTileWalkable({ tileX, tileY, width, height })) {
    tiles.push({ tileX, tileY });
  }
}

function freezeUniqueTiles(tiles) {
  const seen = new Set();
  const unique = [];

  for (const tile of tiles) {
    const key = tileKey(tile);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(Object.freeze({ tileX: tile.tileX, tileY: tile.tileY }));
    }
  }

  return Object.freeze(unique);
}

function normalizeDoors(doors) {
  if (!doors || typeof doors !== "object") {
    return ALL_DOORS;
  }

  const normalized = {};
  for (const directionName of ROOM_DIRECTION_NAMES) {
    normalized[directionName] = Boolean(doors[directionName]);
  }
  return normalized;
}

function getRoomCenterTiles(width, height) {
  const centerX = Math.floor(width / 2);
  return { leftX: centerX - 1, rightX: centerX, y: Math.floor(height / 2) };
}

function getWalkableBounds(width, height) {
  return {
    left: WALL_SIDE_COLUMNS,
    right: width - WALL_SIDE_COLUMNS - 1,
    top: WALL_TOP_ROWS,
    bottom: height - WALL_BOTTOM_ROWS - 1,
  };
}

function tileToPoint({ tileX, tileY, tileSize }) {
  return { x: tileX * tileSize + tileSize / 2, y: tileY * tileSize + tileSize / 2 };
}

function distance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function tileKey({ tileX, tileY }) {
  return `${tileX},${tileY}`;
}

function normalizeBlockedTiles(blockedTiles) {
  const tiles = blockedTiles instanceof Set ? [...blockedTiles] : blockedTiles;
  if (!Array.isArray(tiles)) {
    throw new TypeError("模板阻挡格必须是数组或 Set");
  }
  return tiles.map((tile) => typeof tile === "string" ? tile : tileKey(tile));
}

function validatePlacementInput({ seed, depth, roomId }) {
  if (seed === undefined || seed === null || seed === "") {
    throw new TypeError("房间交互物位置需要 run seed");
  }
  if (!Number.isInteger(depth) || depth < 1) {
    throw new RangeError("房间交互物位置需要有效层数");
  }
  if (typeof roomId !== "string" || roomId.length === 0) {
    throw new TypeError("房间交互物位置需要房间 id");
  }
}

function validateRoomMetrics({ width, height, tileSize }) {
  validateRoomSize(width, height);
  if (!Number.isInteger(tileSize) || tileSize <= 0) {
    throw new RangeError("tileSize 必须是正整数");
  }
}

function validateRoomSize(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new TypeError("房间尺寸必须是整数");
  }
  if (width < 4 || height < 5) {
    throw new RangeError("房间尺寸不足以放置交互物");
  }
}

function validateMinSpawnDistance(minSpawnDistance) {
  if (!Number.isFinite(minSpawnDistance) || minSpawnDistance < 0) {
    throw new RangeError("交互物与出生点的最小距离必须是非负数");
  }
}
