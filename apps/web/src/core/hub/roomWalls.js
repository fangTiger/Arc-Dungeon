const TOP_OFFSET_Y = 0;

const WALL_TILES = Object.freeze({
  topLeft: Object.freeze({ name: "wall_top_left", offsetY: TOP_OFFSET_Y }),
  topMid: Object.freeze({ name: "wall_top_mid", offsetY: TOP_OFFSET_Y }),
  topRight: Object.freeze({ name: "wall_top_right", offsetY: TOP_OFFSET_Y }),
  faceLeft: Object.freeze({ name: "wall_left", offsetY: 0 }),
  faceMid: Object.freeze({ name: "wall_mid", offsetY: 0 }),
  faceRight: Object.freeze({ name: "wall_right", offsetY: 0 }),
  edgeTopLeft: Object.freeze({ name: "wall_edge_top_left", offsetY: 0 }),
  edgeLeft: Object.freeze({ name: "wall_edge_left", offsetY: 0 }),
  edgeBottomLeft: Object.freeze({ name: "wall_edge_bottom_left", offsetY: 0 }),
  edgeTopRight: Object.freeze({ name: "wall_edge_top_right", offsetY: 0 }),
  edgeRight: Object.freeze({ name: "wall_edge_right", offsetY: 0 }),
  edgeBottomRight: Object.freeze({ name: "wall_edge_bottom_right", offsetY: 0 }),
});

export function buildRoomWalls({ width, height, doors = [] }) {
  validateRoomSize(width, height);
  const doorSet = buildDoorSet(doors, width, height);
  const walls = Array.from({ length: height }, () => Array.from({ length: width }, () => null));

  for (let x = 0; x < width; x += 1) {
    setWall(walls, doorSet, x, 0, pickTopTile(x, width));
    setWall(walls, doorSet, x, 1, pickFaceTile(x, width));
    setWall(walls, doorSet, x, height - 2, pickBottomTopTile(x, width));
    setWall(walls, doorSet, x, height - 1, pickBottomFaceTile(x, width));
  }

  for (let y = 2; y < height - 2; y += 1) {
    setWall(walls, doorSet, 0, y, pickLeftTile(y));
    setWall(walls, doorSet, width - 1, y, pickRightTile(y));
  }

  return walls;
}

function pickTopTile(x, width) {
  if (x === 0) {
    return WALL_TILES.topLeft;
  }

  if (x === width - 1) {
    return WALL_TILES.topRight;
  }

  return WALL_TILES.topMid;
}

function pickFaceTile(x, width) {
  if (x === 0) {
    return WALL_TILES.faceLeft;
  }

  if (x === width - 1) {
    return WALL_TILES.faceRight;
  }

  return WALL_TILES.faceMid;
}

function pickBottomTopTile(x, width) {
  if (x === 0) {
    return WALL_TILES.edgeLeft;
  }

  if (x === width - 1) {
    return WALL_TILES.edgeRight;
  }

  if (x === 1) {
    return WALL_TILES.faceLeft;
  }

  if (x === width - 2) {
    return WALL_TILES.faceRight;
  }

  return WALL_TILES.faceMid;
}

function pickBottomFaceTile(x, width) {
  if (x === 0) {
    return WALL_TILES.edgeBottomLeft;
  }

  if (x === width - 1) {
    return WALL_TILES.edgeBottomRight;
  }

  if (x === 1) {
    return WALL_TILES.faceLeft;
  }

  if (x === width - 2) {
    return WALL_TILES.faceRight;
  }

  return WALL_TILES.faceMid;
}

function pickLeftTile(y) {
  if (y === 2) {
    return WALL_TILES.edgeTopLeft;
  }

  return WALL_TILES.edgeLeft;
}

function pickRightTile(y) {
  if (y === 2) {
    return WALL_TILES.edgeTopRight;
  }

  return WALL_TILES.edgeRight;
}

function setWall(walls, doorSet, x, y, tile) {
  if (!doorSet.has(toKey(x, y))) {
    walls[y][x] = tile;
  }
}

function buildDoorSet(doors, width, height) {
  const doorSet = new Set();

  for (const door of doors) {
    if (door.side === "top") {
      for (let x = door.fromX; x <= door.toX; x += 1) {
        addIfInside(doorSet, width, height, x, 0);
        addIfInside(doorSet, width, height, x, 1);
      }
    } else if (door.side === "bottom") {
      for (let x = door.fromX; x <= door.toX; x += 1) {
        addIfInside(doorSet, width, height, x, height - 2);
        addIfInside(doorSet, width, height, x, height - 1);
      }
    } else if (door.side === "left") {
      for (let y = door.fromY; y <= door.toY; y += 1) {
        addIfInside(doorSet, width, height, 0, y);
      }
    } else if (door.side === "right") {
      for (let y = door.fromY; y <= door.toY; y += 1) {
        addIfInside(doorSet, width, height, width - 1, y);
      }
    }
  }

  return doorSet;
}

function addIfInside(doorSet, width, height, x, y) {
  if (x >= 0 && y >= 0 && x < width && y < height) {
    doorSet.add(toKey(x, y));
  }
}

function toKey(x, y) {
  return `${x},${y}`;
}

function validateRoomSize(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new TypeError("房间尺寸必须是整数");
  }

  if (width < 4 || height < 4) {
    throw new RangeError("房间尺寸必须至少为 4x4");
  }
}
