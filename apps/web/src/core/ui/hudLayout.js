import { hubMap } from "../hub/hubMap.js";
import { translate } from "../i18n/index.js";

export const CANVAS = Object.freeze({
  width: 320,
  height: 180,
});

export const CENTRAL_PLAY_AREA = Object.freeze({
  x: 24,
  y: 20,
  width: 172,
  height: 130,
});

export const HUD_SKILL_SLOT_SIZE = 16;
export const HUD_SKILL_SLOT_GAP = 2;
export const HUD_ICON_SIZE = 11;
export const HUD_ICON_GAP = 3;

export const HUD_ICON_ENTRIES = Object.freeze([
  Object.freeze({ pageId: "attributes", glyph: translate("hud.icon.attributes") }),
  Object.freeze({ pageId: "skills", glyph: translate("hud.icon.skills") }),
  Object.freeze({ pageId: "bag", glyph: translate("hud.icon.bag") }),
  Object.freeze({ pageId: "skins", glyph: translate("hud.icon.skins") }),
  Object.freeze({ pageId: "identity", glyph: translate("hud.icon.identity") }),
]);

const HEALTH_BAR_RECT = Object.freeze({
  x: 6,
  y: 6,
  width: 86,
  height: 7,
});

const DEPTH_LABEL_RECT = Object.freeze({
  x: 100,
  y: 6,
  width: 64,
  height: 10,
});

const INFO_BAR_RECT = Object.freeze({
  x: 4,
  yOffsetFromBottom: 18,
  width: 104,
  height: 14,
});

const ICON_BAR_ANCHOR = Object.freeze({
  rightInset: 4,
  yOffsetFromBottom: 48,
  height: 16,
});

const HUB_ICON_BAR_ANCHOR = Object.freeze({
  rightInset: 4,
  yOffsetFromBottom: 24,
  height: 16,
});

const HUB_WARNING_BANNER_RECT = Object.freeze({
  x: 4,
  y: 4,
  width: 116,
  height: 22,
});

const HUB_INTERACTION_IDS = Object.freeze([
  "portal",
  "merchant",
  "noticeboard",
]);

const HUB_INTERACTION_SPRITE_HEIGHT = 28;

const HINT_BANNER_RECT = Object.freeze({
  x: 198,
  y: 108,
  width: 118,
  height: 22,
});

const SKILL_BAR_ANCHOR = Object.freeze({
  rightInset: 4,
  yOffsetFromBottom: 26,
  height: 22,
});

const DEFAULT_SKILL_SLOT_COUNT = 4;
const DEFAULT_ICON_COUNT = HUD_ICON_ENTRIES.length;

export const HUB_INTERACTION_RECTS = createHubInteractionRects(hubMap);

/**
 * 计算地牢常驻 HUD 的外围布局。
 *
 * 这里只处理矩形契约，不读取 DOM、不读取时间、不参与绘制。
 * 小地图尺寸由调用方沿用既有算法计算后传入，避免 core 反向依赖 runtime。
 */
export function calculateHudLayout({
  canvasWidth = CANVAS.width,
  canvasHeight = CANVAS.height,
  skillSlotCount = DEFAULT_SKILL_SLOT_COUNT,
  iconCount = DEFAULT_ICON_COUNT,
  minimap,
} = {}) {
  const safeCanvasWidth = assertPositiveInteger(canvasWidth, "画布宽度必须是正整数");
  const safeCanvasHeight = assertPositiveInteger(canvasHeight, "画布高度必须是正整数");
  const safeSkillSlotCount = assertPositiveInteger(skillSlotCount, "技能槽数量必须是正整数");
  const safeIconCount = assertPositiveInteger(iconCount, "入口图标数量必须是正整数");
  const minimapRect = normalizeRectangle(minimap, "小地图矩形");

  const iconBar = createBottomRightRect({
    canvasWidth: safeCanvasWidth,
    canvasHeight: safeCanvasHeight,
    width: calculateStripWidth({
      count: safeIconCount,
      itemSize: HUD_ICON_SIZE,
      gap: HUD_ICON_GAP,
    }),
    height: ICON_BAR_ANCHOR.height,
    rightInset: ICON_BAR_ANCHOR.rightInset,
    yOffsetFromBottom: ICON_BAR_ANCHOR.yOffsetFromBottom,
  });

  const skillBar = createBottomRightRect({
    canvasWidth: safeCanvasWidth,
    canvasHeight: safeCanvasHeight,
    width: calculateStripWidth({
      count: safeSkillSlotCount,
      itemSize: HUD_SKILL_SLOT_SIZE,
      gap: HUD_SKILL_SLOT_GAP,
    }),
    height: SKILL_BAR_ANCHOR.height,
    rightInset: SKILL_BAR_ANCHOR.rightInset,
    yOffsetFromBottom: SKILL_BAR_ANCHOR.yOffsetFromBottom,
  });

  return {
    healthBar: cloneRectangle(HEALTH_BAR_RECT),
    depthLabel: cloneRectangle(DEPTH_LABEL_RECT),
    minimap: minimapRect,
    infoBar: createInfoBar(safeCanvasHeight),
    iconBar,
    hintBanner: cloneRectangle(HINT_BANNER_RECT),
    skillBar,
  };
}

