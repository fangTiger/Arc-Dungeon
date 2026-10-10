import { buildHubFloorTiles } from "../hub/floorTiles.js";
import { buildRoomWalls } from "../hub/roomWalls.js";
import { chooseRoomContentPlacement } from "./roomContentPlacement.js";
import { translate } from "../i18n/index.js";
import { buildRoomTemplateTiles, chooseRoomTemplate } from "./roomTemplates.js";
import { getDoorDefinitionsForRoom } from "./roomTransitions.js";

export const DUNGEON_ROOM_WIDTH = 20;
export const DUNGEON_ROOM_HEIGHT = 11;
export const DUNGEON_TILE_SIZE = 16;
const STAIRS_LIGHT = Object.freeze({ radius: 36, color: "#ff9a4d", intensity: 0.28 });

export function buildDungeonRoomMap({ run }) {
  const room = getCurrentRoom(run.floorPlan, run.currentRoomId);
  const floorSeed = `${run.seed}:depth:${run.depth}:room:${room.id}`;
  const template = chooseRoomTemplate({
    seed: run.seed,
    depth: run.depth,
    roomId: room.id,
    roomType: room.type,
  });
  const templateTiles = buildRoomTemplateTiles({
    template,
    width: DUNGEON_ROOM_WIDTH,
    height: DUNGEON_ROOM_HEIGHT,
  });
  const content = createRoomContent({
    run,
    room,
    seed: run.seed,
    depth: run.depth,
    blockedTiles: templateTiles,
  });

  return Object.freeze({
    id: room.id,
    width: DUNGEON_ROOM_WIDTH,
    height: DUNGEON_ROOM_HEIGHT,
    tileSize: DUNGEON_TILE_SIZE,
    room,
    template: freezeTemplate(template, templateTiles),
    layers: Object.freeze({
      floor: freezeLayer("floor", buildHubFloorTiles({
        width: DUNGEON_ROOM_WIDTH,
        height: DUNGEON_ROOM_HEIGHT,
        seed: floorSeed,
      })),
      walls: freezeLayer("walls", createWallTiles(room, templateTiles)),
    }),
    content,
    interactions: Object.freeze(content ? [content] : []),
  });
}

export function getCurrentRoom(floorPlan, roomId) {
  const room = floorPlan.rooms.find((candidate) => candidate.id === roomId);

  if (!room) {
    throw new RangeError("当前房间不存在于楼层平面图");
  }

  return room;
}

export function getDungeonSpawnPosition() {
  return {
    x: Math.round((DUNGEON_ROOM_WIDTH * DUNGEON_TILE_SIZE) / 2),
    y: 7 * DUNGEON_TILE_SIZE + DUNGEON_TILE_SIZE / 2,
  };
}

export function canMoveToDungeonRoom(map, x, y, radius) {
  const minTileX = Math.floor((x - radius) / map.tileSize);
  const maxTileX = Math.floor((x + radius) / map.tileSize);
  const minTileY = Math.floor((y - radius) / map.tileSize);
  const maxTileY = Math.floor((y + radius) / map.tileSize);

  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      if (collisionAtDungeonRoom(map, tileX, tileY)) {
        return false;
      }
    }
  }

  return true;
}

export function collisionAtDungeonRoom(map, tileX, tileY) {
  if (!isInsideMap(map, tileX, tileY)) {
    return true;
  }

  if (map.layers.walls.tiles[tileY][tileX]) {
    return true;
  }

  if (tileListContains(map.template?.blockedTiles, tileX, tileY)) {
    return true;
  }

  return map.interactions.some((interaction) =>
    interaction.blocks && interaction.tileX === tileX && interaction.tileY === tileY,
  );
}

