import {
  calculatePanelContentWidth,
  calculatePanelLayout,
} from "../../core/ui/panelLayout.js";
import { wrapPixelText } from "../../core/ui/textLayout.js";
import {
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
  setImageSmoothing,
} from "../renderer/pixelSurface.js";
import {
  drawCenteredPixelText,
  drawPixelPanel,
  drawPixelText,
  fitPixelText,
  getRarityBorderColor,
} from "../ui/pixelUi.js";
import { setPixelFont } from "../ui/pixelFont.js";
import { translate } from "../../core/i18n/index.js";

export function drawGamePanel(context, panel, tileset, { t = translate } = {}) {
  if (!panel) {
    return;
  }

  setPixelFont(context, 10);
  const panelWidth = panel.width ?? calculatePanelContentWidth({
    title: panel.title,
    lines: panel.lines,
    actions: panel.actions,
    measureText: (text) => context.measureText(text).width,
  });
  const wrappedLines = panel.linesPrewrapped === true
    ? normalizePrewrappedLines(panel.lines ?? [])
    : flattenPanelLines(
      panel.lines ?? [],
      panelWidth - 28,
      (char) => context.measureText(char).width,
    );
  const actions = panel.actions ?? [];
  const rows = [
    ...wrappedLines.map((line) => ({ kind: "info", ...line })),
    ...actions.map((action, actionIndex) => ({ kind: "action", action, actionIndex })),
  ];
  const requestedActionIndex = Number.isInteger(panel.selectedIndex) ? panel.selectedIndex : 0;
  const selectedActionIndex = requestedActionIndex >= 0 && actions.length > 0
    ? Math.min(actions.length - 1, requestedActionIndex)
    : -1;
  const selectedRowIndex = selectedActionIndex >= 0
    ? wrappedLines.length + selectedActionIndex
    : Math.max(0, Math.min(
      wrappedLines.length - 1,
      Number.isInteger(panel.selectedLineIndex) ? panel.selectedLineIndex : 0,
    ));
  const layout = calculatePanelLayout({
    canvasWidth: INTERNAL_WIDTH,
    canvasHeight: INTERNAL_HEIGHT,
    rowCount: Math.max(1, rows.length),
    selectedIndex: selectedRowIndex,
    width: panelWidth,
  });
  const accent = panel.rarity ? getRarityBorderColor(panel.rarity) : panel.accent ?? "#ffcf8a";

  context.save();
  setImageSmoothing(context, false);
  drawPixelPanel(context, { tileset, ...layout.bounds, accent, fill: panel.fill });
  const tabLayout = Array.isArray(panel.tabs) && panel.tabs.length > 0
    ? drawPageTabs(context, layout, panel.tabs, panel.tabsFocused === true, t)
    : null;
  if (!tabLayout) {
    drawCenteredPixelText(context, panel.title, INTERNAL_WIDTH / 2, layout.bounds.y + 8, {
      color: panel.accentText ?? accent,
    });
  }

  for (const rect of layout.rowRects) {
    const row = rows[rect.index];
    if (!row) {
      continue;
    }

    if (row.kind === "info") {
      drawPixelText(context, row.text, rect.x, rect.y + 2, {
        color: row.color ?? "#f7efd0",
      });
    } else {
      drawActionRow(context, row.action, {
        rect,
        selected: row.actionIndex === selectedActionIndex,
      });
    }
  }

  drawScrollHints(context, layout);
  drawFooter(context, {
    footer: layout.footer,
    selectedAction: selectedActionIndex >= 0 ? actions[selectedActionIndex] : null,
    extra: panel.footerExtra,
    text: panel.footerText,
    t,
  });
  context.restore();
  return {
    layout,
    tabLayout,
    lines: wrappedLines,
    selectedRowIndex,
  };
}

/**
 * 角色面板页签共用绘制器。
 *
 * 页签只绘制文字标签，避免汉字字形与标签语义重复；只有 selected 页签拥有
 * 填充矩形，未选中页签不画同尺寸底块，避免再次退化为只看字色的选中态。
 */
export function drawPageTabs(context, layout, tabs, focused = false, t = translate) {
  const tabLayout = calculatePageTabLayout(context, layout, tabs, t);

  drawPixelText(context, "←", tabLayout.leftArrow.x, tabLayout.leftArrow.y, {
    color: "#b8c7df",
  });

  for (const item of tabLayout.items) {
    if (item.selected) {
      context.fillStyle = focused ? "#f4d06f" : "#2b2334";
      context.fillRect(item.rect.x, item.rect.y, item.rect.width, item.rect.height);
    }

    const color = item.selected
      ? focused ? "#171014" : "#f4d06f"
      : item.active ? "#96cdff" : "#8f97a8";
    drawPixelText(context, item.label, item.textX, item.textY, { color });
  }

  drawPixelText(context, "→", tabLayout.rightArrow.x, tabLayout.rightArrow.y, {
    color: "#b8c7df",
  });
  return tabLayout;
}

