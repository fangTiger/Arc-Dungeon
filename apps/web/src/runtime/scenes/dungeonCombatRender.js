import { drawCenteredPixelText } from "../ui/pixelUi.js";

export function drawProjectileBodies(context, projectiles, camera) {
  if (!Array.isArray(projectiles) || projectiles.length === 0) {
    return;
  }

  context.save();
  for (const projectile of projectiles) {
    const screen = camera.worldToScreen(projectile.x, projectile.y);
    const x = Math.round(screen.x);
    const y = Math.round(screen.y);
    const radius = Math.max(2, Math.round(projectile.radius));

    context.fillStyle = "#fff5b8";
    context.fillRect(x - radius, y - 1, radius * 2, 2);
    context.fillStyle = "#7ce8ff";
    context.fillRect(x - 1, y - radius, 2, radius * 2);
  }
  context.restore();
}

export function drawCombatBursts(context, bursts, camera) {
  if (!Array.isArray(bursts) || bursts.length === 0) {
    return;
  }

  context.save();

  for (const burst of bursts) {
    const phase = burst.ageMs / burst.maxAgeMs;
    const screen = camera.worldToScreen(burst.x, burst.y);
    const radius = Math.round(burst.radius * (0.75 + phase * 0.35));
    context.globalAlpha = Math.max(0, 1 - phase);
    context.lineWidth = Math.max(1, Math.round(burst.width ?? 2));
    context.strokeStyle = burst.color;
    context.beginPath();
    context.arc(
      Math.round(screen.x),
      Math.round(screen.y),
      radius,
      burst.startAngle,
      burst.endAngle,
    );
    context.stroke();
  }

  context.restore();
}

export function drawDamageNumbers(context, numbers, camera) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return;
  }

  context.save();

  for (const number of numbers) {
    const phase = number.ageMs / number.maxAgeMs;
    const screen = camera.worldToScreen(number.x, number.y - phase * 18);
    const text = String(number.value);
    const size = number.size ?? 10;
    const y = Math.round(screen.y) - 5 - (size - 10);

    context.globalAlpha = Math.max(0, 1 - phase);
    drawCenteredPixelText(context, text, Math.round(screen.x) + 1, y + 1, {
      color: "#0b0709",
      size,
    });
    drawCenteredPixelText(context, text, Math.round(screen.x), y, {
      color: number.color,
      size,
    });
  }

  context.restore();
}
