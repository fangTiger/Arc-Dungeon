/**
 * 分级命中反馈纯逻辑。
 *
 * 之前打小怪和打 Boss 的反馈完全一样，命中失去了信息量。
 * 这里按「伤害量 + 是否重击来源 + 是否暴击/击杀」把命中分三级，
 * 每级给出定帧时长、屏震强度与持续时间、伤害数字颜色与字号。
 * 纯函数，不依赖时间与随机，由 runtime 直接消费。
 */

export const HIT_TIERS = Object.freeze({
  NORMAL: "normal",
  HEAVY: "heavy",
  CRITICAL: "critical",
});

/** 伤害达到该值即视为重击，与来源无关 */
export const HEAVY_HIT_DAMAGE_THRESHOLD = 26;

/** 天生按重击处理的命中来源：第三段普攻、冲刺斩、技能 */
export const HEAVY_HIT_SOURCES = Object.freeze(["comboFinisher", "dashSlash", "skill"]);

/** 伤害数字基础字号，像素字体只允许 10 的整数倍 */
export const DAMAGE_TEXT_BASE_SIZE = 10;

export const HIT_TIER_STYLES = Object.freeze({
  [HIT_TIERS.NORMAL]: Object.freeze({
    hitstopBaseMs: 34,
    hitstopPerDamageMs: 1.1,
    hitstopMaxMs: 78,
    shakeMagnitude: 2,
    shakeDurationMs: 110,
    numberColor: "#f8f1d8",
    numberSize: DAMAGE_TEXT_BASE_SIZE,
    burstParticles: 0,
  }),
  [HIT_TIERS.HEAVY]: Object.freeze({
    hitstopBaseMs: 62,
    hitstopPerDamageMs: 1.7,
    hitstopMaxMs: 128,
    shakeMagnitude: 4,
    shakeDurationMs: 180,
    numberColor: "#ffd166",
    numberSize: DAMAGE_TEXT_BASE_SIZE * 2,
    burstParticles: 0,
  }),
  [HIT_TIERS.CRITICAL]: Object.freeze({
    hitstopBaseMs: 92,
    hitstopPerDamageMs: 2.3,
    hitstopMaxMs: 172,
    shakeMagnitude: 7,
    shakeDurationMs: 240,
    numberColor: "#ff5d5d",
    numberSize: DAMAGE_TEXT_BASE_SIZE * 2,
    burstParticles: 14,
  }),
});

/**
 * 判定一次命中的反馈级别与强度。
 *
 * @param {object} hit
 * @param {number} hit.damage 实际结算伤害
 * @param {boolean} [hit.isCrit] 是否暴击
 * @param {boolean} [hit.killed] 该次命中是否击杀
 * @param {string} [hit.source] 命中来源：basic / comboFinisher / dashSlash / skill
 */
export function classifyHit({ damage, isCrit = false, killed = false, source = "basic" } = {}) {
  const appliedDamage = Math.max(0, Math.round(Number.isFinite(damage) ? damage : 0));
  const tier = resolveTier({ damage: appliedDamage, isCrit, killed, source });
  const style = HIT_TIER_STYLES[tier];
  const hitstopMs = Math.round(
    Math.min(
      style.hitstopMaxMs,
      style.hitstopBaseMs + appliedDamage * style.hitstopPerDamageMs,
    ),
  );

  return {
    tier,
    damage: appliedDamage,
    hitstopMs,
    shakeMagnitude: style.shakeMagnitude,
    shakeDurationMs: style.shakeDurationMs,
    numberColor: style.numberColor,
    numberSize: style.numberSize,
    burstParticles: killed ? Math.max(style.burstParticles, 12) : style.burstParticles,
  };
}

/**
 * 屏震偏移必须是整数像素，否则会触发亚像素抗锯齿破坏像素对齐。
 */
export function resolveShakeOffset({ magnitude, remainingMs, durationMs }) {
  if (!(magnitude > 0) || !(remainingMs > 0) || !(durationMs > 0)) {
    return { x: 0, y: 0 };
  }

  const phase = Math.max(0, Math.min(1, remainingMs / durationMs));
  const amplitude = Math.max(1, Math.round(magnitude * phase));

  return {
    x: Math.round(Math.sin(remainingMs * 0.08) * amplitude),
    y: Math.round(Math.cos(remainingMs * 0.11) * amplitude),
  };
}

function resolveTier({ damage, isCrit, killed, source }) {
  if (isCrit || killed) {
    return HIT_TIERS.CRITICAL;
  }

  if (HEAVY_HIT_SOURCES.includes(source) || damage >= HEAVY_HIT_DAMAGE_THRESHOLD) {
    return HIT_TIERS.HEAVY;
  }

  return HIT_TIERS.NORMAL;
}