/**
 * 计算大厅常驻 HUD 的外围布局。
 *
 * 大厅与地牢共用信息条和入口图标栏尺寸规则，只调整锚点避开大厅交互物。
 */
export function calculateHubHudLayout({
  canvasWidth = CANVAS.width,
  canvasHeight = CANVAS.height,
  iconCount = DEFAULT_ICON_COUNT,
} = {}) {
  const safeCanvasWidth = assertPositiveInteger(canvasWidth, "画布宽度必须是正整数");
  const safeCanvasHeight = assertPositiveInteger(canvasHeight, "画布高度必须是正整数");
  const safeIconCount = assertPositiveInteger(iconCount, "入口图标数量必须是正整数");

  return {
    infoBar: createInfoBar(safeCanvasHeight),
    iconBar: createBottomRightRect({
      canvasWidth: safeCanvasWidth,
      canvasHeight: safeCanvasHeight,
      width: calculateStripWidth({
        count: safeIconCount,
        itemSize: HUD_ICON_SIZE,
        gap: HUD_ICON_GAP,
      }),
      height: HUB_ICON_BAR_ANCHOR.height,
      rightInset: HUB_ICON_BAR_ANCHOR.rightInset,
      yOffsetFromBottom: HUB_ICON_BAR_ANCHOR.yOffsetFromBottom,
    }),
    warningBanner: cloneRectangle(HUB_WARNING_BANNER_RECT),
  };
}

function createInfoBar(canvasHeight) {
  return {
    x: INFO_BAR_RECT.x,
    y: canvasHeight - INFO_BAR_RECT.yOffsetFromBottom,
    width: INFO_BAR_RECT.width,
    height: INFO_BAR_RECT.height,
  };
}

function createBottomRightRect({
  canvasWidth,
  canvasHeight,
  width,
  height,
  rightInset,
  yOffsetFromBottom,
}) {
  return {
    x: canvasWidth - rightInset - width,
    y: canvasHeight - yOffsetFromBottom,
    width,
    height,
  };
}

function calculateStripWidth({ count, itemSize, gap }) {
  if (count === 1) {
    return itemSize;
  }

  return count * itemSize + (count - 1) * gap;
}

function normalizeRectangle(rect, label) {
  if (rect === null || typeof rect !== "object") {
    throw new TypeError(`${label}必须是矩形对象`);
  }

  return {
    x: assertInteger(rect.x, `${label} x 必须是整数`),
    y: assertInteger(rect.y, `${label} y 必须是整数`),
    width: assertPositiveInteger(rect.width, `${label} width 必须是正整数`),
    height: assertPositiveInteger(rect.height, `${label} height 必须是正整数`),
  };
}

function createHubInteractionRects(map) {
  return Object.freeze(Object.fromEntries(HUB_INTERACTION_IDS.map((id) => {
    const interaction = map.interactions.find((candidate) => candidate.id === id);

    if (!interaction) {
      throw new Error(`大厅缺少 ${id} 交互点`);
    }

    return [id, Object.freeze(createHubInteractionRect(interaction, map.tileSize))];
  })));
}

function createHubInteractionRect(interaction, tileSize) {
  return {
    x: interaction.tileX * tileSize,
    y: (interaction.tileY + 1) * tileSize - HUB_INTERACTION_SPRITE_HEIGHT,
    width: tileSize,
    height: HUB_INTERACTION_SPRITE_HEIGHT,
  };
}

function cloneRectangle(rect) {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

function assertPositiveInteger(value, message) {
  const integer = assertInteger(value, message);

  if (integer <= 0) {
    throw new RangeError(message);
  }

  return integer;
}

function assertInteger(value, message) {
  if (!Number.isInteger(value)) {
    throw new TypeError(message);
  }

  return value;
}
