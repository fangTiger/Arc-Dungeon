import {
  createParticleState,
  updateParticles,
} from "../../core/particles.js";
import {
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
  TILE_SIZE,
} from "../renderer/pixelSurface.js";
import { createLightingLayer } from "../renderer/lighting.js";
import { createParticleRenderer } from "../renderer/particles.js";
import { drawVignette } from "../renderer/postfx.js";

export const HUB_LIGHTING = Object.freeze({
  ambientColor: "#957c61",
  player: Object.freeze({
    radius: 68,
    color: "#ffd6a1",
    intensity: 0.82,
    radiusPulse: 4,
    intensityPulse: 0.05,
  }),
  fountain: Object.freeze({
    x: 2 * TILE_SIZE + TILE_SIZE / 2,
    y: 2 * TILE_SIZE + 8,
    radius: 50,
    color: "#62d8ff",
    intensity: 0.45,
    radiusPulse: 3,
    intensityPulse: 0.03,
  }),
  portal: Object.freeze({
    x: 10 * TILE_SIZE,
    y: 22,
    radius: 54,
    color: "#ffc078",
    intensity: 0.42,
  }),
  vignetteIntensity: 0.22,
});

const PARTICLE_OPTIONS = Object.freeze({
  bounds: Object.freeze({ width: INTERNAL_WIDTH, height: INTERNAL_HEIGHT }),
  fountain: Object.freeze({ x: HUB_LIGHTING.fountain.x, y: HUB_LIGHTING.fountain.y + 1 }),
  maxDust: 22,
  maxSplash: 12,
  dustRate: 2.4,
  splashRate: 4.2,
});

export function createHubAtmosphere({ width = INTERNAL_WIDTH, height = INTERNAL_HEIGHT, camera } = {}) {
  const particleRenderer = createParticleRenderer();
  let particleState = createParticleState({ seed: "rialo:guild-hub:s4-atmosphere" });
  let lightingLayer = null;
  let lightingUnavailable = false;

  function update(dt) {
    particleState = updateParticles(particleState, {
      dt,
      ...PARTICLE_OPTIONS,
    });
  }

  function drawParticles(context, camera) {
    particleRenderer.draw(context, particleState, camera);
  }

  function applyLighting(context, player, elapsedMs) {
    if (typeof context.createRadialGradient !== "function") {
      return;
    }

    const lighting = getLightingLayer();

    if (!lighting) {
      return;
    }

    const seconds = elapsedMs / 1000;
    const playerPulse = softFlicker(seconds, 0.9, 1.7, 2.6);
    const fountainPulse = softFlicker(seconds, 1.3, 2.1, 3.4);

    lighting.begin(HUB_LIGHTING.ambientColor);
    lighting.addLight({
      x: player.x,
      y: player.y - 7,
      radius: HUB_LIGHTING.player.radius + playerPulse * HUB_LIGHTING.player.radiusPulse,
      color: HUB_LIGHTING.player.color,
      intensity: HUB_LIGHTING.player.intensity + playerPulse * HUB_LIGHTING.player.intensityPulse,
    });
    lighting.addLight({
      x: HUB_LIGHTING.fountain.x,
      y: HUB_LIGHTING.fountain.y,
      radius: HUB_LIGHTING.fountain.radius + fountainPulse * HUB_LIGHTING.fountain.radiusPulse,
      color: HUB_LIGHTING.fountain.color,
      intensity: HUB_LIGHTING.fountain.intensity +
        fountainPulse * HUB_LIGHTING.fountain.intensityPulse,
    });
    lighting.addLight(HUB_LIGHTING.portal);
    lighting.composite(context);
  }

  function applyVignette(context) {
    if (typeof context.createRadialGradient !== "function") {
      return;
    }

    drawVignette(context, {
      width,
      height,
      intensity: HUB_LIGHTING.vignetteIntensity,
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
  const second = Math.sin(seconds * secondFrequency + 1.7) * 0.55;
  const third = Math.sin(seconds * thirdFrequency + 0.4) * 0.28;
  return (first + second + third) / 1.83;
}
