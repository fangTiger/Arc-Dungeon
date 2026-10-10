import {
  createRoomEventRng,
  getRoomEventOptionState,
  resolveRoomEvent,
  rollRoomEvent,
} from "../../core/run/roomEvents.js";
import { translate } from "../../core/i18n/index.js";

export function createDungeonRoomEventFlow({ t = translate } = {}) {
  let event = null;
  let selectedIndex = 0;

  function open({ run, player, roomId }) {
    event = rollRoomEvent({ seed: run.seed, depth: run.depth, roomId }, t);
    selectedIndex = 0;
    return event;
  }

  function close() {
    event = null;
    selectedIndex = 0;
  }

  function isOpen() {
    return Boolean(event);
  }

  function getPanel({ run, player }) {
    if (!event) {
      return null;
    }

    const actions = createActions({ run, player, event }, t);
    selectedIndex = normalizeSelectedIndex(actions.length, selectedIndex);
    return {
      title: event.title,
      lines: [
        { text: event.description },
        { text: eventHint(event, actions[selectedIndex], t), color: "#b8c7df" },
      ],
      actions,
      selectedIndex,
      accent: "#d4af64",
      footerExtra: t("panel.footer.select"),
    };
  }

  function update(input, { run, player, applyResult, showFeedback }) {
    if (!event) {
      return false;
    }

    if (input.wasPressed("cancel")) {
      close();
      return true;
    }

    if (input.wasPressed("up") || input.wasPressed("down")) {
      const direction = input.wasPressed("up") ? -1 : 1;
      selectedIndex = moveEventSelection(event.options.length, selectedIndex, direction);
      return true;
    }

    if (!input.wasPressed("confirm") && !input.wasPressed("interact")) {
      return true;
    }

    const panel = getPanel({ run, player });
    const action = panel.actions[selectedIndex];
    if (!action || action.disabled) {
      showFeedback?.(action?.disabledReason ?? t("hub.action.unavailable"));
      return true;
    }

    const result = resolveRoomEvent({
      run,
      player,
      event,
      optionId: action.id,
      rng: createRoomEventRng({ seed: run.seed, depth: run.depth, roomId: event.roomId }),
      t,
    });

    applyResult?.(result);
    showFeedback?.(result.outcome.message);
    close();
    return true;
  }

  return { open, close, isOpen, getPanel, update };
}

function createActions({ run, player, event }, t) {
  return event.options.map((option) => {
    const state = getRoomEventOptionState({ run, player, event, optionId: option.id }, t);
    return {
      id: option.id,
      label: optionLabel(option, state, t),
      disabled: state.disabled,
      disabledReason: state.disabledReason,
    };
  });
}

function optionLabel(option, state, t) {
  if (Number.isFinite(state.hpCost)) {
    return t("event.option.hpCost", { label: option.label, hpCost: state.hpCost });
  }

  if (Number.isFinite(state.stake)) {
    return t("event.option.stake", { label: option.label, stake: state.stake });
  }

  return option.label;
}

function eventHint(event, action, t) {
  if (action?.disabled) {
    return action.disabledReason;
  }

  if (event.type === "sacrifice") {
    return t(`event.hint.sacrifice.${action.id}`);
  }

  if (event.type === "gamble") {
    return t(`event.hint.gamble.${action.id}`);
  }

  return t(`event.hint.blessing.${action.id}`);
}

function normalizeSelectedIndex(length, selectedIndex) {
  if (length <= 0) {
    return -1;
  }
  return Math.max(0, Math.min(length - 1, Math.floor(Number(selectedIndex) || 0)));
}

function moveEventSelection(length, selectedIndex, direction) {
  if (length <= 0) {
    return -1;
  }
  // 事件置灰项仍需可落焦，确认时才能反馈不可选原因。
  const offset = direction < 0 ? -1 : 1;
  return (normalizeSelectedIndex(length, selectedIndex) + offset + length) % length;
}