export function getDungeonInteractionNear(map, x, y, range) {
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

function createRoomContent({ run, room, seed, depth, blockedTiles }) {
  if (room.type === "treasure") {
    const placement = chooseContentPlacement({ room, seed, depth, blockedTiles, contentBlocks: true });

    return createInteraction({
      id: "treasure",
      labelKey: "dungeon.interaction.treasure.label",
      feedbackKey: "dungeon.interaction.treasure.feedback",
      frameName: "chest_full_open_anim_f0",
      ...placement,
      blocks: true,
    });
  }

  if (room.type === "event") {
    const placement = chooseContentPlacement({ room, seed, depth, blockedTiles, contentBlocks: true });
    const used = isEventRoomUsed(run, room.id);

    return createInteraction({
      id: "event",
      labelKey: used
        ? "dungeon.interaction.event.usedLabel"
        : "dungeon.interaction.event.label",
      feedbackKey: used
        ? "dungeon.interaction.event.usedFeedback"
        : "dungeon.interaction.event.feedback",
      used,
      frameName: used ? "flask_red" : "flask_big_red",
      ...placement,
      blocks: true,
    });
  }

  if (room.type === "stairs" || room.type === "boss") {
    const placement = chooseContentPlacement({ room, seed, depth, blockedTiles, contentBlocks: false });

    return createInteraction({
      id: "stairs",
      labelKey: "dungeon.interaction.stairs.label",
      feedbackKey: null,
      frameName: "floor_ladder",
      light: STAIRS_LIGHT,
      ...placement,
      blocks: false,
    });
  }

  return null;
}

function isEventRoomUsed(run, roomId) {
  return Boolean(run?.roomEventsByDepth?.[run.depth]?.[roomId]?.used);
}

function chooseContentPlacement({ room, seed, depth, blockedTiles, contentBlocks }) {
  return chooseRoomContentPlacement({
    seed,
    depth,
    roomId: room.id,
    width: DUNGEON_ROOM_WIDTH,
    height: DUNGEON_ROOM_HEIGHT,
    tileSize: DUNGEON_TILE_SIZE,
    blockedTiles,
    contentBlocks,
  });
}

function createInteraction({ id, labelKey, feedbackKey, used = false, frameName, light, tileX, tileY, blocks }) {
  return Object.freeze({
    id,
    labelKey,
    feedbackKey,
    label: labelKey ? translate(labelKey) : "",
    feedback: feedbackKey ? translate(feedbackKey) : "",
    used,
    frameName,
    ...(light ? { light } : {}),
    tileX,
    tileY,
    blocks,
    interactX: tileX * DUNGEON_TILE_SIZE + DUNGEON_TILE_SIZE / 2,
    interactY: tileY * DUNGEON_TILE_SIZE + DUNGEON_TILE_SIZE / 2,
  });
}

function freezeLayer(name, tiles) {
  return Object.freeze({
    name,
    width: DUNGEON_ROOM_WIDTH,
    height: DUNGEON_ROOM_HEIGHT,
    x: 0,
    y: 0,
    tiles: Object.freeze(tiles.map((row) => Object.freeze(row))),
  });
}

function createWallTiles(room, templateTiles) {
  const walls = buildRoomWalls({
    width: DUNGEON_ROOM_WIDTH,
    height: DUNGEON_ROOM_HEIGHT,
    doors: getDoorDefinitionsForRoom(room, {
      width: DUNGEON_ROOM_WIDTH,
      height: DUNGEON_ROOM_HEIGHT,
    }),
  });

  for (const tile of templateTiles) {
    if (tile.frameName) {
      walls[tile.tileY][tile.tileX] = createTemplateWallTile(tile);
    }
  }

  return walls;
}

function createTemplateWallTile(tile) {
  if (!tile.animationFrameNames && !Number.isFinite(tile.offsetY)) {
    return tile.frameName;
  }

  return Object.freeze({
    name: tile.frameName,
    ...(Number.isFinite(tile.offsetY) ? { offsetY: tile.offsetY } : {}),
    ...(tile.animationFrameNames ? {
      animationFrameNames: tile.animationFrameNames,
      animationFps: tile.animationFps,
      animationPhase: tile.animationPhase,
    } : {}),
  });
}

function freezeTemplate(template, blockedTiles) {
  return Object.freeze({
    id: template.id,
    variant: template.variant,
    blockedTiles,
  });
}

function tileListContains(tiles = [], tileX, tileY) {
  return tiles.some((tile) => tile.tileX === tileX && tile.tileY === tileY);
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
