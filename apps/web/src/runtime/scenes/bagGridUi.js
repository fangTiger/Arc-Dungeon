import {
  INVENTORY_GRID_COLUMNS,
  INVENTORY_GRID_VISIBLE_ROWS,
  buildInventoryGrid,
} from "../../core/ui/inventoryGrid.js";
import {
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
  setImageSmoothing,
} from "../renderer/pixelSurface.js";
import {
  drawPixelPanel,
} from "../ui/pixelUi.js";
import { translate } from "../../core/i18n/index.js";
import {
  drawFooter,
  drawGrid,
  drawPageTabs,
  drawScrollHints,
  drawSelectedDetails,
} from "./bagGridRender.js";

export { formatCellCount } from "./bagGridRender.js";

export const BAG_GRID_CELL_WIDTH = 24;
export const BAG_GRID_CELL_HEIGHT = 30;
export const BAG_GRID_COLUMN_GAP = 3;
export const BAG_GRID_ROW_GAP = 3;

const PANEL_WIDTH = 184;
const PANEL_PADDING_X = 20;
const HEADER_HEIGHT = 22;
const DETAIL_HEIGHT = 28;
const FOOTER_HEIGHT = 18;
const GRID_WIDTH = INVENTORY_GRID_COLUMNS * BAG_GRID_CELL_WIDTH
  + (INVENTORY_GRID_COLUMNS - 1) * BAG_GRID_COLUMN_GAP;
const GRID_HEIGHT = INVENTORY_GRID_VISIBLE_ROWS * BAG_GRID_CELL_HEIGHT
  + (INVENTORY_GRID_VISIBLE_ROWS - 1) * BAG_GRID_ROW_GAP;
const CONTRACT_MAX_ITEM_COUNT = 4 + 10 + 1;

assertBagGridPanelFits();

export function drawBagGridPanel(context, options, state, tileset = null, tabs = null, { t = translate } = {}) {
  const grid = createBagGrid(options, t);
  const selectedIndex = normalizeSelectedIndex(grid, state?.inventorySelectedIndex);
  const layout = calculateBagGridPanelLayout({
    rowCount: grid.rowCount,
    selectedIndex,
  });
  const selectedCell = grid.cells[selectedIndex] ?? null;
  const tabsFocused = Boolean(state?.bagFocusOnTabs);

  context.save();
  setImageSmoothing(context, false);
  drawPixelPanel(context, { tileset, ...layout.bounds, accent: "#96cdff" });
  const tabLayout = drawPageTabs(context, layout, tabs, tabsFocused, t);
  drawGrid(
    context,
    tileset,
    grid,
    selectedIndex,
    tabsFocused ? -1 : selectedIndex,
    layout,
  );
  drawSelectedDetails(
    context,
    tabsFocused ? null : selectedCell,
    layout,
    tabsFocused,
    t,
  );
  drawFooter(context, layout, tabsFocused, t);
  drawScrollHints(context, layout);
  context.restore();
  return { grid, selectedIndex, layout, tabLayout };
}

export function createBagGrid({ run, economySnapshot, runPickups = [] } = {}, t = translate) {
  return buildInventoryGrid({
    profile: economySnapshot?.profile ?? {},
    balance: economySnapshot?.balance ?? {},
    runBag: run?.bag ?? {},
    runPickups,
    t,
  });
}

export function calculateBagGridPanelLayout({ rowCount, selectedIndex = 0 } = {}) {
  const safeRowCount = Math.max(1, Math.floor(Number(rowCount) || 1));
  const visibleRows = Math.min(INVENTORY_GRID_VISIBLE_ROWS, safeRowCount);
  const selectedRow = Math.floor(Math.max(0, selectedIndex) / INVENTORY_GRID_COLUMNS);
  const maxStartRow = Math.max(0, safeRowCount - visibleRows);
  const visibleStartRow = clamp(selectedRow - visibleRows + 1, 0, maxStartRow);
  const visibleEndRow = visibleStartRow + visibleRows;
  const panelHeight = HEADER_HEIGHT + GRID_HEIGHT + DETAIL_HEIGHT + FOOTER_HEIGHT;
  const bounds = {
    x: Math.round((INTERNAL_WIDTH - PANEL_WIDTH) / 2),
    y: Math.round((INTERNAL_HEIGHT - panelHeight) / 2),
    width: PANEL_WIDTH,
    height: panelHeight,
  };
  const gridX = Math.round(bounds.x + (PANEL_WIDTH - GRID_WIDTH) / 2);
  const gridY = Math.round(bounds.y + HEADER_HEIGHT);

  return {
    bounds,
    grid: {
      x: gridX,
      y: gridY,
      width: GRID_WIDTH,
      height: GRID_HEIGHT,
    },
    detail: {
      x: Math.round(bounds.x + PANEL_PADDING_X),
      y: Math.round(gridY + GRID_HEIGHT + 7),
      width: Math.round(PANEL_WIDTH - PANEL_PADDING_X * 2),
      height: DETAIL_HEIGHT,
    },
    footer: {
      x: Math.round(bounds.x + 10),
      y: Math.round(bounds.y + bounds.height - FOOTER_HEIGHT),
      width: Math.round(PANEL_WIDTH - 20),
      height: FOOTER_HEIGHT,
    },
    visibleStartRow,
    visibleEndRow,
    hasPrevious: visibleStartRow > 0,
    hasNext: visibleEndRow < safeRowCount,
  };
}

export function normalizeSelectedIndex(grid, index) {
  const cells = Array.isArray(grid?.cells) ? grid.cells : [];
  const fallback = cells.findIndex((cell) => !cell.empty);
  const candidate = Math.floor(Number(index) || 0);

  if (cells[candidate] && !cells[candidate].empty) {
    return candidate;
  }

  return Math.max(0, fallback);
}

function assertBagGridPanelFits() {
  const layout = calculateBagGridPanelLayout({
    rowCount: Math.ceil(CONTRACT_MAX_ITEM_COUNT / INVENTORY_GRID_COLUMNS),
    selectedIndex: 0,
  });

  if (
    layout.bounds.x < 0 ||
    layout.bounds.y < 0 ||
    layout.bounds.x + layout.bounds.width > INTERNAL_WIDTH ||
    layout.bounds.y + layout.bounds.height > INTERNAL_HEIGHT
  ) {
    throw new Error("背包网格面板不得超出 320x180 画布");
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}
