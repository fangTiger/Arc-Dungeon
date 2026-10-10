export const DEATH_SEQUENCE = Object.freeze({
  inputDelaySeconds: 1.1,
  autoReturnSeconds: 4.6,
  fadeStartSeconds: 0.35,
  fadeDurationSeconds: 1.35,
});

export function createDeathSequence({ returnToHub }) {
  let active = false;
  let timer = 0;
  let runSnapshot = null;
  let playerRef = null;

  function begin({ run, player }) {
    if (active) {
      return;
    }

    active = true;
    timer = 0;
    runSnapshot = run;
    playerRef = player;
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

  function update(input, dt) {
    if (!active) {
      return;
    }

    timer += dt;
    updatePlayerDeathVisual();

    const canSkip = timer >= DEATH_SEQUENCE.inputDelaySeconds;
    if (timer >= DEATH_SEQUENCE.autoReturnSeconds || canSkip && input?.wasAnyPressed?.()) {
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
      inputReady: timer >= DEATH_SEQUENCE.inputDelaySeconds,
      autoReturnSeconds: DEATH_SEQUENCE.autoReturnSeconds,
    };
  }

  function updatePlayerDeathVisual() {
    if (!playerRef) {
      return;
    }

    const fadePhase = Math.max(0, timer - DEATH_SEQUENCE.fadeStartSeconds) /
      DEATH_SEQUENCE.fadeDurationSeconds;
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
