import { buildHubFloorTiles } from "./floorTiles.js";
import { HUB_BLOCKING_DECOR_TILES, buildHubDecorTiles } from "./hubDecor.js";
import { buildRoomWalls } from "./roomWalls.js";
import { translate } from "../i18n/index.js";

export const HUB_WIDTH = 20;
export const HUB_HEIGHT = 11;
export const HUB_TILE_SIZE = 16;
export const HUB_INTERACTION_RANGE = 24;

const HUB_FLOOR_SEED = "rialo:guild-hub:floor:v1";
const PORTAL_DOOR = Object.freeze({ side: "top", fromX: 9, toX: 10 });

const INTERACTIONS = [
  createInteraction({
    id: "portal",
    labelKey: "hub.interaction.portal.label",
    feedbackKey: "hub.interaction.portal.feedback",
    tileX: 9,
    tileY: 1,
    standTiles: [
      [9, 2],
      [10, 2],
    ],
    blockedTiles: [
      [9, 1],
      [10, 1],
      [9, 0],
      [10, 0],
      [8, 1],
      [11, 1],
    ],
  }),
  createInteraction({
    id: "merchant",
    labelKey: "hub.interaction.merchant.label",
    feedbackKey: "hub.interaction.merchant.feedback",
    tileX: 4,
    tileY: 3,
    standTiles: [[4, 4]],
  }),
  createInteraction({
    id: "noticeboard",
    labelKey: "hub.interaction.noticeboard.label",
    feedbackKey: "hub.interaction.noticeboard.feedback",
    tileX: 16,
    tileY: 1,
    standTiles: [[16, 2]],
  }),
  createInteraction({
    id: "identity",
    labelKey: "hub.interaction.identity.label",
    feedbackKey: "hub.interaction.identity.feedback",
    tileX: 13,
    tileY: 1,
    standTiles: [[13, 2]],
  }),
  createInteraction({
    id: "classStation",
    labelKey: "hub.interaction.classStation.label",
    feedbackKey: "hub.interaction.classStation.feedback",
    tileX: 5,
    tileY: 7,
    standTiles: [[5, 6]],
  }),
];

export const hubMap = createHubMap();

export function createHubMap({ floorSeed = HUB_FLOOR_SEED } = {}) {
  return Object.freeze({
    id: "guild-hub",
    width: HUB_WIDTH,
    height: HUB_HEIGHT,
    tileSize: HUB_TILE_SIZE,
    spawn: Object.freeze({
      x: 10 * HUB_TILE_SIZE + HUB_TILE_SIZE / 2,
      y: 8 * HUB_TILE_SIZE + HUB_TILE_SIZE / 2,
    }),
    layers: Object.freeze({
      floor: freezeLayer("floor", createFloorTiles(floorSeed)),
      walls: freezeLayer("walls", createWallTiles()),
      decor: freezeLayer("decor", createDecorTiles()),
    }),
    blockedTiles: HUB_BLOCKING_DECOR_TILES,
    interactions: Object.freeze(INTERACTIONS),
  });
}

export function collisionAt(map, tileX, tileY) {
  if (!isInsideMap(map, tileX, tileY)) {
    return true;
  }

  const wallTile = map.layers.walls.tiles[tileY][tileX];
  if (wallTile) {
    return true;
  }

  if (tileListContains(map.blockedTiles, tileX, tileY)) {
    return true;
  }

  return map.interactions.some((interaction) =>
    tileListContains(interaction.blockedTiles, tileX, tileY),
  );
}

export function canMoveTo(map, x, y, radius) {
  const minTileX = Math.floor((x - radius) / map.tileSize);
  const maxTileX = Math.floor((x + radius) / map.tileSize);
  const minTileY = Math.floor((y - radius) / map.tileSize);
  const maxTileY = Math.floor((y + radius) / map.tileSize);

  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      if (collisionAt(map, tileX, tileY)) {
        return false;
      }
    }
  }

  return true;
}

export function getInteractionNear(map, x, y, range) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const interaction of map.interactions) {
    const distance = Math.hypot(interaction.interactX - x, interaction.interactY - y);
    if (distance <= range && distance < nearestDistance) {
      nearest = interaction;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function createInteraction({
  id,
  labelKey,
  feedbackKey,
  tileX,
  tileY,
  blockedTiles = [[tileX, tileY]],
  standTiles = [[tileX, tileY + 1]],
}) {
  const frozenStandTiles = Object.freeze(standTiles.map((tile) => Object.freeze([...tile])));
  const interactCenter = getStandCenter(frozenStandTiles);

  return Object.freeze({
    id,
    labelKey,
    feedbackKey,
    // 兼容只读调用方，但不在模块初始化时固化玩家可见文本。
    get label() {
      return translate(labelKey);
    },
    get feedback() {
      return translate(feedbackKey);
    },
    tileX,
    tileY,
    blockedTiles: Object.freeze(blockedTiles.map((tile) => Object.freeze([...tile]))),
    standTiles: frozenStandTiles,
    x: tileX * HUB_TILE_SIZE + HUB_TILE_SIZE / 2,
    y: tileY * HUB_TILE_SIZE + HUB_TILE_SIZE / 2,
    interactX: interactCenter.x,
    interactY: interactCenter.y,
  });
}

function createFloorTiles(seed) {
  return buildHubFloorTiles({ width: HUB_WIDTH, height: HUB_HEIGHT, seed });
}

function createWallTiles() {
  return buildRoomWalls({
    width: HUB_WIDTH,
    height: HUB_HEIGHT,
    doors: [PORTAL_DOOR],
  });
}

function createDecorTiles() {
  return buildHubDecorTiles({ width: HUB_WIDTH, height: HUB_HEIGHT });
}

function freezeLayer(name, tiles) {
  return Object.freeze({
    name,
    width: HUB_WIDTH,
    height: HUB_HEIGHT,
    x: 0,
    y: 0,
    tiles: Object.freeze(tiles.map((row) => Object.freeze(row))),
  });
}

function isInsideMap(map, tileX, tileY) {
  return (
    Number.isInteger(tileX) &&
    Number.isInteger(tileY) &&
    tileX >= 0 &&
    tileY >= 0 &&
    tileX < map.width &&
    tileY < map.height
  );
}

function tileListContains(tiles, tileX, tileY) {
  return tiles.some(
    ([blockedX, blockedY]) => blockedX === tileX && blockedY === tileY,
  );
}

function getStandCenter(standTiles) {
  const total = standTiles.reduce(
    (sum, [tileX, tileY]) => ({
      x: sum.x + tileX * HUB_TILE_SIZE + HUB_TILE_SIZE / 2,
      y: sum.y + tileY * HUB_TILE_SIZE + HUB_TILE_SIZE / 2,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / standTiles.length,
    y: total.y / standTiles.length,
  };
}
