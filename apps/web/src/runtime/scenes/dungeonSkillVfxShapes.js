/**
 * 技能特效的图元与组合配方。
 *
 * 这里只负责「一个技能由哪些图元、按什么参数组成」，是纯数据构造，
 * 不持有状态；状态与生命周期在 `dungeonSkillVfx.js`，绘制在 `dungeonSkillVfxRender.js`。
 * 随机由调用方注入 `core/rng.js` 的实例，保证同一 run seed 表现可复现。
 */

export function ringEffect({
  x, y, startRadius, endRadius, color, width = 2, delayMs = 0, maxAgeMs, light = null,
}) {
  return {
    kind: "ring",
    x: Math.round(x),
    y: Math.round(y),
    startRadius,
    endRadius,
    color,
    width,
    delayMs,
    ageMs: 0,
    maxAgeMs: maxAgeMs + delayMs,
    light,
  };
}

export function trailEffect({ from, to, color, width = 2, maxAgeMs = 260 }) {
  return {
    kind: "trail",
    x1: Math.round(from.x),
    y1: Math.round(from.y),
    x2: Math.round(to.x),
    y2: Math.round(to.y),
    color,
    width,
    ageMs: 0,
    maxAgeMs,
  };
}

export function dotEffect({ x, y, color, size = 2, maxAgeMs = 260 }) {
  return { kind: "dot", x: Math.round(x), y: Math.round(y), size, color, ageMs: 0, maxAgeMs };
}

export function nodeEffect({ x, y, color, radius = 7, maxAgeMs = 300, light = null }) {
  return {
    kind: "node",
    x: Math.round(x),
    y: Math.round(y),
    radius,
    color,
    ageMs: 0,
    maxAgeMs,
    light,
  };
}

/** 远程前摇：一条持续追踪玩家、随蓄力进度增强的瞄准线。 */
export function enemyAimEffect({ enemy, player, now }) {
  const durationMs = Math.max(1, enemy.attackWindupMs ?? 1);
  const chargePhase = clamp01((now - enemy.stateSince) / durationMs);

  return {
    kind: "enemyAim",
    x1: Math.round(enemy.x),
    y1: Math.round(enemy.y - 6),
    x2: Math.round(player.x),
    y2: Math.round(player.y - 4),
    color: "#ffad66",
    alpha: roundScale(0.28 + chargePhase * 0.68),
    width: 1 + Math.floor(chargePhase * 3),
    chargePhase,
    ageMs: 0,
    maxAgeMs: 1,
  };
}

/** 远程命中：短寿命的暖白击发束，端点锁定实际受击位置。 */
export function rangedEnemyShotEffects({ enemy, player }) {
  return [{
    kind: "enemyShot",
    x1: Math.round(enemy.x),
    y1: Math.round(enemy.y - 6),
    x2: Math.round(player.x),
    y2: Math.round(player.y - 4),
    color: "#fff0bf",
    ageMs: 0,
    maxAgeMs: 180,
  }];
}

export function sparkEffects({ x, y, count, color, speed, spreadUp, rng }) {
  const sparks = [];

  for (let index = 0; index < count; index += 1) {
    const angle = rng.next() * Math.PI * 2;
    const velocity = speed * (0.45 + rng.next() * 0.75);

    sparks.push({
      kind: "spark",
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - speed * spreadUp,
      size: rng.next() > 0.7 ? 2 : 1,
      color,
      ageMs: 0,
      maxAgeMs: 260 + rng.next() * 220,
    });
  }

  return sparks;
}

/** 圆斩：三重环形刀光由内向外扩散 */
export function circularSlashEffects({ x, y, radius, color }) {
  return [0, 1, 2].map((index) => ringEffect({
    x,
    y,
    startRadius: radius * 0.28 + index * 6,
    endRadius: radius + index * 9,
    color,
    width: 3 - index,
    delayMs: index * 55,
    maxAgeMs: 300 + index * 40,
    light: index === 0 ? { radius: radius + 12, intensity: 0.6 } : null,
  }));
}

