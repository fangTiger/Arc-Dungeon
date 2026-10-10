import { TILE_SIZE, setImageSmoothing } from "./pixelSurface.js";

const TILE_NAMES = [
  "floor",
  "floor_alt",
  "wall_top",
  "wall_face",
  "wall_corner_left",
  "wall_corner_right",
  "door_closed",
  "door_open",
  "portal",
  "merchant",
  "noticeboard",
  "hero",
  "void",
];

const PALETTE = {
  void: "#000000",
  deepest: "#05040a",
  seam: "#12101a",
  floorShadow: "#1a1724",
  floorBase: "#242130",
  floorAlt: "#2a2636",
  floorLight: "#393244",
  wallTopBase: "#2c2938",
  wallFaceBase: "#3b3549",
  wallLight: "#544b61",
  doorBase: "#4b3442",
  doorLight: "#6a5064",
  portalDark: "#20103c",
  portalBase: "#5c4fb0",
  portalLight: "#a2a0ff",
  merchantDark: "#2b160f",
  merchantBase: "#9b5b34",
  merchantLight: "#efc17e",
  boardDark: "#2a190f",
  boardBase: "#704326",
  boardLight: "#c28a52",
  heroOutline: "#05040a",
  heroDark: "#26334a",
  heroBase: "#4f7c9b",
  heroLight: "#d8e7df",
};

export function createPlaceholderTileset() {
  const image = createCanvas(TILE_NAMES.length * TILE_SIZE, TILE_SIZE);
  const context = image.getContext("2d");

  if (!context) {
    throw new Error("无法创建占位 tileset 上下文");
  }

  setImageSmoothing(context, false);

  const tiles = {};

  TILE_NAMES.forEach((name, index) => {
    const sx = index * TILE_SIZE;
    tiles[name] = { sx, sy: 0, sw: TILE_SIZE, sh: TILE_SIZE };
    drawTile(context, name, sx, 0);
  });

  return { image, tiles };
}

function drawTile(context, name, x, y) {
  if (name === "floor") {
    drawFloor(context, x, y, PALETTE.floorBase, 0);
  } else if (name === "floor_alt") {
    drawFloor(context, x, y, PALETTE.floorAlt, 1);
  } else if (name === "wall_top") {
    drawWallTop(context, x, y);
  } else if (name === "wall_face") {
    drawWallFace(context, x, y);
  } else if (name === "wall_corner_left") {
    drawWallCorner(context, x, y, "left");
  } else if (name === "wall_corner_right") {
    drawWallCorner(context, x, y, "right");
  } else if (name === "door_closed") {
    drawDoorClosed(context, x, y);
  } else if (name === "door_open") {
    drawDoorOpen(context, x, y);
  } else if (name === "portal") {
    drawPortal(context, x, y);
  } else if (name === "merchant") {
    drawMerchant(context, x, y);
  } else if (name === "noticeboard") {
    drawNoticeboard(context, x, y);
  } else if (name === "hero") {
    drawHero(context, x, y);
  } else {
    fill(context, x, y, TILE_SIZE, TILE_SIZE, PALETTE.void);
  }
}

function drawFloor(context, x, y, base, variant) {
  fill(context, x, y, TILE_SIZE, TILE_SIZE, base);
  fill(context, x, y + 7, TILE_SIZE, 1, PALETTE.seam);
  fill(context, x + 7, y, 1, 7, PALETTE.floorShadow);
  fill(context, x + 10, y + 8, 1, 8, PALETTE.floorShadow);

  const highlights = variant === 0
    ? [[2, 2], [12, 3], [5, 11], [14, 13]]
    : [[3, 4], [9, 2], [2, 13], [12, 10]];
  const shadows = variant === 0
    ? [[4, 5], [11, 8], [8, 14]]
    : [[6, 6], [14, 5], [7, 12]];

  for (const [px, py] of highlights) {
    fill(context, x + px, y + py, 1, 1, PALETTE.floorLight);
  }

  for (const [px, py] of shadows) {
    fill(context, x + px, y + py, 1, 1, PALETTE.floorShadow);
  }
}

function drawWallTop(context, x, y) {
  fill(context, x, y, TILE_SIZE, TILE_SIZE, PALETTE.wallTopBase);
  fill(context, x, y, TILE_SIZE, 1, PALETTE.wallLight);
  fill(context, x, y + 14, TILE_SIZE, 2, PALETTE.seam);
  fill(context, x + 5, y + 4, 7, 1, PALETTE.wallLight);
  fill(context, x + 2, y + 9, 10, 1, PALETTE.floorShadow);
  fill(context, x + 13, y + 2, 1, 8, PALETTE.floorShadow);
}

function drawWallFace(context, x, y) {
  fill(context, x, y, TILE_SIZE, TILE_SIZE, PALETTE.wallFaceBase);
  fill(context, x, y, TILE_SIZE, 1, PALETTE.seam);
  fill(context, x, y + 15, TILE_SIZE, 1, PALETTE.seam);
  fill(context, x + 1, y + 2, 14, 1, PALETTE.wallLight);
  fill(context, x + 3, y + 7, 9, 1, PALETTE.floorShadow);
  fill(context, x + 6, y + 11, 7, 1, PALETTE.wallLight);
}

