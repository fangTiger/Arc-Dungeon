import { buildMinimapReveal } from "../../core/ui/minimapReveal.js";
import { INTERNAL_WIDTH } from "../renderer/pixelSurface.js";
import { drawPixelPanel, drawPixelText } from "../ui/pixelUi.js";

const MINIMAP_TILE = 10;
const MINIMAP_STEP = 12;

export function drawDungeonMinimap(context, run, tileset = null, options = {}) {
  const rooms = run.floorPlan.rooms;
  const visited = new Set(run.visitedRoomIdsByDepth[run.depth] ?? []);
  const reveal = buildMinimapReveal({
    floorPlan: run.floorPlan,
    currentRoomId: run.currentRoomId,
    visitedRoomIds: visited,
    discoveredStairsRoomIds: run.discoveredStairsRoomIdsByDepth?.[run.depth] ?? [],
    t: options.t,
  });
  const visible = new Set(reveal.rooms.filter((room) => room.reveal !== "hidden").map((room) => room.id));
  const geometry = calculateMinimapGeometry(run);
  const { bounds, originX, originY, panel } = geometry;

  context.save();
  context.globalAlpha *= Number.isFinite(options.alpha)
    ? Math.max(0, Math.min(1, options.alpha))
    : 1;
  drawPixelPanel(context, {
    tileset,
    ...panel,
    accent: "#9eb7d6",
    fill: "#14121b",
  });

  drawMinimapConnections(context, run.floorPlan, visible, bounds, originX, originY);

  for (const room of reveal.rooms) {
    if (room.reveal === "hidden") {
      continue;
    }

    const x = Math.round(originX + (room.gx - bounds.minGx) * MINIMAP_STEP);
    const y = Math.round(originY + (room.gy - bounds.minGy) * MINIMAP_STEP);

    if (room.reveal === "adjacent" && !room.showIcon) {
      drawRoomOutline(context, x, y, room.highlight ? "#ffd36e" : "#6f7181");
      continue;
    }

    drawVisitedRoom(context, room, x, y, visited);
  }

  context.restore();
}

export function calculateMinimapRect(run) {
  return { ...calculateMinimapGeometry(run).panel };
}

function calculateMinimapGeometry(run) {
  const bounds = getRoomBounds(run.floorPlan.rooms);
  const mapWidth = Math.round((bounds.width - 1) * MINIMAP_STEP + MINIMAP_TILE);
  const mapHeight = Math.round((bounds.height - 1) * MINIMAP_STEP + MINIMAP_TILE);
  const originX = Math.round(INTERNAL_WIDTH - mapWidth - 10);
  const originY = 8;

  return {
    bounds,
    mapWidth,
    mapHeight,
    originX,
    originY,
    panel: {
      x: Math.round(originX - 6),
      y: Math.round(originY - 6),
      width: Math.round(mapWidth + 12),
      height: Math.round(mapHeight + 12),
    },
  };
}

function drawMinimapConnections(context, floorPlan, known, bounds, originX, originY) {
  const byId = new Map(floorPlan.rooms.map((room) => [room.id, room]));

  for (const room of floorPlan.rooms) {
    if (!known.has(room.id)) {
      continue;
    }

    const roomCenter = getMinimapCenter(room, bounds, originX, originY);

    for (const [direction, hasDoor] of Object.entries(room.doors)) {
      if (!hasDoor || direction !== "east" && direction !== "south") {
        continue;
      }

      const neighbor = byId.get(getNeighborId(room, direction));
      if (!neighbor || !known.has(neighbor.id)) {
        continue;
      }

      const neighborCenter = getMinimapCenter(neighbor, bounds, originX, originY);
      context.fillStyle = "#68606c";
      if (roomCenter.x === neighborCenter.x) {
        const y = Math.round(Math.min(roomCenter.y, neighborCenter.y));
        const height = Math.round(Math.abs(roomCenter.y - neighborCenter.y) + 1);
        context.fillRect(Math.round(roomCenter.x), y, 1, height);
      } else {
        const x = Math.round(Math.min(roomCenter.x, neighborCenter.x));
        const width = Math.round(Math.abs(roomCenter.x - neighborCenter.x) + 1);
        context.fillRect(x, Math.round(roomCenter.y), width, 1);
      }
    }
  }
}

function drawVisitedRoom(context, room, x, y) {
  const left = Math.round(x);
  const top = Math.round(y);

  context.fillStyle = getRoomColor(room);
  context.fillRect(left, top, MINIMAP_TILE, MINIMAP_TILE);
  drawRoomOutline(context, left, top, room.highlight ? "#ffd36e" : room.current ? "#fff2a3" : "#352f3b");
  drawPixelText(context, room.icon, left + 1, top, { color: "#151018" });
}

function drawRoomOutline(context, x, y, color) {
  const left = Math.round(x);
  const top = Math.round(y);

  context.fillStyle = color;
  context.fillRect(left, top, MINIMAP_TILE, 1);
  context.fillRect(left, top + MINIMAP_TILE - 1, MINIMAP_TILE, 1);
  context.fillRect(left, top, 1, MINIMAP_TILE);
  context.fillRect(left + MINIMAP_TILE - 1, top, 1, MINIMAP_TILE);
}

function getRoomColor(room) {
  if (room.current) {
    return "#fff2a3";
  }

  if (room.type === "stairs" || room.type === "boss") {
    return room.type === "boss" ? "#e35c5c" : "#62d8ff";
  }

  return "#c8894b";
}

function getNeighborId(room, direction) {
  if (direction === "north") {
    return `room-${room.gx}-${room.gy - 1}`;
  }

  if (direction === "south") {
    return `room-${room.gx}-${room.gy + 1}`;
  }

  if (direction === "west") {
    return `room-${room.gx - 1}-${room.gy}`;
  }

  return `room-${room.gx + 1}-${room.gy}`;
}

function getRoomBounds(rooms) {
  const xs = rooms.map((room) => room.gx);
  const ys = rooms.map((room) => room.gy);
  const minGx = Math.min(...xs);
  const maxGx = Math.max(...xs);
  const minGy = Math.min(...ys);
  const maxGy = Math.max(...ys);

  return {
    minGx,
    minGy,
    width: maxGx - minGx + 1,
    height: maxGy - minGy + 1,
  };
}

function getMinimapCenter(room, bounds, originX, originY) {
  return {
    x: Math.round(originX + (room.gx - bounds.minGx) * MINIMAP_STEP + Math.floor(MINIMAP_TILE / 2)),
    y: Math.round(originY + (room.gy - bounds.minGy) * MINIMAP_STEP + Math.floor(MINIMAP_TILE / 2)),
  };
}
