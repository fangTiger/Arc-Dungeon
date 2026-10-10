import {
  HUD_ICON_ENTRIES,
  HUD_ICON_GAP,
  HUD_ICON_SIZE,
} from "../../core/ui/hudLayout.js";
import {
  drawCenteredPixelText,
  drawPixelPanel,
  drawPixelText,
} from "../ui/pixelUi.js";
import { PAGES } from "./rolePanelUi.js";
import { translate } from "../../core/i18n/index.js";

const PROMPT_TEXT = "Tab";
const ICON_KEY_BY_PAGE = Object.freeze({
  attributes: "hud.icon.attributes",
  skills: "hud.icon.skills",
  bag: "hud.icon.bag",
  skins: "hud.icon.skins",
  identity: "hud.icon.identity",
});

export function buildHudIconBarItems({ layout, rolePanel, t = translate } = {}) {
  const rect = normalizeRect(layout);
  const selectedPageId = resolveSelectedPageId(rolePanel);

  return HUD_ICON_ENTRIES.map((entry, index) => ({
    pageId: entry.pageId,
    glyph: t(ICON_KEY_BY_PAGE[entry.pageId]),
    selected: entry.pageId === selectedPageId,
    rect: {
      x: Math.round(rect.x + index * (HUD_ICON_SIZE + HUD_ICON_GAP)),
      y: rect.y,
      width: HUD_ICON_SIZE,
      height: HUD_ICON_SIZE,
    },
  }));
}

export function shouldShowHudHintBanner(profile, inputHintSnapshot = null) {
  return profile?.hudHintSeen !== true && inputHintSnapshot === null;
}

export function drawHudIconBar(context, { layout, rolePanel, t = translate } = {}) {
  if (!layout) {
    return;
  }

  const rect = normalizeRect(layout);
  const items = buildHudIconBarItems({ layout: rect, rolePanel, t });

  context.save();
  drawIconBarFrame(context, rect);
  items.forEach((item) => {
    drawHudIcon(context, item);
  });
  drawTabPrompt(context, rect);
  context.restore();
  return { ...rect, height: Math.max(rect.height, 22) };
}

export function drawHudHintBanner(context, { layout, visible = false, tileset = null, t = translate } = {}) {
  if (!visible || !layout) {
    return;
  }

  const rect = normalizeRect(layout);

  context.save();
  drawPixelPanel(context, {
    tileset,
    ...rect,
    accent: "#f4d06f",
    fill: "#10141f",
  });
  [t("hud.hint.icons"), t("hud.hint.controls")].forEach((line, index) => {
    drawPixelText(context, line, Math.round(rect.x + 5), Math.round(rect.y + 2 + index * 10), {
      color: index === 0 ? "#f7efd0" : "#b8c7df",
    });
  });
  context.restore();
  return rect;
}

function drawIconBarFrame(context, rect) {
  context.fillStyle = "rgba(7, 7, 12, 0.62)";
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
}

function drawHudIcon(context, item) {
  const rect = normalizeRect(item.rect);
  const borderColor = item.selected ? "#f4d06f" : "#5f687d";
  const fillColor = item.selected ? "#f4d06f" : "#11121a";
  const textColor = item.selected ? "#171014" : "#f7efd0";

  context.fillStyle = fillColor;
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  context.fillStyle = borderColor;
  context.fillRect(rect.x, rect.y, rect.width, 1);
  context.fillRect(rect.x, rect.y + rect.height - 1, rect.width, 1);
  context.fillRect(rect.x, rect.y, 1, rect.height);
  context.fillRect(rect.x + rect.width - 1, rect.y, 1, rect.height);
  drawCenteredPixelText(context, item.glyph, rect.x + Math.round(rect.width / 2), rect.y + 1, {
    color: textColor,
  });
}

function drawTabPrompt(context, rect) {
  const textX = Math.round(rect.x + Math.round((rect.width - 15) / 2));
  const textY = Math.round(rect.y + 12);

  context.fillStyle = "rgba(7, 7, 12, 0.84)";
  context.fillRect(Math.round(textX - 1), Math.round(textY - 1), 17, 7);
  drawPixelText(context, PROMPT_TEXT, textX, textY, { color: "#b8c7df" });
}

function resolveSelectedPageId(rolePanel) {
  if (!rolePanel?.open) {
    return null;
  }

  const index = Math.max(0, Math.min(PAGES.length - 1, Math.floor(Number(rolePanel.pageIndex) || 0)));
  return PAGES[index]?.id ?? null;
}

function normalizeRect(rect) {
  return {
    x: Math.round(rect?.x ?? 0),
    y: Math.round(rect?.y ?? 0),
    width: Math.round(rect?.width ?? 0),
    height: Math.round(rect?.height ?? 0),
  };
}