/** 冲锋：冲刺轨迹残影 + 落点撞击尘土 */
export function chargeTrailEffects({ from, to, color, rng }) {
  return [
    trailEffect({ from, to, color, width: 3 }),
    ringEffect({
      x: to.x,
      y: to.y,
      startRadius: 6,
      endRadius: 30,
      color: "#c9a882",
      maxAgeMs: 250,
      light: { radius: 34, intensity: 0.42 },
    }),
    ...sparkEffects({ x: to.x, y: to.y, count: 10, color: "#d8c19a", speed: 58, spreadUp: 0.35, rng }),
  ];
}

/** 盾击：正面盾牌闪光 */
export function shieldBashEffects({ x, y, facing, color }) {
  const angle = Math.atan2(facing.y, facing.x);

  return [{
    kind: "shield",
    x: Math.round(x + Math.cos(angle) * 12),
    y: Math.round(y + Math.sin(angle) * 12),
    angle,
    color,
    ageMs: 0,
    maxAgeMs: 220,
    light: { radius: 30, intensity: 0.58, color },
  }];
}

/** 战吼：三道红色脉冲波从角色身上向外推 */
export function warCryEffects({ x, y, color = "#ff6a4a" }) {
  return [0, 1, 2].map((index) => ringEffect({
    x,
    y,
    startRadius: 8,
    endRadius: 46 + index * 12,
    color,
    delayMs: index * 130,
    maxAgeMs: 460,
    light: { radius: 48, intensity: 0.5, color },
  }));
}

/** 火球命中：爆炸双环 + 四散火星，并向光照层提交强光 */
export function fireballBurstEffects({ x, y, radius, color = "#ff7a4d", rng }) {
  return [
    ringEffect({
      x,
      y,
      startRadius: 4,
      endRadius: Math.max(18, radius),
      color,
      width: 3,
      maxAgeMs: 280,
      light: { radius: Math.max(38, radius + 20), intensity: 0.92, color },
    }),
    ringEffect({
      x,
      y,
      startRadius: 2,
      endRadius: Math.max(12, radius * 0.6),
      color: "#ffe08a",
      maxAgeMs: 200,
    }),
    ...sparkEffects({ x, y, count: 14, color: "#ffb056", speed: 118, spreadUp: 0.3, rng }),
  ];
}

/** 冰环：两道蓝色波纹向外扩散 */
export function iceRingEffects({ x, y, radius, color = "#78d8ff", rng }) {
  return [
    ...[0, 1].map((index) => ringEffect({
      x,
      y,
      startRadius: 6 + index * 10,
      endRadius: radius + index * 10,
      color,
      delayMs: index * 90,
      maxAgeMs: 420,
      light: index === 0 ? { radius: radius + 8, intensity: 0.46, color } : null,
    })),
    ...sparkEffects({ x, y, count: 8, color: "#bff0ff", speed: 46, spreadUp: 0.1, rng }),
  ];
}

/** 闪现：起点与终点各留一枚光点，中间连一道细线 */
export function blinkEffects({ from, to, color = "#bda2ff" }) {
  return [
    ...[from, to].map((point) => nodeEffect({
      x: point.x,
      y: point.y,
      color,
      light: { radius: 30, intensity: 0.62, color },
    })),
    trailEffect({ from, to, color, width: 1, maxAgeMs: 220 }),
  ];
}

/** 奥术涌动：紫色内收光环 */
export function arcaneSurgeEffects({ x, y, color = "#d48cff" }) {
  return [0, 1].map((index) => ringEffect({
    x,
    y,
    startRadius: 30 - index * 12,
    endRadius: 10 + index * 12,
    color,
    delayMs: index * 110,
    maxAgeMs: 400,
    light: { radius: 44, intensity: 0.54, color },
  }));
}

/** 击杀爆散：敌人碎成一圈粒子 */
export function deathBurstEffects({ x, y, count = 14, color = "#ffd9c2", rng }) {
  return [
    ...sparkEffects({ x, y, count, color, speed: 104, spreadUp: 0.45, rng }),
    ringEffect({ x, y, startRadius: 3, endRadius: 22, color, width: 1, maxAgeMs: 220 }),
  ];
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function roundScale(value) {
  return Math.round(value * 1000) / 1000;
}
