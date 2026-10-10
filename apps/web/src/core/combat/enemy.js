import { applyRewardModifiers } from "../worldModifiers.js";
import { applyDepthScaling } from "./damage.js";
import { ENEMY_TYPES } from "./enemyTypes.js";
import { createPoiseState } from "./poise.js";

export const ENEMY_STATES = Object.freeze({
  PATROL: "patrol",
  ALERT: "alert",
  CHASE: "chase",
  WAIT: "wait",
  WINDUP: "windup",
  ATTACK: "attack",
  COOLDOWN: "cooldown",
  HITSTUN: "hitstun",
  DEAD: "dead",
});

export const ENEMY_AI_TIMING = Object.freeze({
  alertMs: 160,
  attackMs: 90,
  cooldownMs: 920,
});

const ENEMY_REWARDS = Object.freeze({
  slime: Object.freeze({ xp: 12, coins: 4, materials: 0 }),
  goblin: Object.freeze({ xp: 22, coins: 8, materials: 1 }),
  elite: Object.freeze({ xp: 60, coins: 28, materials: 3 }),
  imp: Object.freeze({ xp: 18, coins: 7, materials: 1 }),
  skelet: Object.freeze({ xp: 24, coins: 9, materials: 1 }),
  tiny_zombie: Object.freeze({ xp: 12, coins: 4, materials: 0 }),
  masked_orc: Object.freeze({ xp: 32, coins: 12, materials: 1 }),
  orc_warrior: Object.freeze({ xp: 42, coins: 16, materials: 2 }),
  orc_shaman: Object.freeze({ xp: 46, coins: 18, materials: 2 }),
  wogol: Object.freeze({ xp: 58, coins: 22, materials: 3 }),
  chort: Object.freeze({ xp: 70, coins: 28, materials: 3 }),
});

const LEGACY_ENEMY_TYPES = Object.freeze({
  slime: Object.freeze({
    id: "slime",
    baseHp: 28,
    attack: 8,
    speed: 44,
    detectRadius: 160,
    attackRange: 22,
    attackWindupMs: 420,
    framePrefix: "tiny_zombie",
    spritePrefix: "tiny_zombie",
  }),
  elite: Object.freeze({
    id: "elite",
    baseHp: 150,
    attack: 22,
    speed: 42,
    detectRadius: 250,
    attackRange: 34,
    attackWindupMs: 620,
    framePrefix: "orc_warrior",
    spritePrefix: "orc_warrior",
  }),
});

export function createEnemy(type, overrides = {}) {
  const definition = ENEMY_TYPES[type] ?? LEGACY_ENEMY_TYPES[type];

  if (!definition) {
    throw new Error(`未知敌人类型: ${type}`);
  }

  const { depth, attackReadyAt: overrideAttackReadyAt, ...stateOverrides } = overrides;
  const baseStats = { maxHp: definition.baseHp, damage: definition.attack };
  const stats = Number.isFinite(depth) ? applyDepthScaling(baseStats, depth) : baseStats;
  const poiseState = createPoiseState({
    baseHp: definition.baseHp,
    isBoss: Boolean(stateOverrides.isBoss),
  });
  const attackReadyAt = Number.isFinite(overrideAttackReadyAt)
    ? Math.max(0, overrideAttackReadyAt)
    : 0;

  return {
    type,
    id: stateOverrides.id,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    damage: stats.damage,
    attack: stats.damage,
    speed: definition.speed,
    detectRadius: definition.detectRadius,
    attackRange: definition.attackRange,
    attackWindupMs: definition.attackWindupMs,
    framePrefix: definition.framePrefix,
    spritePrefix: definition.spritePrefix,
    state: "patrol",
    stateSince: 0,
    stunUntil: 0,
    attackReadyAt,
    ...poiseState,
    ...stateOverrides,
  };
}

export function setEnemyState(enemy, state, now = enemy.stateSince) {
  const nextEnemy = {
    ...enemy,
    state,
    stateSince: now,
  };

  if (state === ENEMY_STATES.ATTACK) {
    return {
      ...nextEnemy,
      attackReadyAt: Math.max(attackReadyAtFor(enemy), now + ENEMY_AI_TIMING.attackMs + ENEMY_AI_TIMING.cooldownMs),
    };
  }

  if (state === ENEMY_STATES.COOLDOWN) {
    return {
      ...nextEnemy,
      attackReadyAt: Math.max(attackReadyAtFor(enemy), now + ENEMY_AI_TIMING.cooldownMs),
    };
  }

  return nextEnemy;
}

export function damageEnemy(enemy, damage, now = enemy.stateSince) {
  const hp = Math.max(0, enemy.hp - damage);

  return {
    ...enemy,
    hp,
    state: hp === 0 ? "dead" : enemy.state,
    stateSince: hp === 0 ? now : enemy.stateSince,
  };
}