function drawWallCorner(context, x, y, side) {
  drawWallFace(context, x, y);
  const borderX = side === "left" ? x : x + 15;
  const lightX = side === "left" ? x + 1 : x + 14;

  fill(context, borderX, y, 1, TILE_SIZE, PALETTE.seam);
  fill(context, lightX, y + 2, 1, 12, PALETTE.wallLight);
  fill(context, x + 4, y + 4, 8, 1, PALETTE.floorShadow);
}

function drawDoorClosed(context, x, y) {
  fill(context, x, y, TILE_SIZE, TILE_SIZE, PALETTE.wallFaceBase);
  fill(context, x, y, TILE_SIZE, 1, PALETTE.seam);
  fill(context, x + 3, y + 2, 10, 14, PALETTE.doorBase);
  fill(context, x + 4, y + 2, 8, 1, PALETTE.doorLight);
  fill(context, x + 3, y + 15, 10, 1, PALETTE.seam);
  fill(context, x + 6, y + 4, 1, 9, PALETTE.seam);
  fill(context, x + 10, y + 8, 1, 1, PALETTE.doorLight);
}

function drawDoorOpen(context, x, y) {
  fill(context, x, y, TILE_SIZE, TILE_SIZE, PALETTE.deepest);
  fill(context, x, y, TILE_SIZE, 1, PALETTE.seam);
  fill(context, x + 1, y + 1, 2, 14, PALETTE.wallFaceBase);
  fill(context, x + 13, y + 1, 2, 14, PALETTE.wallFaceBase);
  fill(context, x + 3, y + 13, 10, 2, PALETTE.floorShadow);
  fill(context, x + 5, y + 6, 6, 1, PALETTE.wallLight);
}

function drawPortal(context, x, y) {
  fill(context, x, y, TILE_SIZE, TILE_SIZE, PALETTE.deepest);
  fill(context, x + 4, y + 1, 8, 1, PALETTE.portalLight);
  fill(context, x + 2, y + 3, 2, 10, PALETTE.portalBase);
  fill(context, x + 12, y + 3, 2, 10, PALETTE.portalBase);
  fill(context, x + 4, y + 13, 8, 2, PALETTE.portalDark);
  fill(context, x + 5, y + 4, 6, 8, PALETTE.portalDark);
  fill(context, x + 7, y + 5, 2, 6, PALETTE.portalLight);
}

function drawMerchant(context, x, y) {
  fill(context, x, y, TILE_SIZE, TILE_SIZE, PALETTE.void);
  fill(context, x + 3, y + 2, 10, 3, PALETTE.merchantLight);
  fill(context, x + 2, y + 5, 12, 2, PALETTE.merchantBase);
  fill(context, x + 4, y + 7, 8, 6, PALETTE.merchantDark);
  fill(context, x + 5, y + 8, 6, 3, PALETTE.merchantBase);
  fill(context, x + 6, y + 9, 1, 1, PALETTE.deepest);
  fill(context, x + 10, y + 9, 1, 1, PALETTE.deepest);
  fill(context, x + 4, y + 14, 3, 1, PALETTE.heroOutline);
  fill(context, x + 10, y + 14, 3, 1, PALETTE.heroOutline);
}

function drawNoticeboard(context, x, y) {
  fill(context, x, y, TILE_SIZE, TILE_SIZE, PALETTE.void);
  fill(context, x + 3, y + 3, 10, 8, PALETTE.boardBase);
  fill(context, x + 3, y + 3, 10, 1, PALETTE.boardLight);
  fill(context, x + 3, y + 10, 10, 1, PALETTE.boardDark);
  fill(context, x + 5, y + 5, 6, 1, PALETTE.boardLight);
  fill(context, x + 5, y + 8, 5, 1, PALETTE.boardDark);
  fill(context, x + 4, y + 11, 2, 4, PALETTE.boardDark);
  fill(context, x + 10, y + 11, 2, 4, PALETTE.boardDark);
}

function drawHero(context, x, y) {
  fill(context, x, y, TILE_SIZE, TILE_SIZE, PALETTE.void);
  fill(context, x + 5, y + 2, 6, 2, PALETTE.heroOutline);
  fill(context, x + 4, y + 4, 8, 5, PALETTE.heroOutline);
  fill(context, x + 5, y + 4, 6, 4, PALETTE.heroLight);
  fill(context, x + 3, y + 9, 10, 5, PALETTE.heroOutline);
  fill(context, x + 4, y + 9, 8, 4, PALETTE.heroBase);
  fill(context, x + 5, y + 13, 2, 2, PALETTE.heroDark);
  fill(context, x + 9, y + 13, 2, 2, PALETTE.heroDark);
  fill(context, x + 6, y + 6, 1, 1, PALETTE.heroOutline);
  fill(context, x + 9, y + 6, 1, 1, PALETTE.heroOutline);
  fill(context, x + 7, y + 8, 2, 1, PALETTE.merchantBase);
  fill(context, x + 11, y + 10, 1, 3, PALETTE.heroLight);
}

function fill(context, x, y, width, height, color) {
  context.fillStyle = color;
  context.fillRect(x, y, width, height);
}

function createCanvas(width, height) {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  throw new Error("当前环境不支持 Canvas");
}
