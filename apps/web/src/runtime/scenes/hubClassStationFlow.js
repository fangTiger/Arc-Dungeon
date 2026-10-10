import { movePanelSelection } from "../../core/ui/panelSelection.js";
import { translate } from "../../core/i18n/index.js";
import { labelForClass } from "./hubIdentityFlow.js";

const CLASS_ACTIONS = Object.freeze([
  Object.freeze({ id: "knight", accent: "#d4af64" }),
  Object.freeze({ id: "wizzard", accent: "#96cdff" }),
]);

/**
 * 职业站点只管理面板开关，职业值始终由身份流程读写。
 */
export function createHubClassStationFlow({
  getSelectedClassId,
  setSelectedClassId,
  t = translate,
}) {
  let open = false;

  function update(input) {
    if (!open) {
      return false;
    }

    if (input.wasPressed("cancel")) {
      closePanel();
      return true;
    }

    const direction = readDirection(input);
    if (direction !== 0) {
      const selectedIndex = indexForClass(getSelectedClassId());
      const nextIndex = movePanelSelection(CLASS_ACTIONS, selectedIndex, direction);
      setSelectedClassId(CLASS_ACTIONS[nextIndex].id);
      return true;
    }

    if (input.wasPressed("confirm") || input.wasPressed("interact")) {
      closePanel();
      return true;
    }

    return true;
  }

  function getPanel() {
    if (!open) {
      return null;
    }

    const selectedClassId = getSelectedClassId();
    return {
      kind: "class-station",
      title: t("hub.class.title"),
      width: 228,
      accent: "#d4af64",
      lines: [
        { text: t("hub.class.current", { className: labelForClass(selectedClassId, t) }), color: "#fff0b3" },
        { text: t("hub.class.instructions") },
      ],
      actions: CLASS_ACTIONS.map((action) => ({
        ...action,
        label: action.id === selectedClassId
          ? t("hub.class.selected", { className: labelForClass(action.id, t) })
          : labelForClass(action.id, t),
      })),
      selectedIndex: indexForClass(selectedClassId),
      footerExtra: t("hub.class.footer"),
    };
  }

  function openPanel() {
    open = true;
  }

  function closePanel() {
    open = false;
  }

  return { update, getPanel, openPanel, closePanel };
}

function readDirection(input) {
  if (input.wasPressed("up") || input.wasPressed("left")) {
    return -1;
  }
  if (input.wasPressed("down") || input.wasPressed("right")) {
    return 1;
  }
  return 0;
}

function indexForClass(classId) {
  return classId === "wizzard" ? 1 : 0;
}
