import {
  DAMAGE_TEXT_BASE_SIZE,
  classifyHit,
  resolveShakeOffset,
} from "../../core/combat.js";

const DAMAGE_NUMBER_MS = 620;
const BURST_MS = 150;

export function createCombatFeedback() {
  let damageNumbers = [];
  let bursts = [];
  let afterimages = [];
  let hitstopMs = 0;
  let shakeMs = 0;
  let shakeDurationMs = 0;
  let shakeMagnitude = 0;

  function reset() {
    damageNumbers = [];
    bursts = [];
    afterimages = [];
    hitstopMs = 0;
    shakeMs = 0;
    shakeDurationMs = 0;
    shakeMagnitude = 0;
  }

  function update(dtMs) {
    damageNumbers = damageNumbers
      .map((number) => ({ ...number, ageMs: number.ageMs + dtMs }))
      .filter((number) => number.ageMs < number.maxAgeMs);
    bursts = bursts
      .map((burst) => ({ ...burst, ageMs: burst.ageMs + dtMs }))
      .filter((burst) => burst.ageMs < burst.maxAgeMs);
    afterimages = afterimages
      .map((afterimage) => ({ ...afterimage, ageMs: afterimage.ageMs + dtMs }))
      .filter((afterimage) => afterimage.ageMs < afterimage.maxAgeMs);
    shakeMs = Math.max(0, shakeMs - dtMs);
  }

  function tickHitstop(dtMs) {
    if (hitstopMs <= 0) {
      return false;
    }

    hitstopMs = Math.max(0, hitstopMs - dtMs);
    return true;
  }

  function isHitStopped() {
    return hitstopMs > 0;
  }

  function addMeleeBurst(player, attack) {
    const angle = Math.atan2(player.facing.y, player.facing.x);
    const halfArc = (attack.arc * Math.PI) / 360;
    bursts.push({
      x: Math.round(player.x),
      y: Math.round(player.y),
      radius: attack.range,
      startAngle: angle - halfArc,
      endAngle: angle + halfArc,
      color: attack.burstColor ?? "#ffe8a3",
      width: attack.burstWidth ?? 2,
      ageMs: 0,
      maxAgeMs: attack.maxAgeMs ?? BURST_MS,
    });
  }

  function addDamageNumber(x, y, value, { color = "#f8f1d8", size = DAMAGE_TEXT_BASE_SIZE } = {}) {
    damageNumbers.push({
      x: Math.round(x),
      y: Math.round(y),
      value,
      color,
      size,
      ageMs: 0,
      maxAgeMs: DAMAGE_NUMBER_MS,
    });
  }

  function addAfterimage(player, color = "#78dcff") {
    afterimages.push({
      x: Math.round(player.x),
      y: Math.round(player.y),
      facingName: player.facingName,
      color,
      ageMs: 0,
      maxAgeMs: 210,
    });
  }

  /**
   * 分级命中反馈：级别、定帧、屏震与数字样式全部由 core 的 classifyHit 决定，
   * 这里只负责把结果落到运行时状态上。
   */
  function applyHitFeedback({ x, y, damage, isCrit, killed, source }) {
    const feedback = classifyHit({ damage, isCrit, killed, source });

    addDamageNumber(x, y, feedback.damage, {
      color: feedback.numberColor,
      size: feedback.numberSize,
    });
    hitstopMs = Math.max(hitstopMs, feedback.hitstopMs);
    startShake(feedback.shakeMagnitude, feedback.shakeDurationMs);
    return feedback;
  }

  function startPlayerHitFeedback() {
    hitstopMs = Math.max(hitstopMs, 55);
    startShake(3, 150);
  }

  function startShake(magnitude, durationMs) {
    shakeMagnitude = Math.max(shakeMagnitude, magnitude);
    shakeMs = Math.max(shakeMs, durationMs);
    shakeDurationMs = Math.max(shakeDurationMs, durationMs);
  }

  function cameraShake() {
    if (shakeMs <= 0) {
      shakeMagnitude = 0;
      shakeDurationMs = 0;
      return { x: 0, y: 0 };
    }

    return resolveShakeOffset({
      magnitude: shakeMagnitude,
      remainingMs: shakeMs,
      durationMs: shakeDurationMs,
    });
  }

  return {
    reset,
    update,
    tickHitstop,
    isHitStopped,
    addMeleeBurst,
    addDamageNumber,
    addAfterimage,
    applyHitFeedback,
    startPlayerHitFeedback,
    cameraShake,
    get damageNumbers() {
      return damageNumbers;
    },
    get bursts() {
      return bursts;
    },
    get afterimages() {
      return afterimages;
    },
  };
}
