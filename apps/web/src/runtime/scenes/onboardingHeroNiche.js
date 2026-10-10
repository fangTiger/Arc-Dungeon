const TILE_SIZE = 16;
const FOUNTAIN_FRAME_INTERVAL_MS = 260;

export const HERO_NICHE_PORTAL_RECT = Object.freeze({
  x: 96,
  y: 32,
  width: 128,
  height: 96,
});

export const HERO_NICHE_PORTRAIT_RECT = Object.freeze({
  x: 136,
  y: 50,
  width: 48,
  height: 84,
});

const PEDESTAL = Object.freeze({
  leftColumnX: 128,
  rightColumnX: 184,
  columnY: 102,
  columnWidth: 8,
  columnHeight: 32,
  floorX: 128,
  floorY: 130,
  floorWidth: 64,
  floorTileWidth: 8,
  floorTileHeight: 8,
});

const DEFAULT_HERO_NICHE_LAYOUT = Object.freeze({
  visualRect: Object.freeze({ x: 48, y: 32, width: 224, height: 114 }),
  portalRect: HERO_NICHE_PORTAL_RECT,
  heroRect: HERO_NICHE_PORTRAIT_RECT,
  frameRects: Object.freeze([
    ["doors_leaf_open", 128, 64, 64, 64],
    ["doors_frame_left", 96, 64, 32, 64],
    ["doors_frame_right", 192, 64, 32, 64],
    ["doors_frame_top", 128, 32, 64, 32],
    ["column", 64, 58, 32, 70],
    ["column", 224, 58, 32, 70],
    ["wall_banner_red", 48, 46, 16, 32],
    ["wall_banner_red", 256, 46, 16, 32],
  ]),
  glowRects: Object.freeze([[132, 58, 56, 70], [150, 62, 20, 62]]),
  braziers: Object.freeze({
    xs: [72, 232], topY: 82, midY: 98, basinY: 114, width: 16, height: 16,
  }),
  pedestal: PEDESTAL,
});

// 登录页压缩壁龛结构但保留完整 48×84 立绘，角色选择页继续使用原始几何。
export const ENTRY_HERO_NICHE_LAYOUT = Object.freeze({
  visualRect: Object.freeze({ x: 48, y: 30, width: 224, height: 84 }),
  portalRect: Object.freeze({ x: 96, y: 30, width: 128, height: 84 }),
  heroRect: Object.freeze({ x: 136, y: 30, width: 48, height: 84 }),
  frameRects: Object.freeze([
    ["doors_leaf_open", 128, 50, 64, 64],
    ["doors_frame_left", 96, 50, 32, 64],
    ["doors_frame_right", 192, 50, 32, 64],
    ["doors_frame_top", 128, 30, 64, 20],
    ["column", 64, 44, 32, 70],
    ["column", 224, 44, 32, 70],
    ["wall_banner_red", 48, 38, 16, 32],
    ["wall_banner_red", 256, 38, 16, 32],
  ]),
  glowRects: Object.freeze([[132, 44, 56, 70], [150, 48, 20, 66]]),
  braziers: Object.freeze({
    xs: [72, 232], topY: 66, midY: 82, basinY: 98, width: 16, height: 16,
  }),
  pedestal: Object.freeze({
    leftColumnX: 128, rightColumnX: 184, columnY: 82,
    columnWidth: 8, columnHeight: 32, floorX: 128, floorY: 110,
    floorWidth: 64, floorTileWidth: 8, floorTileHeight: 4,
  }),
});

/**
 * 登录页与角色选择页共用的壁龛绘制入口。
 * structure 层画拱门、立柱和对称火盆；portrait 层画台座与大立绘。
 */
export function drawHeroNiche(context, tileset, options = {}) {
  if (options.layer === "structure") {
    return drawNicheStructure(context, tileset, options);
  }
  return drawNichePortrait(context, tileset, options);
}

function drawNicheStructure(context, tileset, options) {
  const elapsedMs = Math.max(0, Number(options.elapsedMs) || 0);
  const glowAlpha = Number.isFinite(options.glowAlpha) ? options.glowAlpha : 0.2;
  const layout = options.layout ?? DEFAULT_HERO_NICHE_LAYOUT;
  drawPortalGlow(context, glowAlpha, layout.glowRects);
  for (const [frameName, x, y, width, height] of layout.frameRects) {
    drawFrame(context, tileset, frameName, x, y, width, height);
  }
  const fountainFrameNames = drawBraziers(context, tileset, elapsedMs, layout.braziers);

  return {
    componentCount: 12,
    fountainFrameNames,
    portalRect: { ...layout.portalRect },
    visualRect: { ...layout.visualRect },
  };
}

