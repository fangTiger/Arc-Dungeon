const DEFAULT_CANVAS_WIDTH = 320;
const DEFAULT_CANVAS_HEIGHT = 180;
const DEFAULT_SAFE_MARGIN = 8;
const DEFAULT_PANEL_WIDTH = 236;
const DEFAULT_HEADER_HEIGHT = 26;
const DEFAULT_FOOTER_HEIGHT = 20;
const DEFAULT_ROW_HEIGHT = 12;
const DEFAULT_ROW_GAP = 1;
const DEFAULT_CONTENT_MIN_WIDTH = 172;
const DEFAULT_CONTENT_MAX_WIDTH = 228;
const DEFAULT_CONTENT_PADDING = 32;

export function calculatePanelLayout({
  canvasWidth = DEFAULT_CANVAS_WIDTH,
  canvasHeight = DEFAULT_CANVAS_HEIGHT,
  rowCount,
  selectedIndex = 0,
  width = DEFAULT_PANEL_WIDTH,
  safeMargin = DEFAULT_SAFE_MARGIN,
  headerHeight = DEFAULT_HEADER_HEIGHT,
  footerHeight = DEFAULT_FOOTER_HEIGHT,
  rowHeight = DEFAULT_ROW_HEIGHT,
  rowGap = DEFAULT_ROW_GAP,
} = {}) {
  const safeRowCount = Math.max(0, Math.floor(Number(rowCount) || 0));
  const maxWidth = Math.max(1, Math.floor(canvasWidth - safeMargin * 2));
  const panelWidth = Math.min(Math.floor(width), maxWidth);
  const maxHeight = Math.max(1, Math.floor(canvasHeight - safeMargin * 2));
  const rowAreaMaxHeight = Math.max(rowHeight, maxHeight - headerHeight - footerHeight);
  const visibleCount = Math.max(0, Math.min(safeRowCount, countVisibleRows({
    rowAreaMaxHeight,
    rowHeight,
    rowGap,
  })));
  const selected = clamp(Math.floor(selectedIndex), 0, Math.max(0, safeRowCount - 1));
  const maxScrollOffset = Math.max(0, safeRowCount - visibleCount);
  const scrollOffset = clamp(selected - visibleCount + 1, 0, maxScrollOffset);
  const visibleStart = visibleCount === 0 ? 0 : scrollOffset;
  const visibleEnd = visibleStart + visibleCount;
  const rowAreaHeight = visibleCount > 0
    ? visibleCount * rowHeight + Math.max(0, visibleCount - 1) * rowGap
    : 0;
  const panelHeight = Math.min(maxHeight, headerHeight + rowAreaHeight + footerHeight);
  const panelX = Math.round((canvasWidth - panelWidth) / 2);
  const panelY = Math.round((canvasHeight - panelHeight) / 2);
  const rowArea = {
    x: panelX + 10,
    y: panelY + headerHeight,
    width: panelWidth - 20,
    height: rowAreaHeight,
  };

  return {
    bounds: {
      x: clamp(panelX, safeMargin, canvasWidth - safeMargin - panelWidth),
      y: clamp(panelY, safeMargin, canvasHeight - safeMargin - panelHeight),
      width: panelWidth,
      height: panelHeight,
    },
    rowArea,
    footer: {
      x: panelX + 10,
      y: panelY + panelHeight - footerHeight,
      width: panelWidth - 20,
      height: footerHeight,
    },
    rowHeight,
    rowGap,
    visibleStart,
    visibleEnd,
    visibleCount,
    overflow: safeRowCount > visibleCount,
    hasPrevious: visibleStart > 0,
    hasNext: visibleEnd < safeRowCount,
    rowRects: createRowRects({
      rowArea,
      rowHeight,
      rowGap,
      visibleStart,
      visibleEnd,
    }),
  };
}

export function calculatePanelContentWidth({
  title = "",
  lines = [],
  actions = [],
  minWidth = DEFAULT_CONTENT_MIN_WIDTH,
  maxWidth = DEFAULT_CONTENT_MAX_WIDTH,
  padding = DEFAULT_CONTENT_PADDING,
  measureText,
} = {}) {
  const texts = [
    title,
    ...normalizeLines(lines),
    ...normalizeActions(actions),
  ];
  const contentWidth = texts.reduce(
    (widest, text) => Math.max(widest, measurePanelTextWidth(text, measureText)),
    0,
  );
  const safeMin = Math.max(1, Math.floor(minWidth));
  const safeMax = Math.max(safeMin, Math.floor(maxWidth));

  return clamp(Math.ceil(contentWidth + padding), safeMin, safeMax);
}

function countVisibleRows({ rowAreaMaxHeight, rowHeight, rowGap }) {
  return Math.max(1, Math.floor((rowAreaMaxHeight + rowGap) / (rowHeight + rowGap)));
}

function normalizeLines(lines) {
  return Array.isArray(lines)
    ? lines.map((line) => line?.text ?? "").filter(Boolean)
    : [];
}

function normalizeActions(actions) {
  if (!Array.isArray(actions)) {
    return [];
  }

  return actions
    .map((action) => {
      const label = action?.label ?? action?.text ?? "";
      if (action?.disabled && action.disabledReason && !label.includes(action.disabledReason)) {
        return `${label}  ${action.disabledReason}`;
      }
      return label;
    })
    .filter(Boolean);
}

function measurePanelTextWidth(text, measureText) {
  if (typeof measureText === "function") {
    const measured = Number(measureText(String(text)));
    if (Number.isFinite(measured) && measured >= 0) return measured;
  }
  let width = 0;
  for (const char of String(text)) {
    width += measurePanelCharWidth(char);
  }
  return width;
}

function measurePanelCharWidth(char) {
  if (char === " ") {
    return 5;
  }
  return char.charCodeAt(0) > 255 ? 10 : 5;
}

function createRowRects({ rowArea, rowHeight, rowGap, visibleStart, visibleEnd }) {
  const rows = [];

  for (let index = visibleStart; index < visibleEnd; index += 1) {
    rows.push({
      index,
      x: rowArea.x,
      y: rowArea.y + (index - visibleStart) * (rowHeight + rowGap),
      width: rowArea.width,
      height: rowHeight,
    });
  }

  return rows;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}
