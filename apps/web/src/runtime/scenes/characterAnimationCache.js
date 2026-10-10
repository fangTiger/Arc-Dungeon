import { createAnimation, getFrames } from "../../core/art/atlasIndex.js";

export function createCharacterAnimationCache({ frames, fps }) {
  const cache = new Map();

  function animationFor(prefix, action) {
    const key = `${prefix}:${action}`;
    if (!cache.has(key)) {
      cache.set(key, createAnimation({
        frames: getFrames(frames, `${prefix}_${action}_anim`, 4),
        fps,
      }));
    }

    return cache.get(key);
  }

  return { animationFor };
}