function drawNichePortrait(context, tileset, options) {
  const elapsedMs = Math.max(0, Number(options.elapsedMs) || 0);
  const spritePrefix = options.spritePrefix ?? "knight_m";
  const classId = options.classId ?? "knight";
  const layout = options.layout ?? DEFAULT_HERO_NICHE_LAYOUT;
  const heroRect = normalizeRect(options.heroRect ?? layout.heroRect);
  drawPortraitPedestal(context, tileset, layout.pedestal);

  const frameIndex = Math.floor(elapsedMs / 220) % 4;
  const heroFrameName = `${spritePrefix}_idle_anim_f${frameIndex}`;
  const frame = getFrame(tileset, heroFrameName);
  if (tileset?.image && frame && typeof context.drawImage === "function") {
    context.drawImage(
      tileset.image,
      Math.round(frame.sx ?? frame.x),
      Math.round(frame.sy ?? frame.y),
      Math.round(frame.sw ?? frame.width),
      Math.round(frame.sh ?? frame.height),
      heroRect.x,
      heroRect.y,
      heroRect.width,
      heroRect.height,
    );
  } else {
    context.fillStyle = classId === "knight" ? "#d4af64" : "#71b7ff";
    context.fillRect(heroRect.x, heroRect.y, heroRect.width, heroRect.height);
  }

  return {
    heroFrameName,
    heroRect,
    pedestalRect: {
      x: layout.pedestal.floorX,
      y: layout.pedestal.columnY,
      width: layout.pedestal.floorWidth,
      height: layout.pedestal.floorY + layout.pedestal.floorTileHeight
        - layout.pedestal.columnY,
    },
  };
}

function drawPortraitPedestal(context, tileset, pedestal) {
  drawFrame(
    context,
    tileset,
    "column",
    pedestal.leftColumnX,
    pedestal.columnY,
    pedestal.columnWidth,
    pedestal.columnHeight,
  );
  drawFrame(
    context,
    tileset,
    "column",
    pedestal.rightColumnX,
    pedestal.columnY,
    pedestal.columnWidth,
    pedestal.columnHeight,
  );
  for (let x = pedestal.floorX; x < pedestal.floorX + pedestal.floorWidth;
    x += pedestal.floorTileWidth) {
    const floorIndex = Math.floor((x - pedestal.floorX) / pedestal.floorTileWidth) % 4 + 1;
    drawFrame(context, tileset, `floor_${floorIndex}`, x, pedestal.floorY,
      pedestal.floorTileWidth, pedestal.floorTileHeight);
  }
}

function drawBraziers(context, tileset, elapsedMs, layout) {
  const frameIndex = Math.floor(elapsedMs / FOUNTAIN_FRAME_INTERVAL_MS) % 3;
  const midFrameName = `wall_fountain_mid_blue_anim_f${frameIndex}`;
  const basinFrameName = `wall_fountain_basin_blue_anim_f${frameIndex}`;

  for (const [index, x] of layout.xs.entries()) {
    drawFrame(context, tileset, `wall_fountain_top_${index + 1}`,
      x, layout.topY, layout.width, layout.height);
    drawFrame(context, tileset, midFrameName, x, layout.midY, layout.width, layout.height);
    drawFrame(context, tileset, basinFrameName,
      x, layout.basinY, layout.width, layout.height);
    const flameLift = Math.floor(elapsedMs / 180 + index) % 2;
    context.fillStyle = "#f6d77a";
    context.fillRect(Math.round(x + 7), Math.round(layout.topY + 6 - flameLift), 3, 6);
    context.fillStyle = "#d46b32";
    context.fillRect(Math.round(x + 8), Math.round(layout.topY + 9 - flameLift), 2, 4);
  }
  return [midFrameName, basinFrameName];
}

function drawPortalGlow(context, alpha, [outerRect, innerRect]) {
  const previousAlpha = Number.isFinite(context.globalAlpha) ? context.globalAlpha : 1;
  context.globalAlpha = alpha;
  context.fillStyle = "#9bdcff";
  context.fillRect(...outerRect);
  context.globalAlpha = previousAlpha;
  context.fillStyle = "#dff7ff";
  context.fillRect(...innerRect);
}

function drawFrame(context, tileset, frameName, x, y, width, height) {
  const frame = getFrame(tileset, frameName);
  const target = [
    Math.round(x),
    Math.round(y),
    Math.round(width ?? frame?.width ?? frame?.sw ?? TILE_SIZE),
    Math.round(height ?? frame?.height ?? frame?.sh ?? TILE_SIZE),
  ];
  if (!tileset?.image || !frame || typeof context.drawImage !== "function") {
    context.fillStyle = "#332936";
    context.fillRect(...target);
    return;
  }
  context.drawImage(
    tileset.image,
    Math.round(frame.sx ?? frame.x),
    Math.round(frame.sy ?? frame.y),
    Math.round(frame.sw ?? frame.width),
    Math.round(frame.sh ?? frame.height),
    ...target,
  );
}

function getFrame(tileset, frameName) {
  return tileset?.frames?.[frameName] ?? tileset?.tiles?.[frameName] ?? null;
}

function normalizeRect(rect) {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}
