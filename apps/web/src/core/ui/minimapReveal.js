import { translate } from "../i18n/index.js";

const DIRECTIONS = Object.freeze({
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
});

const ROOM_ICON_KEYS = Object.freeze({
  start: "minimap.icon.start",
  battle: "minimap.icon.battle",
  treasure: "minimap.icon.treasure",
  event: "minimap.icon.event",
  stairs: "minimap.icon.stairs",
  boss: "minimap.icon.boss",
});

export function buildMinimapReveal({
  floorPlan,
  currentRoomId,
  visitedRoomIds = [],
  discoveredStairsRoomIds = [],
  t = translate,
} = {}) {
  const rooms = floorPlan?.rooms ?? [];
  const visited = new Set(visitedRoomIds);
  const adjacent = collectAdjacentRoomIds(floorPlan, visited);
  const known = new Set([...visited, ...adjacent]);
  const stairsIds = collectStairsRoomIds(floorPlan);
  const discoveredStairs = new Set(discoveredStairsRoomIds);

  for (const roomId of stairsIds) {
    if (known.has(roomId)) {
      discoveredStairs.add(roomId);
    }
  }

  const roomStates = rooms.map((room) => {
    const isVisited = visited.has(room.id);
    const isAdjacent = adjacent.has(room.id);
    const isPersistentStairs = discoveredStairs.has(room.id);
    const reveal = isVisited ? "visited" : isAdjacent || isPersistentStairs ? "adjacent" : "hidden";

    return {
      ...room,
      reveal,
      current: room.id === currentRoomId,
      showIcon: isVisited || isPersistentStairs,
      iconKey: ROOM_ICON_KEYS[room.type] ?? "minimap.icon.room",
      icon: t(ROOM_ICON_KEYS[room.type] ?? "minimap.icon.room"),
      highlight: isPersistentStairs || room.id === currentRoomId,
    };
  });

  return {
    rooms: roomStates,
    discoveredStairsRoomIds: [...discoveredStairs].sort(),
  };
}

export function withDiscoveredStairsForRun(run) {
  const depth = run.depth;
  const previous = run.discoveredStairsRoomIdsByDepth?.[depth] ?? [];
  const reveal = buildMinimapReveal({
    floorPlan: run.floorPlan,
    currentRoomId: run.currentRoomId,
    visitedRoomIds: run.visitedRoomIdsByDepth?.[depth] ?? [],
    discoveredStairsRoomIds: previous,
  });

  if (arraysEqual(previous, reveal.discoveredStairsRoomIds)) {
    return run;
  }

  return {
    ...run,
    discoveredStairsRoomIdsByDepth: {
      ...run.discoveredStairsRoomIdsByDepth,
      [depth]: reveal.discoveredStairsRoomIds,
    },
  };
}

function collectAdjacentRoomIds(floorPlan, visited) {
  const adjacent = new Set();
  const byCoordinate = new Map((floorPlan?.rooms ?? []).map((room) => [toKey(room.gx, room.gy), room]));

  for (const room of floorPlan?.rooms ?? []) {
    if (!visited.has(room.id)) {
      continue;
    }

    for (const [direction, offset] of Object.entries(DIRECTIONS)) {
      if (!room.doors?.[direction]) {
        continue;
      }

      const neighbor = byCoordinate.get(toKey(room.gx + offset.dx, room.gy + offset.dy));
      if (neighbor && !visited.has(neighbor.id)) {
        adjacent.add(neighbor.id);
      }
    }
  }

  return adjacent;
}

function collectStairsRoomIds(floorPlan) {
  return (floorPlan?.rooms ?? [])
    .filter((room) => room.type === "stairs" || room.type === "boss" || room.id === floorPlan?.stairsRoomId)
    .map((room) => room.id);
}

function toKey(x, y) {
  return `${x}:${y}`;
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
