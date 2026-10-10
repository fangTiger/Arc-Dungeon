import { createRng, hashSeed } from "../rng.js";
import { collectDoorPathTiles } from "./roomContentPlacement.js";

const WALKABLE_MARGIN = Object.freeze({ left: 1, right: 1, top: 2, bottom: 2 });
const PILLAR_MIN_DISTANCE = 3, PILLAR_OFFSET_Y = -32, PILLAR_MIDDLE_MIN_X = 6, PILLAR_MIDDLE_MAX_X = 13;
const FIXED_EMPTY_ROOM_TYPES = new Set(["start", "boss"]);
const SPIKE_FRAMES = Object.freeze(["floor_spikes_anim_f0", "floor_spikes_anim_f1", "floor_spikes_anim_f2", "floor_spikes_anim_f3"]);

export const ROOM_TEMPLATE_WEIGHTS = deepFreeze({
  shallow: {
    battle: [["empty", 35], ["pillars", 40], ["pit", 10], ["spikes", 10], ["corridor", 5]],
    support: [["empty", 45], ["pillars", 30], ["pit", 10], ["spikes", 10], ["corridor", 5]],
  },
  middle: {
    battle: [["empty", 22], ["pillars", 32], ["pit", 18], ["spikes", 16], ["corridor", 12]],
    support: [["empty", 30], ["pillars", 30], ["pit", 15], ["spikes", 15], ["corridor", 10]],
  },
  deep: {
    battle: [["empty", 15], ["pillars", 25], ["pit", 22], ["spikes", 20], ["corridor", 18]],
    support: [["empty", 22], ["pillars", 25], ["pit", 20], ["spikes", 18], ["corridor", 15]],
  },
});

export const ROOM_TEMPLATES = Object.freeze([
  createTemplate("empty", [], buildEmptyTiles), createTemplate("pillars", ["column"], buildPillarTiles),
  createTemplate("pit", ["hole"], buildPitTiles), createTemplate("spikes", SPIKE_FRAMES, buildSpikeTiles),
  createTemplate("corridor", ["wall_mid"], buildCorridorTiles),
]);

const TEMPLATE_BY_ID = new Map(ROOM_TEMPLATES.map((template) => [template.id, template]));

export function chooseRoomTemplate({ seed, depth, roomId, roomType }) {
  validateChoiceInput({ seed, depth, roomId, roomType });

  if (FIXED_EMPTY_ROOM_TYPES.has(roomType)) {
    return withVariant(readTemplate("empty"), null);
  }

  const rng = createRng(hashSeed(`${seed}:depth:${depth}:room:${roomId}:template`));
  const template = pickWeightedTemplate(rng, weightsFor({ depth, roomType }));

  return withVariant(template, createVariant(template.id, rng));
}

export function buildRoomTemplateTiles({ template, width, height }) {
  validateRoomSize(width, height);
  const source = readTemplate(template?.id);
  const tiles = source.buildBlockedTiles({ width, height, variant: template?.variant ?? null });

  return freezeUniqueTiles(tiles, width, height);
}

function createTemplate(id, decorFrameNames, buildBlockedTiles) {
  return Object.freeze({ id, decorFrameNames: Object.freeze([...decorFrameNames]), buildBlockedTiles });
}

function buildEmptyTiles() { return []; }

function buildPillarTiles({ width, height, variant }) {
  return pillarPattern({ width, height }, variant).map(([tileX, tileY]) =>
    createBlockedTile(tileX, tileY, "column", { offsetY: PILLAR_OFFSET_Y }),
  );
}

function buildPitTiles({ width, height }) {
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const tiles = [];

  for (let tileY = centerY - 1; tileY <= centerY + 1; tileY += 1) {
    for (let tileX = centerX - 3; tileX <= centerX + 2; tileX += 1) {
      tiles.push(createBlockedTile(tileX, tileY, "hole"));
    }
  }

  return tiles;
}

function buildSpikeTiles({ width, height, variant }) {
  const points = spikePattern({ width, height }, variant);
  const phase = variant?.phase ?? 0;

  return points.map(([tileX, tileY], index) =>
    createBlockedTile(tileX, tileY, SPIKE_FRAMES[(index + phase) % SPIKE_FRAMES.length], {
      animationFrameNames: SPIKE_FRAMES,
      animationFps: 4,
      animationPhase: (index + phase) % SPIKE_FRAMES.length,
    }),
  );
}

function buildCorridorTiles({ width, height, variant }) {
  const bounds = walkableBounds(width, height);
  const wallX = variant?.side === "right"
    ? Math.min(bounds.right - 2, Math.floor(width / 2) + 2)
    : Math.max(bounds.left + 2, Math.floor(width / 2) - 2);
  const passageY = Math.floor(height / 2);
  const tiles = [];

  for (let tileY = bounds.top; tileY <= bounds.bottom; tileY += 1) {
    if (tileY !== passageY) {
      tiles.push(createBlockedTile(wallX, tileY, "wall_mid"));
    }
  }

  return tiles;
}

