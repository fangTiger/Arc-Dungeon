import { createPlayerBaseStats, getPlayerClass } from "./classes.js";
import { createProjectile } from "./projectile.js";
import { KNIGHT_SKILL_COOLDOWNS_MS } from "./skills.js";

export const COMBO_WINDOW_MS = 420;
export const DODGE_STAMINA_COST = 22;
export const DODGE_INVULNERABLE_MS = 420;
export const PLAYER_HURT_INVULNERABLE_MS = 1100;
export const CIRCULAR_SLASH_COOLDOWN_MS = KNIGHT_SKILL_COOLDOWNS_MS.CIRCULAR_SLASH;
export const SKILL_COOLDOWN_MS = CIRCULAR_SLASH_COOLDOWN_MS;

// 普攻不再产生任何击退：敌人被持续推开会让战斗完全失去威胁感，
// 击退改为技能（冲锋、盾击、圆斩、火球）的专属价值。
export const BASIC_ATTACK_KNOCKBACK = 0;

export const MELEE_ATTACKS = Object.freeze([
  Object.freeze({ comboStep: 1, damage: 10, range: 42, arc: 85, knockback: BASIC_ATTACK_KNOCKBACK }),
  Object.freeze({ comboStep: 2, damage: 14, range: 50, arc: 70, knockback: BASIC_ATTACK_KNOCKBACK }),
  Object.freeze({ comboStep: 3, damage: 22, range: 56, arc: 105, knockback: BASIC_ATTACK_KNOCKBACK }),
]);

const PROJECTILE_ATTACK = Object.freeze({
  comboStep: 1,
  speed: 210,
  maxLifeMs: 900,
  radius: 5,
  knockback: BASIC_ATTACK_KNOCKBACK,
});

export function createPlayer(overrides = {}) {
  const { classId = "knight", depth, ...stateOverrides } = overrides;
  const baseStats = createPlayerBaseStats(classId);
  const hp = clampHp(
    Object.hasOwn(stateOverrides, "hp") ? stateOverrides.hp : baseStats.maxHp,
    baseStats.maxHp,
  );

  return {
    x: 220,
    y: 190,
    radius: 14,
    hp,
    stamina: 100,
    maxStamina: 100,
    level: 1,
    xp: 0,
    xpToNext: 50,
    coins: 0,
    comboStep: 0,
    lastAttackAt: -Infinity,
    invulnerableUntil: 0,
    dodgeUntil: 0,
    skillReadyAt: 0,
    facing: { x: 1, y: 0 },
    quest: { goblins: 0, targetGoblins: 5 },
    ...stateOverrides,
    hp,
    maxHp: baseStats.maxHp,
    attack: baseStats.attack,
    defense: baseStats.defense,
    critRate: baseStats.critRate,
    critMultiplier: baseStats.critMultiplier,
    classId: baseStats.classId,
    attackMode: baseStats.attackMode,
    spritePrefix: baseStats.spritePrefix,
  };
}

export function triggerAttack(player, now) {
  const playerClass = getPlayerClass(player.classId ?? "knight");

  if (playerClass.attackMode === "projectile") {
    const direction = normalizeDirection(player.facing ?? { x: 1, y: 0 }, { x: 1, y: 0 });
    const projectile = createProjectile({
      x: player.x,
      y: player.y,
      dirX: direction.x,
      dirY: direction.y,
      speed: PROJECTILE_ATTACK.speed,
      damage: player.attack,
      maxLifeMs: PROJECTILE_ATTACK.maxLifeMs,
      radius: PROJECTILE_ATTACK.radius,
    });

    return {
      player: {
        ...player,
        comboStep: 1,
        lastAttackAt: now,
        facing: direction,
      },
      attack: {
        ...PROJECTILE_ATTACK,
        attackMode: "projectile",
        damage: player.attack,
        projectile,
      },
    };
  }

  const comboStep =
    now - player.lastAttackAt <= COMBO_WINDOW_MS
      ? (player.comboStep % 3) + 1
      : 1;
  const attack = MELEE_ATTACKS[comboStep - 1];

  return {
    player: {
      ...player,
      comboStep,
      lastAttackAt: now,
    },
    attack: {
      ...attack,
      attackMode: "meleeArc",
    },
  };
}

