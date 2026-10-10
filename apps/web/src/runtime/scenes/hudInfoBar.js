import { setImageSmoothing } from "../renderer/pixelSurface.js";
import { drawPixelText } from "../ui/pixelUi.js";
import { formatCellCount } from "./bagGridUi.js";
import { translate } from "../../core/i18n/index.js";

const INFO_BAR_ITEMS = Object.freeze([
  Object.freeze({
    id: "accountTokens",
    frameName: "coin_anim_f0",
    glyph: null,
    valueKey: "accountTokens",
  }),
  Object.freeze({
    id: "runTokens",
    frameName: "coin_anim_f0",
    glyphKey: "hud.info.runGlyph",
    valueKey: "runTokens",
  }),
  Object.freeze({
    id: "tickets",
    frameName: "button_blue_up",
    glyphKey: "hud.info.ticketGlyph",
    valueKey: "tickets",
  }),
]);

const ITEM_POSITIONS = Object.freeze([
  Object.freeze({ iconX: 5, textX: 14 }),
  Object.freeze({ iconX: 41, textX: 52 }),
  Object.freeze({ iconX: 75, textX: 86 }),
]);

export function buildHudInfoBarItems({ run, economySnapshot, t = translate } = {}) {
  const values = {
    accountTokens: normalizeCount(economySnapshot?.balance?.tokens),
    runTokens: normalizeCount(run?.bag?.tokens),
    tickets: normalizeCount(economySnapshot?.profile?.tickets),
  };

  return INFO_BAR_ITEMS.map((item) => ({
    id: item.id,
    frameName: item.frameName,
    glyph: item.glyphKey ? t(item.glyphKey) : null,
    value: formatCellCount(values[item.valueKey]),
  }));
}

export function drawHudInfoBar(context, { layout, run, economySnapshot, tileset = null, t = translate } = {}) {
  if (!layout) {
    return;
  }

  const rect = normalizeRect(layout);
  const items = buildHudInfoBarItems({ run, economySnapshot, t });

  context.save();
  setImageSmoothing(context, false);
  drawInfoBarFrame(context, rect);
  items.forEach((item, index) => {
    drawInfoItem(context, {
      item,
      rect,
      position: ITEM_POSITIONS[index],
      tileset,
    });
  });
  context.restore();
  return rect;
}

function drawInfoBarFrame(context, rect) {
  context.fillStyle = "rgba(9, 8, 13, 0.86)";
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  context.fillStyle = "#4b5367";
  context.fillRect(rect.x, rect.y, rect.width, 1);
  context.fillRect(rect.x, rect.y + rect.height - 1, rect.width, 1);
  context.fillRect(rect.x, rect.y, 1, rect.height);
  context.fillRect(rect.x + rect.width - 1, rect.y, 1, rect.height);
}

function drawInfoItem(context, { item, rect, position, tileset }) {
  const iconX = Math.round(rect.x + position.iconX);
  const iconY = Math.round(rect.y + 3);
  const textX = Math.round(rect.x + position.textX);
  const textY = Math.round(rect.y + 2);

  if (item.glyph) {
    drawPixelText(context, item.glyph, iconX, textY, { color: "#f4d06f" });
  } else {
    drawFrameIcon(context, tileset, item.frameName, iconX, iconY);
  }

  drawPixelText(context, item.value, textX, textY, { color: "#f7efd0" });
}

function drawFrameIcon(context, tileset, frameName, x, y) {
  const frame = tileset?.frames?.[frameName] ?? tileset?.tiles?.[frameName] ?? null;
  const left = Math.round(x);
  const top = Math.round(y);

  if (!frame || !tileset?.image) {
    context.fillStyle = "#f0b45d";
    context.fillRect(left, top + 1, 6, 6);
    context.fillStyle = "#fff1bd";
    context.fillRect(left + 1, top + 2, 4, 1);
    return;
  }

  const source = getFrameBox(frame);
  context.drawImage(
    tileset.image,
    source.x,
    source.y,
    source.width,
    source.height,
    left,
    top,
    source.width,
    source.height,
  );
}

function getFrameBox(frame) {
  return {
    x: Math.round(frame.sx ?? frame.x),
    y: Math.round(frame.sy ?? frame.y),
    width: Math.round(frame.sw ?? frame.width),
    height: Math.round(frame.sh ?? frame.height),
  };
}

function normalizeRect(rect) {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function normalizeCount(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
