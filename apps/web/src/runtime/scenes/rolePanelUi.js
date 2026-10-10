import { moveInventorySelection } from "../../core/ui/inventoryGrid.js";
import { createBagGrid, drawBagGridPanel, normalizeSelectedIndex } from "./bagGridUi.js";
import { drawGamePanel } from "./gamePanelUi.js";
import { translate } from "../../core/i18n/index.js";
import { createAttributeLines, createIdentityLines, createSkillLines, createSkinActions, createSkinLines } from "./rolePanelPages.js";
const PAGE_LABELS = [
  { id: "attributes", labelKey: "role.page.attributes" },
  { id: "skills", labelKey: "role.page.skills" },
  { id: "bag", labelKey: "role.page.bag" },
  { id: "skins", labelKey: "role.page.skins" },
  { id: "identity", labelKey: "role.page.identity" },
];
export const PAGES = Object.freeze(PAGE_LABELS.map((page) => Object.freeze({
  ...page,
  label: translate(page.labelKey),
})));
export function createRolePanelState() {
  return {
    open: false,
    pageIndex: 0,
    selectedIndex: 0,
    inventorySelectedIndex: 0,
    // 背包页焦点是否停在页签条上。背包页是网格而不是行列表，
    // 如果没有这条通路，玩家进了背包就再也切不回其它页。
    bagFocusOnTabs: false,
    pendingSkinId: null,
    message: "",
  };
}
export function updateRolePanel(state, input, options = {}) {
  if (!state.open) {
    return state;
  }
  if (input.wasPressed("cancel") || input.wasPressed("tabPanel")) {
    state.open = false;
    return state;
  }
  const page = PAGES[clampPage(state.pageIndex)];

  if (page.id === "bag") {
    updateBagSelection(state, input, options);
    return state;
  }

  // ←→ 在所有页面上都切页，页签行为保持一致
  if (input.wasPressed("left")) {
    switchPage(state, -1);
    return state;
  }

  if (input.wasPressed("right")) {
    switchPage(state, 1);
    return state;
  }

  const t = options.t ?? translate;
  const actions = createPanelActions(page.id, options, state, t);
  state.selectedIndex = clampAction(state.selectedIndex, actions.length);

  if (input.wasPressed("up")) {
    state.selectedIndex = wrapAction(state.selectedIndex - 1, actions.length);
    return state;
  }

  if (input.wasPressed("down")) {
    state.selectedIndex = wrapAction(state.selectedIndex + 1, actions.length);
    return state;
  }

  if (input.wasPressed("confirm") || input.wasPressed("interact")) {
    executePanelAction(state, actions[state.selectedIndex], options, t);
    return state;
  }

  return state;
}

export function openRolePanel(state) {
  state.open = true;
  state.pageIndex = clampPage(state.pageIndex);
  state.selectedIndex = state.pageIndex;
  // 打开时若停在背包页，焦点先落在页签条上，让"还能切到别的页"这件事第一眼可见
  state.bagFocusOnTabs = PAGES[state.pageIndex].id === "bag";
  return state;
}

export function closeRolePanel(state) {
  state.open = false;
  return state;
}

export function drawRolePanel(context, options, state, tileset = null, renderOptions = {}) {
  if (!state.open) {
    return;
  }

  const t = renderOptions.t ?? options.t ?? translate;
  if (PAGES[clampPage(state.pageIndex)]?.id === "bag") {
    return drawBagGridPanel(context, options, state, tileset, createPageTabs(state, t), { t });
  }

  return drawGamePanel(context, createRolePanelViewModel(options, state, t), tileset, { t });
}

/**
 * 背包页的焦点模型：页签条是网格上方的一个虚拟行。
 *
 * 网格第一行按 ↑ 进入页签条，页签条按 ←→ 直接切页、按 ↓ 回到网格。
 * 没有这条通路时背包页是死胡同——进得去出不来，且 pageIndex 跨开关持久化，
 * 再次打开仍然落在背包页，其它页永远不可达。
 */
function updateBagSelection(state, input, options) {
  const grid = createBagGrid(options, options.t ?? translate);
  state.inventorySelectedIndex = normalizeSelectedIndex(grid, state.inventorySelectedIndex);

  if (state.bagFocusOnTabs) {
    updateBagTabFocus(state, input);
    return;
  }

  if (input.wasPressed("up") && isOnFirstGridRow(grid, state.inventorySelectedIndex)) {
    state.bagFocusOnTabs = true;
    return;
  }

  for (const direction of ["up", "down", "left", "right"]) {
    if (input.wasPressed(direction)) {
      state.inventorySelectedIndex = moveInventorySelection(grid, state.inventorySelectedIndex, direction);
      return;
    }
  }
}

function updateBagTabFocus(state, input) {
  if (input.wasPressed("down") || input.wasPressed("confirm") || input.wasPressed("interact")) {
    state.bagFocusOnTabs = false;
    return;
  }

  if (input.wasPressed("left")) {
    switchPage(state, -1);
    return;
  }

  if (input.wasPressed("right")) {
    switchPage(state, 1);
  }
}

