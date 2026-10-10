import {
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
  TILE_SIZE,
} from "../renderer/pixelSurface.js";
import { createLightingLayer } from "../renderer/lighting.js";
import { drawVignette } from "../renderer/postfx.js";

export const DUNGEON_LIGHTING = Object.freeze({
  ambientColor: "#332838",
  room: Object.freeze({
    x: INTERNAL_WIDTH / 2,
    y: 6 * TILE_SIZE,
    radius: 188,
    color: "#c28f62",
    intensity: 0.42,
  }),
  player: Object.freeze({
    radius: 52,
    color: "#ffd08a",
    intensity: 0.98,
    radiusPulse: 3,
    intensityPulse: 0.03,
  }),
  vignetteIntensity: 0.38,
});

export function createDungeonAtmosphere({ width = INTERNAL_WIDTH, height = INTERNAL_HEIGHT, camera } = {}) {
  let lightingLayer = null;
  let lightingUnavailable = false;

  function update() {}

  function drawParticles() {}

  function applyLighting(context, player, elapsedMs, dynamicLights = []) {
    if (typeof context.createRadialGradient !== "function") {
      return;
    }

    const lighting = getLightingLayer();

    if (!lighting) {
      return;
    }

    const seconds = elapsedMs / 1000;
    const playerPulse = softFlicker(seconds, 1.1, 2.3, 3.7);

    lighting.begin(DUNGEON_LIGHTING.ambientColor);
    lighting.addLight(DUNGEON_LIGHTING.room);
    lighting.addLight({
      x: player.x,
      y: player.y - 7,
      radius: DUNGEON_LIGHTING.player.radius +
        playerPulse * DUNGEON_LIGHTING.player.radiusPulse,
      color: DUNGEON_LIGHTING.player.color,
      intensity: DUNGEON_LIGHTING.player.intensity +
        playerPulse * DUNGEON_LIGHTING.player.intensityPulse,
    });

    for (const light of dynamicLights) {
      lighting.addLight(light);
    }

    lighting.composite(context);
  }

  function applyVignette(context) {
    if (typeof context.createRadialGradient !== "function") {
      return;
    }

    drawVignette(context, {
      width,
      height,
      intensity: DUNGEON_LIGHTING.vignetteIntensity,
    });
  }

  function getLightingLayer() {
    if (lightingLayer || lightingUnavailable) {
      return lightingLayer;
    }

    try {
      lightingLayer = createLightingLayer({ width, height, camera });
    } catch {
      lightingUnavailable = true;
    }

    return lightingLayer;
  }

  return {
    update,
    drawParticles,
    applyLighting,
    applyVignette,
  };
}

function softFlicker(seconds, firstFrequency, secondFrequency, thirdFrequency) {
  const first = Math.sin(seconds * firstFrequency);
  const second = Math.sin(seconds * secondFrequency + 1.4) * 0.5;
  const third = Math.sin(seconds * thirdFrequency + 0.2) * 0.24;

  return (first + second + third) / 1.74;
}