export function calculatePageTabLayout(context, layout, tabs, t = translate) {
  const items = normalizeTabs(tabs, t);
  const itemGap = 6;
  const arrowGap = 2;
  const textY = Math.round(layout.bounds.y + 7);
  const arrowWidth = measurePixelText(context, "←");
  const measuredItems = items.map((item) => ({
    ...item,
    labelWidth: measurePixelText(context, item.label),
  }));
  const itemsWidth = measuredItems.reduce(
    (total, item) => total + item.labelWidth,
    0,
  );
  const totalWidth = arrowWidth * 2
    + arrowGap * 2
    + itemsWidth
    + itemGap * Math.max(0, measuredItems.length - 1);
  let cursorX = Math.round(layout.bounds.x + (layout.bounds.width - totalWidth) / 2);
  const leftArrow = { x: cursorX, y: textY };
  cursorX += arrowWidth + arrowGap;

  const positionedItems = measuredItems.map((item) => {
    const textWidth = item.labelWidth;
    const positioned = {
      ...item,
      textX: cursorX,
      textY,
      rect: {
        x: cursorX - 1,
        y: textY - 2,
        width: textWidth + 2,
        height: 13,
      },
    };
    cursorX += textWidth + itemGap;
    return positioned;
  });

  cursorX += arrowGap - itemGap;
  return {
    leftArrow,
    items: positionedItems,
    rightArrow: { x: cursorX, y: textY },
  };
}

function normalizePrewrappedLines(lines) {
  return lines
    .filter((line) => line && typeof line.text === "string" && line.text.length > 0)
    .map((line) => ({ ...line }));
}

function normalizeTabs(tabs, t) {
  const source = Array.isArray(tabs) && tabs.length > 0
    ? tabs
    : [{ label: t("role.page.bag"), active: true, selected: true }];

  return source.map((tab) => ({
    id: tab?.id ?? null,
    label: String(tab?.label ?? ""),
    active: tab?.active === true,
    selected: tab?.selected === true || (tab?.selected === undefined && tab?.active === true),
  }));
}

function measurePixelText(context, text) {
  setPixelFont(context, 10);
  return Math.ceil(context.measureText(String(text)).width);
}

function flattenPanelLines(lines, maxWidth, measureChar) {
  const result = [];
  for (const line of lines) {
    const wrapped = wrapPixelText(line.text, {
      maxWidth,
      cjkWidth: 10,
      latinWidth: 5,
      spaceWidth: 5,
      measureChar,
    });
    for (const text of wrapped) {
      result.push({ ...line, text });
    }
  }

  return result;
}

function drawActionRow(context, action, { rect, selected }) {
  const disabled = action.disabled === true;
  const text = formatActionText(action);
  const textX = rect.x + (selected ? 15 : 3);
  const fill = selected ? "#f4d06f" : disabled ? "#211a24" : "#211827";
  const color = selected ? "#171014" : disabled ? "#8f8793" : action.color ?? "#f7efd0";

  context.fillStyle = fill;
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  context.fillStyle = disabled ? "#4e4753" : action.accent ?? "#d4af64";
  context.fillRect(rect.x, rect.y + rect.height - 1, rect.width, 1);

  if (selected) {
    drawPixelText(context, "▶", rect.x + 3, rect.y + 2, { color: "#171014" });
  }

  drawPixelText(context, fitPixelText(context, text, rect.width - (selected ? 18 : 6)), textX, rect.y + 2, { color });
}

function drawFooter(context, { footer, selectedAction, extra, text, t }) {
  const hints = text ? [text] : [t("panel.footer.confirm"), t("panel.footer.close")];
  if (selectedAction?.kind === "value") {
    hints.push(t("panel.footer.adjust"));
  }
  if (extra) {
    hints.push(extra);
  }

  context.fillStyle = "#0b0a10";
  context.fillRect(footer.x, footer.y + 2, footer.width, footer.height - 4);
  drawCenteredPixelText(context, fitPixelText(context, hints.join("   "), footer.width - 4), footer.x + footer.width / 2, footer.y + 6, {
    color: "#b8c7df",
  });
}

function drawScrollHints(context, layout) {
  if (layout.hasPrevious) {
    drawCenteredPixelText(context, "▲", layout.bounds.x + layout.bounds.width - 13, layout.rowArea.y - 10, {
      color: "#b8c7df",
    });
  }
  if (layout.hasNext) {
    drawCenteredPixelText(context, "▼", layout.bounds.x + layout.bounds.width - 13, layout.footer.y - 10, {
      color: "#b8c7df",
    });
  }
}

function formatActionText(action) {
  const label = action.label ?? action.text ?? "";
  if (action.disabled && action.disabledReason && !label.includes(action.disabledReason)) {
    return `${label}    ${action.disabledReason}`;
  }

  return label;
}
