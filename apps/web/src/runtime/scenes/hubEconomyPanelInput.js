import {
  adjustPanelValue,
  getShortcutRowIndex,
  initialPanelSelection,
  movePanelSelection,
} from "../../core/ui/panelSelection.js";

export function readHubPanelInput(input, panel, selectedIndex) {
  const actions = panel?.actions ?? [];

  if (input.wasPressed("up")) {
    return {
      type: "move",
      selectedIndex: movePanelSelection(actions, selectedIndex, -1),
    };
  }

  if (input.wasPressed("down")) {
    return {
      type: "move",
      selectedIndex: movePanelSelection(actions, selectedIndex, 1),
    };
  }

  if (input.wasPressed("left") || input.wasPressed("right")) {
    return {
      type: "adjust",
      selectedIndex,
      direction: input.wasPressed("left") ? -1 : 1,
    };
  }

  const shortcut = readShortcut(input);
  if (shortcut) {
    const actionIndex = getShortcutRowIndex(actions, shortcut);
    if (actionIndex !== null) {
      return {
        type: "execute",
        selectedIndex: actionIndex,
        action: actions[actionIndex],
      };
    }
  }

  if (input.wasPressed("confirm") || input.wasPressed("interact")) {
    return {
      type: "execute",
      selectedIndex,
      action: actions[selectedIndex],
    };
  }

  return { type: "none", selectedIndex };
}

export function adjustHubPanelValue(panel, selectedIndex, direction) {
  return adjustPanelValue(panel?.actions ?? [], selectedIndex, direction);
}

export function withInitialHubPanelSelection(panel) {
  return withHubPanelSelection(panel, 0);
}

export function withHubPanelSelection(panel, selectedIndex) {
  const actions = panel?.actions ?? [];
  const nextIndex = actions.length > 0
    ? initialPanelSelection(actions, selectedIndex)
    : -1;

  return {
    panel: panel ? { ...panel, selectedIndex: nextIndex } : panel,
    selectedIndex: nextIndex,
  };
}

function readShortcut(input) {
  for (const shortcut of ["choice1", "choice2", "choice3"]) {
    if (input.wasPressed(shortcut)) {
      return shortcut;
    }
  }

  return null;
}
