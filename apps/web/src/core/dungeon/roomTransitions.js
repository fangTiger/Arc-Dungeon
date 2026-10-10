export const ROOM_DIRECTIONS = Object.freeze({
  north: Object.freeze({ name: "north", opposite: "south", dx: 0, dy: -1, side: "top" }),
  south: Object.freeze({ name: "south", opposite: "north", dx: 0, dy: 1, side: "bottom" }),
  west: Object.freeze({ name: "west", opposite: "east", dx: -1, dy: 0, side: "left" }),
  east: Object.freeze({ name: "east", opposite: "west", dx: 1, dy: 0, side: "right" }),
});

export const ROOM_DIRECTION_NAMES = Object.freeze(Object.keys(ROOM_DIRECTIONS));

export function getEntryPositionAfterExit({
  exitDirection,
  width,
  height,
  tileSize,
}) {
  validateRoomMetrics(width, height, tileSize);
  const direction = readDirection(exitDirection);
  const entrySide = ROOM_DIRECTIONS[direction.opposite].side;

  return getEntryPositionForSide({ side: entrySide, width, height, tileSize });
}

export function getDoorDefinitionsForRoom(room, { width, height }) {
  validateRoomSize(width, height);

  return ROOM_DIRECTION_NAMES
    .filter((directionName) => Boolean(room?.doors?.[directionName]))
    .map((directionName) => getDoorDefinition(directionName, { width, height }));
}

export function getNeighborRoomId(floorPlan, room, exitDirection) {
  const direction = readDirection(exitDirection);
  const targetGx = room.gx + direction.dx;
  const targetGy = room.gy + direction.dy;
  const neighbor = floorPlan.rooms.find(
    (candidate) => candidate.gx === targetGx && candidate.gy === targetGy,
  );

  return neighbor?.id ?? null;
}

export function getExitDirectionForPosition({
  x,
  y,
  width,
  height,
  tileSize,
  margin = 0,
}) {
  validateRoomMetrics(width, height, tileSize);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  const pixelWidth = width * tileSize;
  const pixelHeight = height * tileSize;

  if (y < margin && isInsideHorizontalDoor(x, width, tileSize)) {
    return "north";
  }

  if (y > pixelHeight - margin && isInsideHorizontalDoor(x, width, tileSize)) {
    return "south";
  }

  if (x < margin && isInsideVerticalDoor(y, height, tileSize)) {
    return "west";
  }

  if (x > pixelWidth - margin && isInsideVerticalDoor(y, height, tileSize)) {
    return "east";
  }

  return null;
}

export function isInsideDoorway({ direction, x, y, width, height, tileSize }) {
  validateRoomMetrics(width, height, tileSize);
  readDirection(direction);

  if (direction === "north" || direction === "south") {
    return isInsideHorizontalDoor(x, width, tileSize);
  }

  return isInsideVerticalDoor(y, height, tileSize);
}

function getEntryPositionForSide({ side, width, height, tileSize }) {
  const centerX = Math.round((width * tileSize) / 2);
  const centerY = getVerticalDoorCenter(height, tileSize);

  if (side === "top") {
    return { x: centerX, y: 2 * tileSize + tileSize / 2 };
  }

  if (side === "bottom") {
    return { x: centerX, y: (height - 3) * tileSize + tileSize / 2 };
  }

  if (side === "left") {
    return { x: tileSize + tileSize / 2, y: centerY };
  }

  if (side === "right") {
    return { x: (width - 2) * tileSize + tileSize / 2, y: centerY };
  }

  throw new RangeError("未知门洞边");
}

function getDoorDefinition(directionName, { width, height }) {
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  if (directionName === "north") {
    return { side: "top", fromX: centerX - 1, toX: centerX };
  }

  if (directionName === "south") {
    return { side: "bottom", fromX: centerX - 1, toX: centerX };
  }

  if (directionName === "west") {
    return { side: "left", fromY: centerY, toY: centerY };
  }

  return { side: "right", fromY: centerY, toY: centerY };
}

function isInsideHorizontalDoor(x, width, tileSize) {
  const centerX = Math.floor(width / 2);
  const fromX = (centerX - 1) * tileSize;
  const toX = (centerX + 1) * tileSize;

  return x >= fromX && x <= toX;
}

function isInsideVerticalDoor(y, height, tileSize) {
  const centerY = Math.floor(height / 2);
  const fromY = centerY * tileSize;
  const toY = (centerY + 1) * tileSize;

  return y >= fromY && y <= toY;
}

function getVerticalDoorCenter(height, tileSize) {
  return Math.floor(height / 2) * tileSize + tileSize / 2;
}

function readDirection(directionName) {
  const direction = ROOM_DIRECTIONS[directionName];

  if (!direction) {
    throw new RangeError("未知房间方向");
  }

  return direction;
}

function validateRoomMetrics(width, height, tileSize) {
  validateRoomSize(width, height);

  if (!Number.isInteger(tileSize) || tileSize <= 0) {
    throw new RangeError("tileSize 必须是正整数");
  }
}

function validateRoomSize(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new TypeError("房间尺寸必须是整数");
  }

  if (width < 4 || height < 4) {
    throw new RangeError("房间尺寸必须至少为 4x4");
  }
}
