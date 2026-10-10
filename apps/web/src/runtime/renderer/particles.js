import { setImageSmoothing } from "./pixelSurface.js";

const DUST_COLOR = Object.freeze({ r: 238, g: 217, b: 164 });
const SPLASH_COLOR = Object.freeze({ r: 91, g: 202, b: 255 });

export function createParticleRenderer() {
  function draw(context, particleState, camera) {
    if (!particleState) {
      return;
    }

    context.save();
    setImageSmoothing(context, false);
    drawParticleList(context, particleState.dust ?? [], camera, DUST_COLOR);
    drawParticleList(context, particleState.splashes ?? [], camera, SPLASH_COLOR);
    context.restore();
  }

  return { draw };
}

function drawParticleList(context, particles, camera, color) {
  for (const particle of particles) {
    if (particle.alpha <= 0) {
      continue;
    }

    const screen = camera.worldToScreen(particle.x, particle.y);
    const x = Math.round(screen.x);
    const y = Math.round(screen.y);
    const size = Math.max(1, Math.round(particle.size ?? 1));

    context.fillStyle = toRgba(color, particle.alpha);
    context.fillRect(x, y, size, size);
  }
}

function toRgba({ r, g, b }, alpha) {
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}
