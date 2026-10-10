import {
  cancelPendingUpgradeChoice,
  choosePendingUpgrade,
  movePendingUpgradeSelection,
} from "../../core/run/runState.js";

export function handleUpgradeChoiceInput({
  input,
  run,
  updateRun,
  descendToNextFloor,
  afterUpgradeChoice,
  setAfterUpgradeChoice,
}) {
  const pendingChoice = run.build.pendingChoice;

  if (input.wasPressed("cancel")) {
    updateRun(cancelPendingUpgradeChoice(run));
    setAfterUpgradeChoice(null);
    return;
  }

  if (input.wasPressed("left") || input.wasPressed("up")) {
    updateRun(movePendingUpgradeSelection(run, -1));
    return;
  }

  if (input.wasPressed("right") || input.wasPressed("down")) {
    updateRun(movePendingUpgradeSelection(run, 1));
    return;
  }

  const directIndex = readDirectChoiceIndex(input);
  const selectedIndex = directIndex ?? pendingChoice.selectedIndex;
  if (directIndex === null && !input.wasPressed("confirm") && !input.wasPressed("interact")) {
    return;
  }

  const selected = pendingChoice.choices[selectedIndex];
  const chosenRun = choosePendingUpgrade(run, selected.id);
  updateRun(chosenRun);

  if (afterUpgradeChoice === "descend") {
    setAfterUpgradeChoice(null);
    descendToNextFloor(chosenRun);
    return;
  }

  setAfterUpgradeChoice(null);
}

export function getActiveBoss(combatState) {
  return combatState.enemies.find((enemy) =>
    enemy.isBoss && enemy.hp > 0 && enemy.state !== "dead",
  ) ?? null;
}

function readDirectChoiceIndex(input) {
  if (input.wasPressed("choice1")) {
    return 0;
  }

  if (input.wasPressed("choice2")) {
    return 1;
  }

  if (input.wasPressed("choice3")) {
    return 2;
  }

  return null;
}
