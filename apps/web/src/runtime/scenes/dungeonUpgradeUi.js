import {
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
} from "../renderer/pixelSurface.js";
import {
  drawCenteredPixelText,
  drawPixelHealthBar,
  drawPixelIcon,
  drawPixelPanel,
  drawPixelText,
  drawWrappedPixelText,
  fitPixelText,
} from "../ui/pixelUi.js";
import { translate } from "../../core/i18n/index.js";
import { localizeUpgrade } from "../../core/run/upgrades.js";

const CARD_WIDTH = 88;
const CARD_HEIGHT = 112;
const CARD_GAP = 8;
const CARD_Y = 40;
export function drawUpgradeChoiceOverlay(
  context,
  pendingChoice,
  tileset = null,
  { t = translate } = {},
) {
  if (!pendingChoice) {
    return;
  }

  const cardsWidth = CARD_WIDTH * 3 + CARD_GAP * 2;
  const startX = Math.round((INTERNAL_WIDTH - cardsWidth) / 2);
  const title = t(pendingChoice.trigger === "major" ? "upgrade.title.major" : "upgrade.title.minor");

  context.save();
  context.fillStyle = "rgba(4, 5, 8, 0.78)";
  context.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);
  drawCenteredPixelText(context, title, INTERNAL_WIDTH / 2, 18, { color: "#fff1bd" });

  const cards = pendingChoice.choices.map((choice, index) => {
    const x = startX + index * (CARD_WIDTH + CARD_GAP);
    return drawUpgradeCard(context, localizeUpgrade(choice, t), {
      x,
      y: CARD_Y,
      selected: index === pendingChoice.selectedIndex,
      index,
      tileset,
      t,
    });
  });

  drawCenteredPixelText(context, t("upgrade.footer"), INTERNAL_WIDTH / 2, INTERNAL_HEIGHT - 18, {
    color: "#b8c7df",
  });
  context.restore();
  return { bounds: { x: 0, y: 0, width: INTERNAL_WIDTH, height: INTERNAL_HEIGHT }, cards };
}

export function drawBossNameplate(context, boss, tileset = null) {
  if (!boss || boss.hp <= 0 || boss.state === "dead") {
    return;
  }

  const name = boss.name;
  const panelWidth = 140;
  const panelX = Math.round((INTERNAL_WIDTH - panelWidth) / 2);
  const panelY = 7;

  context.save();
  drawPixelPanel(context, {
    tileset,
    x: panelX,
    y: panelY,
    width: panelWidth,
    height: 32,
    accent: "#d65a42",
    fill: "#1c1014",
  });
  drawCenteredPixelText(context, fitPixelText(context, name, panelWidth - 18), INTERNAL_WIDTH / 2, panelY + 6, {
    color: "#ffe6bd",
  });
  drawPixelHealthBar(context, {
    x: panelX + 10,
    y: panelY + 21,
    width: panelWidth - 20,
    height: 5,
    hp: boss.hp,
    maxHp: boss.maxHp,
    previousHp: boss.hp,
  });
  context.restore();
}

function drawUpgradeCard(context, choice, { x, y, selected, index, tileset, t }) {
  const bounds = { x, y, width: CARD_WIDTH, height: CARD_HEIGHT };
  drawPixelPanel(context, {
    tileset,
    ...bounds,
    accent: selected ? "#ffd36e" : "#8d8064",
    fill: selected ? "#2b2019" : "#16121a",
  });

  drawPixelIcon(context, {
    x: x + 8,
    y: y + 9,
    color: choice.iconColor,
    glyph: t(`upgrade.icon.${choice.icon}`),
  });
  if (selected) {
    drawPixelText(context, "▶", x + 6, y + 10, { color: "#ffd36e" });
  }

  drawPixelText(context, `${index + 1}`, x + CARD_WIDTH - 17, y + 10, {
    color: selected ? "#ffd36e" : "#fff3c9",
  });
  drawPixelText(context, fitPixelText(context, choice.name, CARD_WIDTH - (selected ? 28 : 18)), x + (selected ? 18 : 8), y + 29, {
    color: "#fff3c9",
  });

  drawWrappedLines(context, choice.description, x + 8, y + 48, 54, "#e8ddbb", 3);
  const cost = choice.costDescription || t("upgrade.noCost");
  drawWrappedLines(context, cost, x + 8, y + 84, CARD_WIDTH - 24, choice.costDescription ? "#ffae91" : "#9fe6b2", 2);
  return bounds;
}

function drawWrappedLines(context, text, x, y, maxWidth, color, maxLines) {
  drawWrappedPixelText(context, text, x, y, maxWidth, {
    color,
    maxLines,
    lineHeight: 12,
  });
}
