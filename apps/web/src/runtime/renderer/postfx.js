export function drawVignette(
  context,
  {
    width,
    height,
    centerX = width / 2,
    centerY = height / 2,
    radius = Math.hypot(width / 2, height / 2),
    intensity = 0.26,
  },
) {
  const gradient = context.createRadialGradient(
    centerX,
    centerY,
    Math.max(1, radius * 0.18),
    centerX,
    centerY,
    radius,
  );

  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.55, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, `rgba(0, 0, 0, ${clamp(intensity, 0, 1)})`);

  context.save();
  context.globalCompositeOperation = "source-over";
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
