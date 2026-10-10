import { createRng, hashSeed } from "../rng.js";
import { isBossFloor, roomCountForDepth } from "./progression.js";

const GRID_WIDTH = 9;
const GRID_HEIGHT = 8;
const START_GX = Math.floor(GRID_WIDTH / 2);
const START_GY = Math.floor(GRID_HEIGHT / 2);
const MIN_DEAD_END_COUNT = 3;
const EXPANSION_SKIP_CHANCE = 0.5;

const DIRECTIONS = Object.freeze([
  Object.freeze({ name: "north", opposite: "south", dx: 0, dy: -1 }),
  Object.freeze({ name: "south", opposite: "north", dx: 0, dy: 1 }),
  Object.freeze({ name: "east", opposite: "west", dx: 1, dy: 0 }),
  Object.freeze({ name: "west", opposite: "east", dx: -1, dy: 0 }),
]);

export function generateFloorPlan({ depth, seed }) {
  const targetRoomCount = roomCountForDepth(depth);
  const positions = queueExpandedPositions({ seed, targetRoomCount });
  const positionByKey = new Map(positions.map((position) => [toKey(position.gx, position.gy), position]));
  const startRoomId = roomIdFor(START_GX, START_GY);
  const distances = calculateDistances(startRoomId, positions, positionByKey);
  const specialRooms = assignSpecialRooms({ depth, seed, positions, positionByKey, distances, startRoomId });
  const rooms = positions.map((position) => {
    const id = roomIdFor(position.gx, position.gy);

    return {
      id,
      gx: position.gx,
      gy: position.gy,
      type: specialRooms.typeById.get(id) ?? "battle",
      doors: buildDoors(position, positionByKey),
    };
  });

  return {
    depth,
    seed,
    grid: { width: GRID_WIDTH, height: GRID_HEIGHT },
    rooms,
    startRoomId,
    stairsRoomId: specialRooms.stairsRoomId,
    bossRoomId: specialRooms.bossRoomId,
  };
}

function queueExpandedPositions({ seed, targetRoomCount }) {
  if (targetRoomCount >= 7 && targetRoomCount <= 8) {
    return branchExpandedPositions({ seed, targetRoomCount });
  }

  const rng = createRng(seed);
  const positions = [{ gx: START_GX, gy: START_GY }];
  const occupied = new Set([toKey(START_GX, START_GY)]);
  let queue = [positions[0]];
  let additionsInPass = 0;
  let forceExpansion = false;

  while (positions.length < targetRoomCount) {
    if (queue.length === 0) {
      if (!hasExpandablePosition(positions, occupied)) {
        throw new Error("无法在地牢网格内生成足够房间");
      }

      forceExpansion = additionsInPass === 0;
      additionsInPass = 0;
      queue = rng.shuffle(positions);
    }

    additionsInPass += expandFromPosition({
      position: queue.shift(),
      positions,
      occupied,
      rng,
      targetRoomCount,
      forceExpansion,
    });
  }

  return positions;
}

function branchExpandedPositions({ seed, targetRoomCount }) {
  const rng = createRng(seed);
  const positions = [{ gx: START_GX, gy: START_GY }];
  const occupied = new Set([toKey(START_GX, START_GY)]);

  while (positions.length < targetRoomCount) {
    const expandable = positions.filter((position) => expandableDirections(position, occupied).length > 0);

    if (expandable.length === 0) {
      throw new Error("无法在地牢网格内生成足够房间");
    }

    const positionByKey = new Map(positions.map((position) => [toKey(position.gx, position.gy), position]));
    const distances = calculateDistances(roomIdFor(START_GX, START_GY), positions, positionByKey);
    const deadEndCount = countDeadEndPositions(positions, occupied);
    const branchRooms = expandable.filter((position) =>
      (position.gx === START_GX && position.gy === START_GY) || occupiedNeighborCount(position, occupied) !== 1,
    );
    const leafRooms = expandable.filter((position) => occupiedNeighborCount(position, occupied) === 1);
    const origin = deadEndCount < MIN_DEAD_END_COUNT && branchRooms.length > 0
      ? rng.pick(branchRooms)
      : pickDeepestRoom(leafRooms.length > 0 ? leafRooms : expandable, distances, rng);
    const direction = rng.pick(expandableDirections(origin, occupied));
    const next = { gx: origin.gx + direction.dx, gy: origin.gy + direction.dy };

    occupied.add(toKey(next.gx, next.gy));
    positions.push(next);
  }

  return positions;
}

function expandFromPosition({ position, positions, occupied, rng, targetRoomCount, forceExpansion }) {
  let additions = 0;

  for (const direction of rng.shuffle(expandableDirections(position, occupied))) {
    if (positions.length >= targetRoomCount) {
      break;
    }

    const next = { gx: position.gx + direction.dx, gy: position.gy + direction.dy };
    const key = toKey(next.gx, next.gy);

    if (
      !forceExpansion &&
      countDeadEndPositions(positions, occupied) >= MIN_DEAD_END_COUNT &&
      rng.next() < EXPANSION_SKIP_CHANCE
    ) {
      continue;
    }

    occupied.add(key);
    positions.push(next);
    additions += 1;
  }

  return additions;
}

