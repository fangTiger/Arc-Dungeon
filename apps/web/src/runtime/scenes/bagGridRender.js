import { INVENTORY_GRID_COLUMNS } from "../../core/ui/inventoryGrid.js";
import { setPixelFont } from "../ui/pixelFont.js";
import {
  drawCenteredPixelText,
  drawPixelText,
  fitPixelText,
  getRarityBorderColor,
} from "../ui/pixelUi.js";
import {
  BAG_GRID_CELL_HEIGHT,
  BAG_GRID_CELL_WIDTH,
  BAG_GRID_COLUMN_GAP,
  BAG_GRID_ROW_GAP,
} from "./bagGridUi.js";
import { drawPageTabs } from "./gamePanelUi.js";
import { translate } from "../../core/i18n/index.js";

export { drawPageTabs } from "./gamePanelUi.js";

export function drawGrid(context, tileset, grid, selectedIndex, highlightIndex, layout) {
  const startIndex = layout.visibleStartRow * INVENTORY_GRID_COLUMNS;
  const endIndex = Math.min(grid.cells.length, layout.visibleEndRow * INVENTORY_GRID_COLUMNS);

  for (let index = startIndex; index < endIndex; index += 1) {
    const cell = grid.cells[index];
    const column = index % INVENTORY_GRID_COLUMNS;
    const row = Math.floor(index / INVENTORY_GRID_COLUMNS) - layout.visibleStartRow;
    const rect = cellRect(layout.grid, column, row);

    drawCellFrame(context, rect, cell, index === highlightIndex);
    if (!cell.empty) {
      drawCellIcon(context, tileset, cell, rect);
      drawCellCount(context, cell, rect);
    }
  }
}

export function drawCellFrame(context, rect, cell, selected) {
  context.fillStyle = cell.empty ? "#100d15" : "#211827";
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  context.fillStyle = selected ? getRarityBorderColor(cell.rarity) : "#42384d";
  context.fillRect(rect.x, rect.y, rect.width, 1);
  context.fillRect(rect.x, rect.y + rect.height - 1, rect.width, 1);
  context.fillRect(rect.x, rect.y, 1, rect.height);
  context.fillRect(rect.x + rect.width - 1, rect.y, 1, rect.height);
}

export function drawCellIcon(context, tileset, cell, rect) {
  const frame = getFrame(tileset, cell.frameName);

  if (!frame || !tileset?.image) {
    return;
  }

  const frameBox = getFrameBox(frame);
  const iconX = Math.round(rect.x + (rect.width - frameBox.width) / 2);
  const iconY = Math.round(rect.y + rect.height - frameBox.height);

  context.save();
  context.beginPath();
  context.rect(rect.x, rect.y, rect.width, rect.height);
  context.clip();
  context.drawImage(
    tileset.image,
    frameBox.x,
    frameBox.y,
    frameBox.width,
    frameBox.height,
    iconX,
    iconY,
    frameBox.width,
    frameBox.height,
  );
  context.restore();
}

/**
 * 数量画在格子右下角。
 *
 * 账户 Token 很容易到四位数甚至更多，直接铺开会占满 24px 格宽并盖住图标，
 * 因此超过三位数就压缩成 `999+`，并在文字底下垫一层暗底保证图标被压住时仍可读。
 */
export function drawCellCount(context, cell, rect) {
  const text = formatCellCount(cell.count);
  setPixelFont(context, 10);
  const width = Math.ceil(context.measureText(text).width);
  const x = rect.x + rect.width - width - 2;
  const y = rect.y + rect.height - 10;

  context.fillStyle = "rgba(11, 10, 16, 0.82)";
  context.fillRect(x - 1, y - 1, width + 2, 10);
  drawPixelText(context, text, x, y, { color: "#f7efd0" });
}

export function formatCellCount(count) {
  const normalized = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return normalized > 999 ? "999+" : String(normalized);
}

export function drawSelectedDetails(context, cell, layout, tabsFocused = false, t = translate) {
  const label = tabsFocused ? t("role.bag.tabsLabel") : cell?.label || t("role.bag.emptyCell");
  const description = tabsFocused
    ? t("role.bag.tabsDescription")
    : cell?.description || "";

  drawPixelText(context, fitPixelText(context, label, layout.detail.width), layout.detail.x, layout.detail.y, {
    color: cell?.rarity ? getRarityBorderColor(cell.rarity) : "#f4d06f",
  });
  drawPixelText(
    context,
    fitPixelText(context, description, layout.detail.width),
    layout.detail.x,
    layout.detail.y + 12,
    { color: "#b8c7df" },
  );
}

export function drawFooter(context, layout, tabsFocused, t = translate) {
  const hint = t(tabsFocused ? "role.bag.footerTabs" : "role.bag.footerGrid");
  context.fillStyle = "#0b0a10";
  context.fillRect(layout.footer.x, layout.footer.y + 2, layout.footer.width, layout.footer.height - 4);
  drawCenteredPixelText(
    context,
    fitPixelText(context, hint, layout.footer.width - 4),
    layout.footer.x + layout.footer.width / 2,
    layout.footer.y + 6,
    { color: "#b8c7df" },
  );
}

export function drawScrollHints(context, layout) {
  if (layout.hasPrevious) {
    drawCenteredPixelText(context, "▲", layout.bounds.x + layout.bounds.width - 13, layout.grid.y - 10, {
      color: "#b8c7df",
    });
  }
  if (layout.hasNext) {
    drawCenteredPixelText(context, "▼", layout.bounds.x + layout.bounds.width - 13, layout.detail.y - 10, {
      color: "#b8c7df",
    });
  }
}

export function cellRect(gridRect, column, row) {
  return {
    x: Math.round(gridRect.x + column * (BAG_GRID_CELL_WIDTH + BAG_GRID_COLUMN_GAP)),
    y: Math.round(gridRect.y + row * (BAG_GRID_CELL_HEIGHT + BAG_GRID_ROW_GAP)),
    width: BAG_GRID_CELL_WIDTH,
    height: BAG_GRID_CELL_HEIGHT,
  };
}

export function getFrame(tileset, frameName) {
  return tileset?.frames?.[frameName] ?? tileset?.tiles?.[frameName] ?? null;
}

export function getFrameBox(frame) {
  return {
    x: frame.sx ?? frame.x,
    y: frame.sy ?? frame.y,
    width: frame.sw ?? frame.width,
    height: frame.sh ?? frame.height,
  };
}
