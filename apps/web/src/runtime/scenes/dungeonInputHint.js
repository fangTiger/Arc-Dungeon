import { drawCenteredPixelText } from "../ui/pixelUi.js";
import { translate } from "../../core/i18n/index.js";

const HINT_DURATION_SECONDS = 7;
const FADE_SECONDS = 1.2;
const HINT_LINE_KEYS = Object.freeze([
  "hud.input.move",
  "hud.input.attack",
  "hud.input.roll",
  "hud.input.skills",
]);

export function createDungeonInputHint({ t = translate } = {}) {
  let remaining = HINT_DURATION_SECONDS;
  let hidden = false;

  function update({ run, roomMap, dt, paused = false }) {
    if (hidden) {
      return;
    }

    if (!isStartHintRoom(run, roomMap)) {
      hidden = true;
      return;
    }

    if (!paused) {
      remaining = Math.max(0, remaining - dt);
    }
  }

  function getSnapshot(run, roomMap) {
    if (hidden || remaining <= 0 || !isStartHintRoom(run, roomMap)) {
      return null;
    }

    return {
      alpha: Math.min(0.82, remaining / FADE_SECONDS),
      x: Math.round((roomMap.width * roomMap.tileSize) / 2 + 52),
      y: Math.round(roomMap.height * roomMap.tileSize - 82),
      lines: HINT_LINE_KEYS.map((key) => t(key)),
    };
  }

  return { update, getSnapshot };
}

export function drawDungeonInputHint(context, hint, camera) {
  if (!hint) {
    return;
  }

  const screen = camera.worldToScreen(hint.x, hint.y);
  const x = Math.round(screen.x);
  const y = Math.round(screen.y);

  context.save();
  context.globalAlpha = hint.alpha;
  hint.lines.forEach((line, index) => {
    const lineY = y + index * 10;
    drawCenteredPixelText(context, line, x + 1, lineY + 1, { color: "#0b0709" });
    drawCenteredPixelText(context, line, x, lineY, { color: "#f7efd0" });
  });
  context.restore();
}

function isStartHintRoom(run, roomMap) {
  return run?.depth === 1 && roomMap?.id === run.floorPlan?.startRoomId;
}
