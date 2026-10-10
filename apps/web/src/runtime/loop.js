const DEFAULT_STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 250;

export function createLoop({ update, render, stepMs = DEFAULT_STEP_MS }) {
  if (typeof update !== "function" || typeof render !== "function") {
    throw new Error("固定步长循环需要 update 与 render 函数");
  }

  let running = false;
  let lastTime = 0;
  let accumulator = 0;
  let frameId = 0;

  function start() {
    if (running) {
      return;
    }

    running = true;
    lastTime = 0;
    accumulator = 0;
    frameId = requestAnimationFrame(frame);
  }

  function stop() {
    if (!running) {
      return;
    }

    running = false;
    cancelAnimationFrame(frameId);
  }

  function frame(now) {
    if (!running) {
      return;
    }

    if (lastTime === 0) {
      lastTime = now;
    }

    const elapsed = Math.min(now - lastTime, MAX_FRAME_MS);
    lastTime = now;
    accumulator += elapsed;

    while (accumulator >= stepMs) {
      update(stepMs / 1000);
      accumulator -= stepMs;
    }

    render(accumulator / stepMs);
    frameId = requestAnimationFrame(frame);
  }

  return { start, stop };
}