function assignSpecialRooms({ depth, seed, positions, positionByKey, distances, startRoomId }) {
  const typeById = new Map([[startRoomId, "start"]]);
  const sortedDeadEnds = positions
    .filter((position) => neighborCount(position, positionByKey) === 1)
    .sort((left, right) => compareByDistanceThenId(right, left, distances));
  const exitCandidates = stairRoomCandidates(positions, distances, startRoomId);
  const exitRoom = pickExitRoom({ seed, depth, exitCandidates });
  const stairsRoomId = roomIdFor(exitRoom.gx, exitRoom.gy);
  const bossRoomId = isBossFloor(depth) ? stairsRoomId : null;

  typeById.set(stairsRoomId, isBossFloor(depth) ? "boss" : "stairs");
  assignDeadEndType(typeById, sortedDeadEnds, stairsRoomId, "treasure");
  assignDeadEndType(typeById, sortedDeadEnds, stairsRoomId, "event");

  return { typeById, stairsRoomId, bossRoomId };
}

function stairRoomCandidates(positions, distances, startRoomId) {
  const maxDistance = Math.max(...distances.values());
  const minimumDistance = Math.max(2, Math.ceil(maxDistance * 0.5));
  const remoteRooms = positions.filter((position) => {
    const id = roomIdFor(position.gx, position.gy);

    return id !== startRoomId && (distances.get(id) ?? 0) >= minimumDistance;
  });

  if (remoteRooms.length > 0) {
    return remoteRooms;
  }

  return positions.filter((position) => {
    const id = roomIdFor(position.gx, position.gy);

    return id !== startRoomId && (distances.get(id) ?? 0) === maxDistance;
  });
}

function pickExitRoom({ seed, depth, exitCandidates }) {
  const rng = createRng(hashSeed(`${seed}:depth:${depth}:stairs-room`));

  return rng.pick(exitCandidates);
}

function assignDeadEndType(typeById, sortedDeadEnds, reservedRoomId, type) {
  const room = sortedDeadEnds.find((candidate) => {
    const id = roomIdFor(candidate.gx, candidate.gy);

    return id !== reservedRoomId && !typeById.has(id);
  });

  if (room) {
    typeById.set(roomIdFor(room.gx, room.gy), type);
  }
}

function calculateDistances(startRoomId, positions, positionByKey) {
  const byId = new Map(positions.map((position) => [roomIdFor(position.gx, position.gy), position]));
  const distances = new Map([[startRoomId, 0]]);
  const queue = [startRoomId];

  while (queue.length > 0) {
    const room = byId.get(queue.shift());
    const nextDistance = distances.get(roomIdFor(room.gx, room.gy)) + 1;

    for (const neighbor of neighborsFor(room, positionByKey)) {
      const neighborId = roomIdFor(neighbor.gx, neighbor.gy);

      if (!distances.has(neighborId)) {
        distances.set(neighborId, nextDistance);
        queue.push(neighborId);
      }
    }
  }

  return distances;
}

function compareByDistanceThenId(left, right, distances) {
  const leftId = roomIdFor(left.gx, left.gy);
  const rightId = roomIdFor(right.gx, right.gy);
  const distanceDelta = (distances.get(leftId) ?? 0) - (distances.get(rightId) ?? 0);

  if (distanceDelta !== 0) {
    return distanceDelta;
  }

  return rightId.localeCompare(leftId);
}

function pickDeepestRoom(rooms, distances, rng) {
  const maxDistance = Math.max(...rooms.map((room) => distances.get(roomIdFor(room.gx, room.gy)) ?? 0));

  return rng.pick(
    rooms.filter((room) => (distances.get(roomIdFor(room.gx, room.gy)) ?? 0) === maxDistance),
  );
}

function expandableDirections(position, occupied) {
  return DIRECTIONS.filter((direction) => {
    const next = { gx: position.gx + direction.dx, gy: position.gy + direction.dy };

    return (
      isInsideGrid(next.gx, next.gy) &&
      !occupied.has(toKey(next.gx, next.gy)) &&
      occupiedNeighborCount(next, occupied) <= 1
    );
  });
}

function buildDoors(position, positionByKey) {
  return DIRECTIONS.reduce(
    (doors, direction) => ({
      ...doors,
      [direction.name]: positionByKey.has(toKey(position.gx + direction.dx, position.gy + direction.dy)),
    }),
    {},
  );
}

function neighborsFor(position, positionByKey) {
  return DIRECTIONS.map((direction) =>
    positionByKey.get(toKey(position.gx + direction.dx, position.gy + direction.dy)),
  ).filter(Boolean);
}

function neighborCount(position, positionByKey) {
  return neighborsFor(position, positionByKey).length;
}

function hasExpandablePosition(positions, occupied) {
  return positions.some((position) => expandableDirections(position, occupied).length > 0);
}

function countDeadEndPositions(positions, occupied) {
  return positions.filter((position) => occupiedNeighborCount(position, occupied) === 1).length;
}

function occupiedNeighborCount(position, occupied) {
  return DIRECTIONS.filter((direction) =>
    occupied.has(toKey(position.gx + direction.dx, position.gy + direction.dy)),
  ).length;
}

function isInsideGrid(gx, gy) {
  return gx >= 0 && gy >= 0 && gx < GRID_WIDTH && gy < GRID_HEIGHT;
}

function roomIdFor(gx, gy) {
  return `room-${gx}-${gy}`;
}

function toKey(gx, gy) {
  return `${gx},${gy}`;
}
