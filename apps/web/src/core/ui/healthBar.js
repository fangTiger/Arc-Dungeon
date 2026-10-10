export function calculateHealthBar({
  hp,
  maxHp,
  width,
  previousHp = hp,
  lowThreshold = 0.3,
}) {
  assertPositiveInteger(width, "血条宽度必须是正整数");
  const safeMaxHp = Number(maxHp) > 0 ? Number(maxHp) : 1;
  const ratio = clamp01(Number(hp) / safeMaxHp);
  const previousRatio = clamp01(Number(previousHp) / safeMaxHp);
  const fillWidth = Math.round(width * ratio);
  const ghostWidth = Math.max(fillWidth, Math.round(width * previousRatio));

  return {
    ratio,
    fillWidth,
    ghostWidth,
    isLow: ratio <= lowThreshold,
  };
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function assertPositiveInteger(value, message) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(message);
  }
}
