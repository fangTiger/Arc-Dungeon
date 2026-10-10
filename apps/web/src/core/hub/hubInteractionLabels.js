import { hubMap } from "./hubMap.js";
import { calculateHubDecorSpriteRects } from "./hubDecor.js";
import { CANVAS, calculateHubHudLayout } from "../ui/hudLayout.js";
import { translate } from "../i18n/index.js";
import { measurePixelText } from "../ui/textLayout.js";

const LABEL_FONT_SIZE = 10;
const LABEL_PADDING_X = 2;
const LABEL_HEIGHT = 12;
const LABEL_GAP = 8;

/**
 * 计算大厅交互点的常驻标签，并使用 HUD 实际布局排除遮挡位置。
 */
export function calculateHubInteractionLabels({
  map = hubMap,
  hudLayout = calculateHubHudLayout(),
  canvasWidth = CANVAS.width,
  canvasHeight = CANVAS.height,
  decorRects = calculateHubDecorSpriteRects(map),
  t = translate,
  measureText = (text) => measurePixelText(text),
} = {}) {
  const hudRects = Object.values(hudLayout);
  const labels = [];

  for (const interaction of map.interactions) {
    const text = interaction.labelKey ? t(interaction.labelKey) : interaction.label;
    const width = Math.min(
      canvasWidth,
      Math.ceil(measureText(text)) + LABEL_PADDING_X * 2,
    );
    const candidates = createCandidates(interaction, map.tileSize, width);
    const idealRect = findIdealRect({
      candidates,
      canvasWidth,
      canvasHeight,
      hudRects,
      decorRects,
      labels,
    });
    const rect = idealRect ?? findBestFallbackRect({
      interaction,
      width,
      height: LABEL_HEIGHT,
      canvasWidth,
      canvasHeight,
      hudRects,
      decorRects,
      labels,
    });

    labels.push(Object.freeze({
      interactionId: interaction.id,
      text,
      fontSize: LABEL_FONT_SIZE,
      ...rect,
    }));
  }

  return Object.freeze(labels);
}

function findIdealRect({
  candidates,
  canvasWidth,
  canvasHeight,
  hudRects,
  decorRects,
  labels,
}) {
  return candidates
    .map((candidate) => clampToCanvas(candidate, canvasWidth, canvasHeight))
    .find((candidate) =>
      hudRects.every((hudRect) => !rectanglesIntersect(candidate, hudRect))
      && decorRects.every((decorRect) => !rectanglesIntersect(candidate, decorRect))
      && labels.every((label) => !rectanglesIntersect(candidate, label)));
}

/**
 * 理想候选位耗尽时遍历整数坐标，优先避开 HUD 与陈设，再最小化标签重叠面积。
 * 距离只用于相同重叠分数的稳定决胜，保证相同输入始终得到同一位置。
 */
function findBestFallbackRect({
  interaction,
  width,
  height,
  canvasWidth,
  canvasHeight,
  hudRects,
  decorRects,
  labels,
}) {
  const maxX = Math.max(0, canvasWidth - width);
  const maxY = Math.max(0, canvasHeight - height);
  let bestRect = createRect(0, 0, width);
  let bestScore = null;

  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= maxX; x += 1) {
      const rect = createRect(x, y, width);
      const score = scoreFallbackRect(rect, interaction, hudRects, decorRects, labels);
      if (!bestScore || compareScores(score, bestScore) < 0) {
        bestRect = rect;
        bestScore = score;
      }
    }
  }

  return bestRect;
}

function scoreFallbackRect(rect, interaction, hudRects, decorRects, labels) {
  const fixedRects = [...hudRects, ...decorRects];
  const fixedOverlapArea = sumOverlapArea(rect, fixedRects);
  const labelOverlapArea = sumOverlapArea(rect, labels);
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const distanceSquared = (centerX - interaction.interactX) ** 2
    + (centerY - interaction.interactY) ** 2;

  return [
    fixedOverlapArea,
    labelOverlapArea,
    countIntersections(rect, fixedRects),
    countIntersections(rect, labels),
    distanceSquared,
    rect.y,
    rect.x,
  ];
}

function sumOverlapArea(rect, obstacles) {
  return obstacles.reduce((total, obstacle) => total + overlapArea(rect, obstacle), 0);
}

function overlapArea(first, second) {
  const width = Math.max(
    0,
    Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x),
  );
  const height = Math.max(
    0,
    Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y),
  );
  return width * height;
}

function countIntersections(rect, obstacles) {
  return obstacles.filter((obstacle) => rectanglesIntersect(rect, obstacle)).length;
}

function compareScores(first, second) {
  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) {
      return first[index] - second[index];
    }
  }
  return 0;
}

function createCandidates(interaction, tileSize, width) {
  const centerX = interaction.interactX;
  const tileTop = interaction.tileY * tileSize;
  const tileBottom = (interaction.tileY + 1) * tileSize;
  const centeredX = Math.round(centerX - width / 2);

  return [
    createRect(centeredX, tileBottom + LABEL_GAP, width),
    createRect(centeredX, tileTop - LABEL_HEIGHT - LABEL_GAP, width),
    createRect((interaction.tileX + 1) * tileSize + LABEL_GAP, tileTop, width),
    createRect(interaction.tileX * tileSize - width - LABEL_GAP, tileTop, width),
  ];
}

function createRect(x, y, width) {
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: LABEL_HEIGHT,
  };
}

function clampToCanvas(rect, canvasWidth, canvasHeight) {
  return {
    ...rect,
    x: Math.max(0, Math.min(canvasWidth - rect.width, rect.x)),
    y: Math.max(0, Math.min(canvasHeight - rect.height, rect.y)),
  };
}

function rectanglesIntersect(first, second) {
  return (
    first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y
  );
}
