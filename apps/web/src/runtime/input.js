const DIRECTION_KEYS = new Map([
  ["KeyW", "up"],
  ["ArrowUp", "up"],
  ["KeyS", "down"],
  ["ArrowDown", "down"],
  ["KeyA", "left"],
  ["ArrowLeft", "left"],
  ["KeyD", "right"],
  ["ArrowRight", "right"],
]);

export const ACTION_BINDINGS = Object.freeze({
  interact: Object.freeze(["KeyE"]),
  attack: Object.freeze(["Space", "KeyJ"]),
  dodge: Object.freeze(["KeyK", "ShiftLeft", "ShiftRight"]),
  skill1: Object.freeze(["KeyU"]),
  skill2: Object.freeze(["KeyI"]),
  skill3: Object.freeze(["KeyO"]),
  skill4: Object.freeze(["KeyP"]),
  cancel: Object.freeze(["Escape"]),
  confirm: Object.freeze(["Enter", "NumpadEnter"]),
  language: Object.freeze(["KeyL"]),
  choice1: Object.freeze(["Digit1", "Numpad1"]),
  choice2: Object.freeze(["Digit2", "Numpad2"]),
  choice3: Object.freeze(["Digit3", "Numpad3"]),
  tabPanel: Object.freeze(["Tab"]),
});

const ACTION_KEYS = new Map(
  Object.entries(ACTION_BINDINGS).flatMap(([action, codes]) =>
    codes.map((code) => [code, action]),
  ),
);

const ACTION_BY_ALIAS = new Map([
  ["e", "interact"],
  ["E", "interact"],
  [" ", "attack"],
  ["j", "attack"],
  ["J", "attack"],
  ["k", "dodge"],
  ["K", "dodge"],
  ["u", "skill1"],
  ["U", "skill1"],
  ["i", "skill2"],
  ["I", "skill2"],
  ["o", "skill3"],
  ["O", "skill3"],
  ["p", "skill4"],
  ["P", "skill4"],
]);

export function createInput(target) {
  const ownerWindow = target?.ownerDocument?.defaultView ?? window;
  const downKeys = new Set();
  const pressedActions = new Set();
  const textInput = [];
  let anyPressed = false;

  ownerWindow.addEventListener("keydown", handleKeyDown);
  ownerWindow.addEventListener("keyup", handleKeyUp);

  function getDirection() {
    let x = 0;
    let y = 0;

    if (isDirectionDown("left")) {
      x -= 1;
    }

    if (isDirectionDown("right")) {
      x += 1;
    }

    if (isDirectionDown("up")) {
      y -= 1;
    }

    if (isDirectionDown("down")) {
      y += 1;
    }

    if (x !== 0 && y !== 0) {
      const diagonal = Math.SQRT1_2;
      return { x: x * diagonal, y: y * diagonal };
    }

    return { x, y };
  }

  function wasPressed(key) {
    return pressedActions.has(normalizeAction(key));
  }

  function wasAnyPressed() {
    return anyPressed;
  }

  function consumeTextInput() {
    const consumed = [...textInput];
    textInput.length = 0;
    return consumed;
  }

  function commitFrame() {
    pressedActions.clear();
    textInput.length = 0;
    anyPressed = false;
  }

  function destroy() {
    ownerWindow.removeEventListener("keydown", handleKeyDown);
    ownerWindow.removeEventListener("keyup", handleKeyUp);
  }

  function handleKeyDown(event) {
    const textToken = readTextToken(event);

    if (isGameKey(event.code) || textToken) {
      event.preventDefault();
    }

    const action = ACTION_KEYS.get(event.code);
    if (action && (!downKeys.has(event.code) || event.repeat !== true)) {
      pressedActions.add(action);
    }

    const direction = DIRECTION_KEYS.get(event.code);
    if (direction && (!downKeys.has(event.code) || event.repeat !== true)) {
      pressedActions.add(direction);
    }

    if (!downKeys.has(event.code) || event.repeat !== true) {
      anyPressed = true;
      if (textToken) {
        textInput.push(textToken);
      }
    }

    downKeys.add(event.code);
  }

  function handleKeyUp(event) {
    if (isGameKey(event.code)) {
      event.preventDefault();
    }

    downKeys.delete(event.code);
  }

  function isDirectionDown(direction) {
    for (const [code, mappedDirection] of DIRECTION_KEYS) {
      if (mappedDirection === direction && downKeys.has(code)) {
        return true;
      }
    }

    return false;
  }

  return {
    getDirection,
    wasPressed,
    wasAnyPressed,
    consumeTextInput,
    commitFrame,
    destroy,
  };
}

function normalizeAction(key) {
  return ACTION_KEYS.get(key) ?? ACTION_BY_ALIAS.get(key) ?? key;
}

function isGameKey(code) {
  return DIRECTION_KEYS.has(code) || ACTION_KEYS.has(code);
}

function readTextToken(event) {
  if (event.code === "Backspace") {
    return "Backspace";
  }

  const digitMatch = /^Digit(\d)$/.exec(event.code) ?? /^Numpad(\d)$/.exec(event.code);
  if (digitMatch) {
    return digitMatch[1];
  }

  return /^[0-9]$/.test(event.key ?? "") ? event.key : null;
}

export function getKeysForAction(action) {
  return [...(ACTION_BINDINGS[action] ?? [])];
}
