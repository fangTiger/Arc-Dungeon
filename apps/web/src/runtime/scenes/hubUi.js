import {
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
  setImageSmoothing,
} from "../renderer/pixelSurface.js";
import { calculateHubHudLayout } from "../../core/ui/hudLayout.js";
import {
  drawCenteredPixelText,
  drawPixelPanel,
  drawPixelText,
} from "../ui/pixelUi.js";
import { drawGamePanel } from "./gamePanelUi.js";
import { drawHudInfoBar } from "./hudInfoBar.js";
import { translate } from "../../core/i18n/index.js";
import { setPixelFont } from "../ui/pixelFont.js";

export function drawHubHud(context, snapshot, tileset, { layout = calculateHubHudLayout(), t = translate } = {}) {
  const hudLayout = layout ?? calculateHubHudLayout();

  context.save();
  setImageSmoothing(context, false);
  drawHudInfoBar(context, { layout: hudLayout.infoBar, economySnapshot: snapshot, tileset, t });

  const warningBanner = snapshot?.serverSaveAvailable === true
    ? null
    : normalizeRect(hudLayout.warningBanner);
  if (warningBanner) {
    drawWarning(context, t("hub.warning.unsaved"), tileset, warningBanner);
  }

  context.restore();
  return {
    infoBar: normalizeRect(hudLayout.infoBar),
    warningBanner,
  };
}

export function drawHubInteractionLabels(context, labels) {
  context.save();
  for (const label of labels) {
    context.fillStyle = "rgba(10, 8, 13, 0.82)";
    context.fillRect(label.x, label.y, label.width, label.height);
    drawPixelText(context, label.text, label.x + 2, label.y + 1, {
      size: label.fontSize,
      color: "#fff0b3",
    });
  }
  context.restore();
}

export function drawHubPrompt(context, { nearbyInteraction, feedbackText, feedbackTimer }, tileset, { t = translate } = {}) {
  const text = feedbackTimer > 0
    ? feedbackText
    : nearbyInteraction
      ? t("hub.prompt.interact", {
        label: nearbyInteraction.labelKey ? t(nearbyInteraction.labelKey) : nearbyInteraction.label,
      })
      : "";

  if (!text) {
    return;
  }

  context.save();
  const rect = drawBottomTextPanel(context, text, tileset);
  context.restore();
  return rect;
}

export function drawHubPanel(context, panel, tileset, options) {
  return drawGamePanel(context, panel, tileset, options);
}

function drawWarning(context, text, tileset, layout) {
  const rect = normalizeRect(layout);

  drawPixelPanel(context, { tileset, ...rect, accent: "#e06b49", fill: "#2a1012" });
  drawPixelText(context, text, rect.x + 8, rect.y + 6, { color: "#ffe3a3" });
}

function drawBottomTextPanel(context, text, tileset) {
  setPixelFont(context, 10);
  const panelWidth = Math.min(
    INTERNAL_WIDTH - 16,
    Math.max(86, Math.ceil(context.measureText(text).width) + 20),
  );
  const panelX = Math.round((INTERNAL_WIDTH - panelWidth) / 2);
  const panelY = INTERNAL_HEIGHT - 26;

  drawPixelPanel(context, { tileset, x: panelX, y: panelY, width: panelWidth, height: 20, accent: "#d4af64" });
  drawCenteredPixelText(context, text, INTERNAL_WIDTH / 2, panelY + 6);
  return { x: panelX, y: panelY, width: panelWidth, height: 20 };
}

function normalizeRect(rect) {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}
