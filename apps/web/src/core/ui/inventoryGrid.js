import { SKIN_APPEARANCE_BY_ID } from "../economy/skinAppearance.js";
import { localizeSkin } from "../economy/skins.js";
import { translate } from "../i18n/index.js";

export const INVENTORY_GRID_COLUMNS = 5;
export const INVENTORY_GRID_VISIBLE_ROWS = 3;

/**
 * 汇总背包网格数据。
 *
 * `balance` 与 `profile` 是经济快照里的两个兄弟字段（`snapshot.balance` /
 * `snapshot.profile`），账户 Token 只在 `balance` 上，不要去 `profile` 里找。
 */
export function buildInventoryGrid({
  profile = {},
  balance = {},
  runBag = {},
  runPickups = [],
  t = translate,
} = {}) {
  const cells = [
    createCell({
      id: "token-balance",
      kind: "token-balance",
      frameName: "coin_anim_f0",
      label: t("inventory.account.label"),
      description: t("inventory.account.description"),
      count: normalizeCount(balance.tokens),
      rarity: null,
    }),
    createCell({
      id: "token-run",
      kind: "token-run",
      frameName: "coin_anim_f0",
      label: t("inventory.run.label"),
      description: t("inventory.run.description"),
      count: normalizeCount(runBag.tokens),
      rarity: null,
    }),
    createCell({
      id: "ticket",
      kind: "ticket",
      frameName: "button_blue_up",
      label: t("inventory.ticket.label"),
      description: t("inventory.ticket.description"),
      count: normalizeCount(profile.tickets),
      rarity: null,
    }),
    createCell({
      id: "skin-box",
      kind: "skin-box",
      frameName: "chest_full_open_anim_f0",
      label: t("inventory.box.label"),
      description: t("inventory.box.description"),
      count: normalizeCount(profile.skinBoxes),
      rarity: null,
    }),
    ...skinCells(profile.ownedSkins, t),
    createCell({
      id: "consumable-healing-potion",
      kind: "consumable",
      frameName: "flask_red",
      label: t("inventory.healing.label"),
      description: t("inventory.healing.description"),
      count: countHealingPickups(runPickups),
      rarity: null,
    }),
  ];
  const paddedCells = padCellsToFullRows(cells);

  return {
    columns: INVENTORY_GRID_COLUMNS,
    rowCount: paddedCells.length / INVENTORY_GRID_COLUMNS,
    cells: paddedCells,
  };
}

export function moveInventorySelection(grid, index, direction) {
  const cells = Array.isArray(grid?.cells) ? grid.cells : [];
  const columns = Number.isInteger(grid?.columns) && grid.columns > 0
    ? grid.columns
    : INVENTORY_GRID_COLUMNS;

  if (!isSelectableIndex(cells, index)) {
    return index;
  }

  if (direction === "left" || direction === "right") {
    return moveHorizontal(cells, columns, index, direction);
  }

  if (direction === "up" || direction === "down") {
    return moveVertical(cells, columns, index, direction);
  }

  return index;
}

function createCell({
  id,
  kind,
  frameName,
  label,
  description,
  count,
  rarity,
}) {
  return {
    id,
    kind,
    frameName,
    label,
    description,
    count,
    rarity,
    empty: false,
  };
}

function skinCells(ownedSkins, t) {
  if (!Array.isArray(ownedSkins)) {
    return [];
  }

  return ownedSkins
    .map((skin) => createSkinCell(skin, t))
    .filter(Boolean);
}

function createSkinCell(skin, t) {
  const appearance = SKIN_APPEARANCE_BY_ID[skin?.id];

  if (!appearance) {
    return null;
  }

  const localizedSkin = localizeSkin(skin, t);
  return createCell({
    id: `skin-${skin.id}`,
    kind: "skin",
    frameName: `${appearance.spriteVariant}_idle_anim_f0`,
    label: textOrFallback(localizedSkin.name, skin.id),
    description: t("inventory.skin.description"),
    count: 1,
    rarity: textOrFallback(skin.rarity, "common"),
  });
}

function padCellsToFullRows(cells) {
  const padded = [...cells];

  while (padded.length % INVENTORY_GRID_COLUMNS !== 0) {
    padded.push(createEmptyCell(padded.length));
  }

  return padded;
}

function createEmptyCell(index) {
  return {
    id: `empty-${index}`,
    kind: "empty",
    frameName: null,
    label: "",
    description: "",
    count: 0,
    rarity: null,
    empty: true,
  };
}

function moveHorizontal(cells, columns, index, direction) {
  const rowStart = Math.floor(index / columns) * columns;
  const rowEnd = Math.min(rowStart + columns - 1, cells.length - 1);
  const step = direction === "right" ? 1 : -1;

  for (let nextIndex = index + step; nextIndex >= rowStart && nextIndex <= rowEnd; nextIndex += step) {
    if (isSelectableIndex(cells, nextIndex)) {
      return nextIndex;
    }
  }

  return index;
}

function moveVertical(cells, columns, index, direction) {
  const step = direction === "down" ? columns : -columns;

  for (let nextIndex = index + step; nextIndex >= 0 && nextIndex < cells.length; nextIndex += step) {
    if (isSelectableIndex(cells, nextIndex)) {
      return nextIndex;
    }
  }

  return index;
}

function isSelectableIndex(cells, index) {
  return Number.isInteger(index) && index >= 0 && index < cells.length && !cells[index]?.empty;
}

function countHealingPickups(runPickups) {
  if (!Array.isArray(runPickups)) {
    return 0;
  }

  return runPickups.filter((pickup) => pickup?.type === "healing" || pickup?.type === "largeHealing").length;
}

function textOrFallback(value, fallback) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizeCount(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}