function switchPage(state, step) {
  state.pageIndex = wrapAction(clampPage(state.pageIndex) + step, PAGES.length);
  state.selectedIndex = state.pageIndex;
  state.bagFocusOnTabs = PAGES[state.pageIndex].id === "bag";
  state.message = "";
}

function isOnFirstGridRow(grid, index) {
  const columns = Number.isInteger(grid?.columns) && grid.columns > 0 ? grid.columns : 1;
  return Math.floor(Math.max(0, index) / columns) === 0;
}

export function createPageTabs(state, t = translate) {
  const activeIndex = clampPage(state?.pageIndex);
  const selectedIndex = isPageActionSelected(state)
    ? state.selectedIndex
    : activeIndex;

  return PAGES.map((page, index) => ({
    id: page.id,
    label: t(page.labelKey),
    active: index === activeIndex,
    selected: index === selectedIndex,
  }));
}

function createRolePanelViewModel(options, state, t) {
  const pageIndex = clampPage(state.pageIndex);
  const page = PAGES[pageIndex];
  const allActions = createPanelActions(page.id, options, state, t);
  const actions = allActions.filter((action) => action.kind !== "page");
  const selectedAction = allActions[clampAction(state.selectedIndex, allActions.length)];
  const selectedIndex = selectedAction?.kind === "skin"
    ? actions.indexOf(selectedAction)
    : -1;

  return {
    kind: "role",
    title: t("role.title"),
    width: 292,
    accent: "#96cdff",
    tabs: createPageTabs(state, t),
    tabsFocused: isPageActionSelected(state),
    lines: createPageLines(page.id, options, state, t),
    actions,
    selectedIndex,
    footerExtra: t("role.footer.pageSwitch"),
  };
}

function createPanelActions(pageId, options, state, t = translate) {
  const pageActions = PAGES.map((candidate, index) => ({
    id: `page-${candidate.id}`,
    kind: "page",
    pageIndex: index,
    label: candidate.id === pageId
      ? t("role.page.selected", { page: t(candidate.labelKey) })
      : t(candidate.labelKey),
    accent: candidate.id === pageId ? "#f4d06f" : "#96cdff",
  }));

  return pageId === "skins"
    ? [...pageActions, ...createSkinActions(options, state, t)]
    : pageActions;
}

function createPageLines(pageId, options, state, t) {
  if (pageId === "skills") {
    return createSkillLines(options, t);
  }

  if (pageId === "skins") {
    return createSkinLines(options, state, t);
  }

  if (pageId === "identity") {
    return createIdentityLines(options, t);
  }

  return createAttributeLines(options, t);
}

function executePanelAction(state, action, options, t) {
  if (!action || action.disabled) {
    return;
  }

  if (Number.isInteger(action.pageIndex)) {
    state.pageIndex = clampPage(action.pageIndex);
    state.selectedIndex = state.pageIndex;
    // 切进背包页时焦点落在页签条上，保证有明确的退路
    state.bagFocusOnTabs = PAGES[state.pageIndex].id === "bag";
    state.message = "";
    return;
  }

  if (action.kind === "skin") {
    equipSkinAction(state, action, options, t);
  }
}

function equipSkinAction(state, action, { economySnapshot, setEquippedSkin }, t = translate) {
  if (state.pendingSkinId !== null || typeof setEquippedSkin !== "function") {
    state.message = t("role.skin.failed");
    return;
  }

  const equippedSkinId = economySnapshot?.profile?.equippedSkinId ?? null;
  const nextSkinId = action.skinId === null || equippedSkinId === action.skinId
    ? null
    : action.skinId;
  state.pendingSkinId = action.skinId ?? action.id;
  state.message = t(nextSkinId ? "role.skin.equipPending" : "role.skin.unequipPending");

  Promise.resolve(setEquippedSkin(nextSkinId))
    .then((result) => {
      state.pendingSkinId = null;
      state.message = result?.ok
        ? t(nextSkinId ? "role.skin.equipSuccess" : "role.skin.unequipSuccess")
        : t("role.skin.failed");
    })
    .catch(() => {
      state.pendingSkinId = null;
      state.message = t("role.skin.failed");
    });
}

function wrapAction(index, length) {
  return length > 0 ? (index + length) % length : 0;
}

function clampAction(index, length) {
  return length > 0 ? Math.max(0, Math.min(length - 1, Math.floor(Number(index) || 0))) : 0;
}

function clampPage(pageIndex) {
  return Math.max(0, Math.min(PAGES.length - 1, Math.floor(Number(pageIndex) || 0)));
}

function isPageActionSelected(state) {
  const selectedIndex = state?.selectedIndex;
  const activePage = PAGES[clampPage(state?.pageIndex)];
  const focusInBagGrid = activePage?.id === "bag" && state?.bagFocusOnTabs === false;
  return Number.isInteger(selectedIndex)
    && selectedIndex >= 0
    && selectedIndex < PAGES.length
    && !focusInBagGrid;
}
