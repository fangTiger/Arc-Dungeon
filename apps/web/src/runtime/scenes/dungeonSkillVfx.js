import { createRng, hashSeed } from "../../core/rng.js";
import {
  arcaneSurgeEffects,
  blinkEffects,
  chargeTrailEffects,
  circularSlashEffects,
  deathBurstEffects,
  dotEffect,
  enemyAimEffect,
  fireballBurstEffects,
  iceRingEffects,
  rangedEnemyShotEffects,
  shieldBashEffects,
  sparkEffects,
  warCryEffects,
} from "./dungeonSkillVfxShapes.js";

/**
 * 战斗特效状态层。
 *
 * 8 个技能过去共用同一套挥砍/圆形 burst，释放感为零。
 * 每个技能在这里都有自己的 spawn 入口，配方在 `dungeonSkillVfxShapes.js`，
 * 敌方远程攻击也复用同一 effects 通道；绘制在 `dungeonSkillVfxRender.js`，
 * 光源交回既有光照层。
 */

const SPARK_GRAVITY = 140;
const TRAIL_DOT_MS = 260;

// 现有近战敌人的攻击距离最大为 42px，远程敌人为 120px；
// 64px 是两组之间的表现层分界，不参与命中判定或平衡计算。
export const RANGED_ATTACK_RANGE_THRESHOLD = 64;

export function createSkillVfx({ seed = "rialo:skill-vfx" } = {}) {
  let effects = [];
  let rng = createRng(hashSeed(String(seed)));

  function reset(nextSeed = seed) {
    effects = [];
    rng = createRng(hashSeed(String(nextSeed)));
  }

  function update(dtMs) {
    const dt = dtMs / 1000;

    effects = effects
      .map((effect) => advance(effect, dt, dtMs))
      .filter((effect) => effect.ageMs < effect.maxAgeMs);
  }

  function getEffects({ enemies = [], player, now = 0 } = {}) {
    const aimEffects = enemies
      .filter((enemy) =>
        enemy.hp > 0 && enemy.state === "windup" && isRangedEnemyAttack(enemy))
      .map((enemy) => enemyAimEffect({ enemy, player, now }));

    return [...effects, ...aimEffects];
  }

  function emit(created) {
    effects.push(...created);
  }

  /** 圆斩：环形刀光扩散 */
  function spawnCircularSlash({ x, y, radius, color }) {
    emit(circularSlashEffects({ x, y, radius, color }));
  }

  /** 冲锋：冲刺轨迹残影 + 撞击尘土 */
  function spawnChargeTrail({ from, to, color }) {
    emit(chargeTrailEffects({ from, to, color, rng }));
  }

  /** 盾击：正面盾牌闪光 */
  function spawnShieldBash({ x, y, facing, color }) {
    emit(shieldBashEffects({ x, y, facing, color }));
  }

  /** 盾击格挡成功时的火花 */
  function spawnShieldSpark({ x, y, color = "#dff1ff" }) {
    emit(sparkEffects({ x, y, count: 9, color, speed: 96, spreadUp: 0.2, rng }));
  }

  /** 战吼：周身红色脉冲波 */
  function spawnWarCry({ x, y, color }) {
    emit(warCryEffects({ x, y, color }));
  }

  /** 火球命中爆炸 */
  function spawnFireballBurst({ x, y, radius, color }) {
    emit(fireballBurstEffects({ x, y, radius, color, rng }));
  }

  /** 火球飞行拖尾：每帧丢一个逐渐消散的火点 */
  function spawnProjectileTrail({ x, y, color }) {
    emit([dotEffect({ x, y, color, size: 2, maxAgeMs: TRAIL_DOT_MS })]);
  }

  /** 冰环：蓝色环形波纹扩散 */
  function spawnIceRing({ x, y, radius, color }) {
    emit(iceRingEffects({ x, y, radius, color, rng }));
  }

  /** 闪现：两端光点 + 连线残影 */
  function spawnBlink({ from, to, color }) {
    emit(blinkEffects({ from, to, color }));
  }

  /** 奥术涌动：紫色内收光环 */
  function spawnArcaneSurge({ x, y, color }) {
    emit(arcaneSurgeEffects({ x, y, color }));
  }

  /** 击杀爆散粒子 */
  function spawnDeathBurst({ x, y, count, color }) {
    emit(deathBurstEffects({ x, y, count, color, rng }));
  }

  /** 只有远程攻击真实命中后才写入击发束。 */
  function spawnRangedEnemyShot({ enemy, player }) {
    if (isRangedEnemyAttack(enemy)) {
      emit(rangedEnemyShotEffects({ enemy, player }));
    }
  }

  function advance(effect, dt, dtMs) {
    const aged = { ...effect, ageMs: effect.ageMs + dtMs };

    if (aged.kind !== "spark") {
      return aged;
    }

    return {
      ...aged,
      x: aged.x + aged.vx * dt,
      y: aged.y + aged.vy * dt,
      vy: aged.vy + SPARK_GRAVITY * dt,
    };
  }

  /** 把带 light 的特效交给既有光照层，强度随生命周期衰减 */
  function getDynamicLights() {
    return effects
      .filter((effect) => effect.light && effect.ageMs >= (effect.delayMs ?? 0))
      .map((effect) => {
        const phase = Math.max(0, 1 - effect.ageMs / effect.maxAgeMs);
        return {
          x: effect.x,
          y: effect.y,
          radius: effect.light.radius,
          color: effect.light.color ?? effect.color,
          intensity: effect.light.intensity * phase,
        };
      })
      .filter((light) => light.intensity > 0.02);
  }

  return {
    reset,
    update,
    spawnCircularSlash,
    spawnChargeTrail,
    spawnShieldBash,
    spawnShieldSpark,
    spawnWarCry,
    spawnFireballBurst,
    spawnProjectileTrail,
    spawnIceRing,
    spawnBlink,
    spawnArcaneSurge,
    spawnDeathBurst,
    spawnRangedEnemyShot,
    getDynamicLights,
    getEffects,
    get effects() {
      return effects;
    },
  };
}

export function isRangedEnemyAttack(enemy) {
  return Number.isFinite(enemy?.attackRange) &&
    enemy.attackRange > RANGED_ATTACK_RANGE_THRESHOLD;
}