function pillarPattern({ width, height }, variant) {
  const bounds = walkableBounds(width, height);
  const count = variant?.count ?? 4;
  const rng = createRng(variant?.layoutSeed ?? hashSeed(`pillars:${width}:${height}`));
  const forbidden = new Set(collectDoorPathTiles({ width, height }).map(tileKey));
  const candidates = [];
  const points = [];
  for (let tileY = bounds.top + 2; tileY <= bounds.bottom; tileY += 1) {
    for (let tileX = bounds.left; tileX <= bounds.right; tileX += 1) {
      if (!forbidden.has(tileKey({ tileX, tileY }))) {
        candidates.push([tileX, tileY]);
      }
    }
  }
  const shuffled = rng.shuffle(candidates);
  const first = shuffled.find(([tileX, tileY]) => tileX >= PILLAR_MIDDLE_MIN_X && tileX <= PILLAR_MIDDLE_MAX_X && tileY >= 4 && tileY <= 7);
  for (const candidate of first ? [first, ...shuffled] : shuffled) {
    const wouldShareOneRow = count >= 3 && points.length === count - 1 && points.every(([, tileY]) => tileY === candidate[1]);
    if (!wouldShareOneRow && points.every((point) => manhattan(point, candidate) >= PILLAR_MIN_DISTANCE)) {
      points.push(candidate);
      if (points.length === count) return points;
    }
  }
  throw new RangeError("房间尺寸不足以保持柱子间距");
}

function spikePattern({ width, height }, variant) {
  const bounds = walkableBounds(width, height);
  const centerX = Math.floor(width / 2);
  const patterns = [
    [
      [bounds.left + 3, bounds.top + 1],
      [centerX - 2, bounds.top + 2],
      [centerX + 2, bounds.top + 2],
      [bounds.right - 3, bounds.top + 1],
      [bounds.left + 4, bounds.bottom - 1],
      [centerX - 2, bounds.bottom - 2],
      [centerX + 2, bounds.bottom - 2],
      [bounds.right - 4, bounds.bottom - 1],
    ],
    [
      [bounds.left + 2, bounds.top + 2],
      [centerX - 4, bounds.top + 1],
      [centerX + 4, bounds.top + 1],
      [bounds.right - 2, bounds.top + 2],
      [bounds.left + 2, bounds.bottom - 2],
      [centerX - 4, bounds.bottom - 1],
      [centerX + 4, bounds.bottom - 1],
      [bounds.right - 2, bounds.bottom - 2],
    ],
  ];

  return patterns[variant?.patternIndex % patterns.length || 0];
}

function weightsFor({ depth, roomType }) {
  const tier = depth >= 15 ? "deep" : depth >= 6 ? "middle" : "shallow";
  const family = roomType === "battle" ? "battle" : "support";

  return ROOM_TEMPLATE_WEIGHTS[tier][family];
}

function pickWeightedTemplate(rng, weights) {
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = rng.next() * total;

  for (const [id, weight] of weights) {
    cursor -= weight;
    if (cursor < 0) {
      return readTemplate(id);
    }
  }

  return readTemplate(weights.at(-1)[0]);
}

function createVariant(templateId, rng) {
  if (templateId === "pillars") {
    return Object.freeze({ count: rng.int(2, 5), layoutSeed: rng.int(0, 0x100000000) });
  }

  if (templateId === "spikes") {
    return Object.freeze({ patternIndex: rng.int(0, 2), phase: rng.int(0, 4) });
  }

  if (templateId === "corridor") {
    return Object.freeze({ side: rng.next() < 0.5 ? "left" : "right" });
  }

  return null;
}

function withVariant(template, variant) {
  return Object.freeze({ ...template, variant });
}

function createBlockedTile(tileX, tileY, frameName, extra = {}) {
  return Object.freeze({ tileX, tileY, frameName, ...extra });
}

function freezeUniqueTiles(tiles, width, height) {
  const seen = new Set();
  const result = [];

  for (const tile of tiles) {
    const key = tileKey(tile);

    if (!seen.has(key) && isInsideWalkableArea(tile, width, height)) {
      seen.add(key);
      result.push(Object.freeze({
        tileX: tile.tileX,
        tileY: tile.tileY,
        frameName: tile.frameName ?? null,
        ...(Number.isFinite(tile.offsetY) ? { offsetY: tile.offsetY } : {}),
        ...(tile.animationFrameNames ? {
          animationFrameNames: tile.animationFrameNames,
          animationFps: tile.animationFps,
          animationPhase: tile.animationPhase,
        } : {}),
      }));
    }
  }

  return Object.freeze(result);
}

function walkableBounds(width, height) {
  return {
    left: WALKABLE_MARGIN.left,
    right: width - WALKABLE_MARGIN.right - 1,
    top: WALKABLE_MARGIN.top,
    bottom: height - WALKABLE_MARGIN.bottom - 1,
  };
}

function isInsideWalkableArea({ tileX, tileY }, width, height) {
  const bounds = walkableBounds(width, height);

  return tileX >= bounds.left && tileX <= bounds.right && tileY >= bounds.top && tileY <= bounds.bottom;
}

function readTemplate(id) {
  const template = TEMPLATE_BY_ID.get(id);

  if (!template) {
    throw new RangeError("未知房间模板");
  }

  return template;
}

function validateChoiceInput({ seed, depth, roomId, roomType }) {
  if (seed === undefined || seed === null || seed === "") {
    throw new TypeError("房间模板选择需要 run seed");
  }

  if (!Number.isInteger(depth) || depth < 1) {
    throw new RangeError("房间模板选择需要有效层数");
  }

  if (typeof roomId !== "string" || roomId.length === 0 || typeof roomType !== "string") {
    throw new TypeError("房间模板选择需要房间 id 与房型");
  }
}

function validateRoomSize(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new TypeError("房间尺寸必须是整数");
  }

  if (width < 12 || height < 9) {
    throw new RangeError("房间尺寸不足以生成模板");
  }
}

function deepFreeze(value) {
  for (const entry of Object.values(value)) {
    if (entry && typeof entry === "object") {
      deepFreeze(entry);
    }
  }

  return Object.freeze(value);
}

function tileKey({ tileX, tileY }) {
  return `${tileX},${tileY}`;
}

function manhattan([leftX, leftY], [rightX, rightY]) {
  return Math.abs(leftX - rightX) + Math.abs(leftY - rightY);
}
