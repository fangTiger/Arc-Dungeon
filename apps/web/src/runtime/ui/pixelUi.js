import { buildNineSliceLayout } from "../../core/ui/nineSlice.js";
import { wrapPixelText } from "../../core/ui/textLayout.js";
import { calculateHealthBar } from "../../core/ui/healthBar.js";
import { setImageSmoothing } from "../renderer/pixelSurface.js";
import { PIXEL_FONT_SIZE, setPixelFont } from "./pixelFont.js";

const PANEL_TILE_SIZE = 8;
const PANEL_FILL = "#17121c";
const PANEL_SHADOW = "#09070d";
const PANEL_LIGHT = "#6d6177";
const TEXT_COLOR = "#f7efd0";
const RARITY_COLORS = Object.freeze({
  common: "#d2c6a3",
  rare: "#71b7ff",
  precious: "#f0b45d",
  chosen: "#f6d77a",
});

export function drawPixelPanel(context, options) {
  const layout = buildNineSliceLayout({
    x: Math.round(options.x),
    y: Math.round(options.y),
    width: Math.round(options.width),
    height: Math.round(options.height),
    tileSize: PANEL_TILE_SIZE,
  });
  const accent = options.accent ?? "#d2b56f";

  context.save();
  setImageSmoothing(context, false);
  context.fillStyle = options.fill ?? PANEL_FILL;
  context.fillRect(layout.fill.x, layout.fill.y, layout.fill.width, layout.fill.height);
  drawPanelPieces(context, options.tileset, layout, accent);
  context.fillStyle = PANEL_SHADOW;
  context.fillRect(layout.fill.x, layout.fill.y + layout.fill.height - 1, layout.fill.width, 1);
  context.fillStyle = PANEL_LIGHT;
  context.fillRect(layout.fill.x, layout.fill.y, layout.fill.width, 1);
  context.restore();
}

export function drawPixelText(context, text, x, y, options = {}) {
  setImageSmoothing(context, false);
  setPixelFont(context, options.size ?? PIXEL_FONT_SIZE);
  context.fillStyle = options.color ?? TEXT_COLOR;
  context.fillText(String(text), Math.round(x), Math.round(y));
  setImageSmoothing(context, false);
}

export function drawCenteredPixelText(context, text, centerX, y, options = {}) {
  setPixelFont(context, options.size ?? PIXEL_FONT_SIZE);
  const width = Math.ceil(context.measureText(String(text)).width);
  drawPixelText(context, text, Math.round(centerX - width / 2), y, options);
}

export function drawWrappedPixelText(context, text, x, y, maxWidth, options = {}) {
  const size = options.size ?? PIXEL_FONT_SIZE;
  const lineHeight = options.lineHeight ?? size + 2;
  setPixelFont(context, size);
  const lines = wrapPixelText(String(text), {
    maxWidth,
    cjkWidth: size,
    latinWidth: Math.ceil(size / 2),
    spaceWidth: Math.ceil(size / 2),
    measureChar: (char) => context.measureText(char).width,
  }).slice(0, options.maxLines ?? 4);

  lines.forEach((line, index) => {
    drawPixelText(context, line, x, y + index * lineHeight, options);
  });

  return lines.length;
}

export function fitPixelText(context, text, maxWidth, size = PIXEL_FONT_SIZE) {
  setPixelFont(context, size);
  if (context.measureText(text).width <= maxWidth) {
    return text;
  }

  let fitted = String(text);
  while (fitted.length > 1 && context.measureText(`${fitted}...`).width > maxWidth) {
    fitted = fitted.slice(0, -1);
  }

  return `${fitted}...`;
}

export function drawPixelIcon(context, { x, y, color = "#d2b56f", glyph = "?" }) {
  const left = Math.round(x);
  const top = Math.round(y);
  context.fillStyle = "#0d0a10";
  context.fillRect(left, top, 14, 14);
  context.fillStyle = color;
  context.fillRect(left + 2, top + 2, 10, 10);
  drawPixelText(context, glyph, left + 3, top + 2, { color: "#171014" });
}

export function drawPixelHealthBar(context, options) {
  const x = Math.round(options.x);
  const y = Math.round(options.y);
  const width = Math.round(options.width);
  const height = Math.round(options.height);
  const state = calculateHealthBar(options);
  const lowPulse = state.isLow ? (Math.sin((options.elapsedMs ?? 0) / 260) + 1) / 2 : 0;
  const fillColor = state.isLow && lowPulse > 0.52 ? "#ff6a4a" : "#d94f3f";

  context.fillStyle = "#10090d";
  context.fillRect(x, y, width, height);
  if (state.ghostWidth > state.fillWidth) {
    context.fillStyle = "#ffd86d";
    context.fillRect(x, y, state.ghostWidth, height);
  }
  context.fillStyle = fillColor;
  context.fillRect(x, y, state.fillWidth, height);
  context.fillStyle = "#ffe5a1";
  context.fillRect(x, y, state.fillWidth, 1);
  context.fillStyle = "#070509";
  context.fillRect(x - 1, y - 1, width + 2, 1);
  context.fillRect(x - 1, y + height, width + 2, 1);
  context.fillRect(x - 1, y, 1, height);
  context.fillRect(x + width, y, 1, height);
}

export function getRarityBorderColor(rarity) {
  return RARITY_COLORS[rarity] ?? RARITY_COLORS.common;
}

function drawPanelPieces(context, tileset, layout, accent) {
  const corners = layout.corners;
  drawPiece(context, tileset, "wall_top_left", corners.topLeft, { sx: 0, sy: 0, color: accent });
  drawPiece(context, tileset, "wall_top_right", corners.topRight, { sx: 8, sy: 0, color: accent });
  drawPiece(context, tileset, "wall_left", corners.bottomLeft, { sx: 0, sy: 8, color: accent });
  drawPiece(context, tileset, "wall_right", corners.bottomRight, { sx: 8, sy: 8, color: accent });

  layout.edges.top.forEach((part) => drawPiece(context, tileset, "wall_top_mid", part, { sx: 0, sy: 0 }));
  layout.edges.right.forEach((part) => drawPiece(context, tileset, "wall_right", part, { sx: 8, sy: 0 }));
  layout.edges.bottom.forEach((part) => drawPiece(context, tileset, "wall_mid", part, { sx: 0, sy: 8 }));
  layout.edges.left.forEach((part) => drawPiece(context, tileset, "wall_left", part, { sx: 0, sy: 0 }));

  context.fillStyle = accent;
  context.fillRect(layout.bounds.x + 1, layout.bounds.y + 1, layout.bounds.width - 2, 1);
}

function drawPiece(context, tileset, frameName, dest, { sx = 0, sy = 0, color = null } = {}) {
  const frame = tileset?.frames?.[frameName] ?? tileset?.tiles?.[frameName] ?? null;
  if (!tileset?.image || !frame) {
    context.fillStyle = color ?? "#41384c";
    context.fillRect(dest.x, dest.y, dest.width, dest.height);
    return;
  }

  const sourceX = (frame.sx ?? frame.x) + sx;
  const sourceY = (frame.sy ?? frame.y) + sy;
  context.drawImage(
    tileset.image,
    sourceX,
    sourceY,
    dest.width,
    dest.height,
    dest.x,
    dest.y,
    dest.width,
    dest.height,
  );
}