export function startDodge(player, direction, now) {
  if (player.stamina < DODGE_STAMINA_COST) {
    return { player, started: false };
  }

  const normalized = normalizeDirection(direction, player.facing);

  return {
    started: true,
    player: {
      ...player,
      stamina: player.stamina - DODGE_STAMINA_COST,
      invulnerableUntil: now + DODGE_INVULNERABLE_MS,
      dodgeUntil: now + 260,
      dodgeDirection: normalized,
      facing: normalized,
    },
  };
}

export function isInvulnerable(player, now) {
  return now < player.invulnerableUntil;
}

export function damagePlayer(player, {
  damage,
  now,
  invulnerableMs = PLAYER_HURT_INVULNERABLE_MS,
  flashMs = 95,
  knockback = { x: 0, y: 0 },
} = {}) {
  const hp = clampHp(player.hp, player.maxHp);

  if (hp <= 0 || now < (player.invulnerableUntil ?? 0)) {
    return {
      applied: false,
      damage: 0,
      player: { ...player, hp },
    };
  }

  const appliedDamage = Math.max(0, Math.round(damage));

  if (appliedDamage <= 0) {
    return {
      applied: false,
      damage: 0,
      player: { ...player, hp },
    };
  }

  return {
    applied: true,
    damage: appliedDamage,
    player: {
      ...player,
      hp: Math.max(0, hp - appliedDamage),
      flashUntil: now + flashMs,
      invulnerableUntil: now + invulnerableMs,
      knockbackX: Number.isFinite(knockback.x) ? knockback.x : 0,
      knockbackY: Number.isFinite(knockback.y) ? knockback.y : 0,
    },
  };
}

export function healPlayer(player, amount) {
  const hp = clampHp(player.hp, player.maxHp);

  if (hp <= 0) {
    return {
      healed: 0,
      player: { ...player, hp: 0 },
    };
  }

  const healAmount = Math.max(0, Math.round(amount));
  const nextHp = clampHp(hp + healAmount, player.maxHp);

  return {
    healed: nextHp - hp,
    player: {
      ...player,
      hp: nextHp,
    },
  };
}

export function useCircularSlash(player, now) {
  if (now < player.skillReadyAt) {
    return { player, activated: false };
  }
  const cooldownMs = Math.round(SKILL_COOLDOWN_MS * safeMultiplier(player.cooldownMultiplier, 0.2));

  return {
    activated: true,
    player: {
      ...player,
      skillReadyAt: now + cooldownMs,
    },
    attack: {
      comboStep: "skill",
      damage: 28,
      radius: 76,
      knockback: 42,
    },
  };
}

export function addExperience(player, gainedXp) {
  let xp = player.xp + gainedXp;
  let level = player.level;
  let xpToNext = player.xpToNext;

  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    xpToNext = Math.round(xpToNext * 1.35);
  }

  return {
    ...player,
    xp,
    level,
    xpToNext,
    maxHp: player.maxHp + (level - player.level) * 8,
    hp: Math.min(player.maxHp + (level - player.level) * 8, player.hp + 16),
  };
}

export function respawnIfDefeated(player, townSpawn) {
  if (player.hp > 0) {
    return player;
  }

  return {
    ...player,
    hp: player.maxHp,
    stamina: player.maxStamina,
    x: townSpawn.x,
    y: townSpawn.y,
  };
}

function normalizeDirection(direction, fallback) {
  const length = Math.hypot(direction.x, direction.y);
  if (length === 0) {
    return fallback;
  }

  return { x: direction.x / length, y: direction.y / length };
}

function clampHp(value, maxHp) {
  const fallback = Number.isFinite(maxHp) ? maxHp : 1;
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(fallback, value));
}

function safeMultiplier(value, minimum = 0) {
  return Number.isFinite(value) ? Math.max(minimum, value) : 1;
}
