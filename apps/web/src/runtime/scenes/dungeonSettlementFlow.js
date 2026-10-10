const INPUT_DELAY_SECONDS = 0.45;
const DEATH_FADE_START_SECONDS = 0.35;
const DEATH_FADE_DURATION_SECONDS = 1.35;

export function createDungeonSettlementFlow({ settleRun, returnToHub, t = translate }) {
  let active = false;
  let timer = 0;
  let status = "idle";
  let runSnapshot = null;
  let playerRef = null;
  let reason = "death";
  let settlement = null;
  let errorText = "";

  function begin({ run, player, reason: nextReason = "death" }) {
    if (active) {
      return;
    }

    active = true;
    timer = 0;
    status = "settling";
    runSnapshot = { ...run, settlementReason: nextReason };
    playerRef = player;
    reason = nextReason;
    settlement = null;
    errorText = "";

    if (reason === "death") {
      beginPlayerDeathVisual(player);
    }

    Promise.resolve(settleRun?.(runSnapshot))
      .then((result) => {
        status = result?.ok ? "ready" : "failed";
        settlement = result?.ok ? result : null;
        errorText = result?.ok ? "" : t("settlement.status.failed");
      })
      .catch(() => {
        status = "failed";
        errorText = t("settlement.status.failed");
      });
  }

  function update(input, dt) {
    if (!active) {
      return;
    }

    timer += dt;

    if (reason === "death") {
      updatePlayerDeathVisual();
    }

    if (isInputReady() && (
      input?.wasPressed?.("confirm")
      || input?.wasPressed?.("interact")
      || input?.wasPressed?.("cancel")
    )) {
      returnToHub();
    }
  }

  function getSnapshot() {
    if (!active) {
      return null;
    }

    return {
      run: runSnapshot,
      timer,
      status,
      reason,
      inputReady: isInputReady(),
      settlement,
      errorText,
    };
  }

  function isInputReady() {
    return timer >= INPUT_DELAY_SECONDS && (status === "ready" || status === "failed");
  }

  function beginPlayerDeathVisual(player) {
    Object.assign(player, {
      hp: 0,
      state: "dying",
      moving: false,
      knockbackX: 0,
      knockbackY: 0,
      deathElapsed: 0,
      deathAlpha: 1,
    });
  }

  function updatePlayerDeathVisual() {
    if (!playerRef) {
      return;
    }

    const fadePhase = Math.max(0, timer - DEATH_FADE_START_SECONDS) / DEATH_FADE_DURATION_SECONDS;
    playerRef.deathElapsed = timer;
    playerRef.deathAlpha = Math.max(0, 1 - fadePhase);
    playerRef.moving = false;
  }

  return {
    begin,
    update,
    getSnapshot,
    isActive: () => active,
  };
}
import { translate } from "../../core/i18n/index.js";