export function canEnemyAct(enemy, now) {
  return enemy.hp > 0 && now >= enemy.stunUntil && enemy.state !== "dead";
}

/**
 * 推进敌人状态机。
 *
 * `attackPermitted` 由错峰调度注入：拿不到攻击名额的敌人在攻击距离内进入
 * `wait` 等待态，继续保持包围但不发起前摇，避免所有敌人同时集火或同时前摇。
 */
export function nextEnemyState(enemy, { player, now, attackPermitted = true }) {
  if (enemy.state === ENEMY_STATES.DEAD) {
    return enemy;
  }

  if (enemy.hp <= 0) {
    return transitionEnemy(enemy, ENEMY_STATES.DEAD, now);
  }

  if (now < enemy.stunUntil || enemy.state === ENEMY_STATES.HITSTUN) {
    if (now < enemy.stunUntil) {
      return transitionEnemy(enemy, ENEMY_STATES.HITSTUN, enemy.stateSince);
    }

    return transitionEnemy(enemy, playerWithinDetectRadius(enemy, player)
      ? ENEMY_STATES.CHASE
      : ENEMY_STATES.PATROL, now);
  }

  const distance = distanceToPlayer(enemy, player);
  const canDetect = distance < enemy.detectRadius;
  const canAttack = distance <= enemy.attackRange;
  const elapsed = now - enemy.stateSince;

  if (enemy.state === ENEMY_STATES.PATROL) {
    return canDetect ? transitionEnemy(enemy, ENEMY_STATES.ALERT, now) : enemy;
  }

  if (enemy.state === ENEMY_STATES.ALERT) {
    return elapsed >= ENEMY_AI_TIMING.alertMs
      ? transitionEnemy(enemy, ENEMY_STATES.CHASE, now)
      : enemy;
  }

  if (enemy.state === ENEMY_STATES.CHASE) {
    if (!canDetect) {
      return transitionEnemy(enemy, ENEMY_STATES.PATROL, now);
    }

    if (!canAttack) {
      return enemy;
    }

    if (!attackPermitted) {
      return transitionEnemy(enemy, ENEMY_STATES.WAIT, now);
    }

    return isAttackReady(enemy, now)
      ? transitionEnemy(enemy, ENEMY_STATES.WINDUP, now)
      : enemy;
  }

  if (enemy.state === ENEMY_STATES.WAIT) {
    if (!canDetect) {
      return transitionEnemy(enemy, ENEMY_STATES.PATROL, now);
    }

    if (!canAttack) {
      return transitionEnemy(enemy, ENEMY_STATES.CHASE, now);
    }

    return attackPermitted && isAttackReady(enemy, now)
      ? transitionEnemy(enemy, ENEMY_STATES.WINDUP, now)
      : enemy;
  }

  if (enemy.state === ENEMY_STATES.WINDUP) {
    return elapsed >= enemy.attackWindupMs
      ? transitionEnemy(enemy, ENEMY_STATES.ATTACK, now)
      : enemy;
  }

  if (enemy.state === ENEMY_STATES.ATTACK) {
    return elapsed >= ENEMY_AI_TIMING.attackMs
      ? transitionEnemy(enemy, ENEMY_STATES.COOLDOWN, now)
      : enemy;
  }

  if (enemy.state === ENEMY_STATES.COOLDOWN) {
    return elapsed >= ENEMY_AI_TIMING.cooldownMs
      ? transitionEnemy(enemy, canDetect ? ENEMY_STATES.CHASE : ENEMY_STATES.PATROL, now)
      : enemy;
  }

  return transitionEnemy(enemy, ENEMY_STATES.PATROL, now);
}

export function defeatEnemy(enemy, modifier) {
  const reward = ENEMY_REWARDS[enemy.type];

  if (!reward) {
    throw new Error(`无法结算未知敌人奖励: ${enemy.type}`);
  }

  return applyRewardModifiers(reward, modifier);
}

function transitionEnemy(enemy, state, now) {
  if (enemy.state === state) {
    return enemy;
  }

  return setEnemyState(enemy, state, now);
}

function isAttackReady(enemy, now) {
  return now >= attackReadyAtFor(enemy);
}

function attackReadyAtFor(enemy) {
  return Number.isFinite(enemy.attackReadyAt) ? enemy.attackReadyAt : 0;
}

function playerWithinDetectRadius(enemy, player) {
  return distanceToPlayer(enemy, player) < enemy.detectRadius;
}

function distanceToPlayer(enemy, player) {
  if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)) {
    return Infinity;
  }

  return Math.hypot((enemy.x ?? 0) - player.x, (enemy.y ?? 0) - player.y);
}
