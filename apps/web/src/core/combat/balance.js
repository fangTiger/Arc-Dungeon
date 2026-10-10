import { BOSS_FLOOR_INTERVAL, difficultyForDepth } from "../dungeon/progression.js";
import {
  MAJOR_UPGRADES,
  MINOR_UPGRADES,
} from "../run/upgrades.js";
import { PLAYER_CLASSES } from "./classes.js";
import { defenseDamageMultiplier, resolveDamage } from "./damage.js";
import { MAX_SIMULTANEOUS_ATTACKERS } from "./enemyCoordination.js";
import { ENEMY_TYPES, enemyWeightsForDepth } from "./enemyTypes.js";
import {
  COMBO_WINDOW_MS,
  MELEE_ATTACKS,
  PLAYER_HURT_INVULNERABLE_MS,
  SKILL_COOLDOWN_MS,
} from "./player.js";

const PROJECTILE_CAST_INTERVAL_MS = 900;
const CIRCULAR_SLASH_DAMAGE = 28;
const ENEMY_ATTACK_ACTIVE_MS = 90;
const ENEMY_ATTACK_COOLDOWN_MS = 920;
// 同一时刻能发起攻击的敌人数量由错峰调度封顶，压力模型直接引用同一个常量，
// 避免「调度改了但平衡估算没跟着改」的偏差。
const ROOM_ACTIVE_ATTACKER_CAP = MAX_SIMULTANEOUS_ATTACKERS;
// 普攻取消击退后，敌人受击硬直一结束就重新贴身，实际接触率高于纯走位模型。
const NO_KNOCKBACK_REENGAGE_MULTIPLIER = 1.42;
const EMBARK_MINOR_UPGRADE_COUNT = 1;
const FIRST_FLOOR_ROOM_PRESSURE_MULTIPLIER = 2.55;
const MELEE_ROOM_EXPOSURE_MULTIPLIER = 2.25;
export const COMBAT_ROOM_DAMAGE_SHARE_CAP = 0.52;

export function estimatePlayerDps({ classId, build = typicalBuildForDepth(1) }) {
  const stats = playerStatsForBuild({ classId, build });
  const expectedCritMultiplier = 1 + stats.critRate * (stats.critMultiplier - 1);

  if (stats.attackMode === "projectile") {
    return roundBalance((stats.attack * expectedCritMultiplier * 1000) / PROJECTILE_CAST_INTERVAL_MS);
  }

  const comboDamage = MELEE_ATTACKS.reduce(
    (sum, attack) => sum + (attack.damage + stats.attack),
    0,
  );
  const comboDurationSeconds = (COMBO_WINDOW_MS * (MELEE_ATTACKS.length + 1)) / 1000;
  const averageArcCoverage = MELEE_ATTACKS.reduce(
    (sum, attack) => sum + attack.arc / 180,
    0,
  ) / MELEE_ATTACKS.length;
  const comboDps = (comboDamage * expectedCritMultiplier * averageArcCoverage)
    / comboDurationSeconds;
  const slashDps =
    (CIRCULAR_SLASH_DAMAGE * build.damageMultiplier * expectedCritMultiplier * 0.72)
    / (SKILL_COOLDOWN_MS / 1000);

  return roundBalance(comboDps + slashDps);
}

export function estimateEffectiveHp({ classId, build = typicalBuildForDepth(1) }) {
  const stats = playerStatsForBuild({ classId, build });

  // 受击无敌帧会限制连续受击。敌人完成一次伤害结算后最快也要经过攻击
  // 持续段与冷却段才可能再次结算，因此用这两个实际时序折算有效生命。
  const fastestRepeatHitMs = ENEMY_ATTACK_ACTIVE_MS + ENEMY_ATTACK_COOLDOWN_MS;
  const invulnerabilityGate =
    PLAYER_HURT_INVULNERABLE_MS / Math.min(PLAYER_HURT_INVULNERABLE_MS, fastestRepeatHitMs);
  const mitigationMultiplier = defenseDamageMultiplier(stats.defense);

  return roundBalance(stats.maxHp * invulnerabilityGate / (mitigationMultiplier * stats.incomingDamageMultiplier));
}

export function estimateIncomingHitDamage({ classId, build = typicalBuildForDepth(1), attack }) {
  const stats = playerStatsForBuild({ classId, build });
  const result = resolveDamage({
    attack,
    defense: stats.defense,
    damageMultiplier: stats.incomingDamageMultiplier,
    rng: { next: () => 1 },
  });

  return result.damage;
}

export function typicalBuildForDepth(depth) {
  const normalizedDepth = Math.max(1, Math.floor(depth));
  const completedDepths = normalizedDepth - 1;
  const majorUpgradeCount = Math.floor(completedDepths / BOSS_FLOOR_INTERVAL);
  const minorUpgradeCount = EMBARK_MINOR_UPGRADE_COUNT + completedDepths - majorUpgradeCount;
  const minorAverage = averagePoolBonuses(MINOR_UPGRADES);
  const majorAverage = averagePoolBonuses(MAJOR_UPGRADES);
  const damageMultiplier =
    multiplierFor(minorAverage, "damageMultiplier", minorUpgradeCount)
    * multiplierFor(majorAverage, "damageMultiplier", majorUpgradeCount);
  const defenseMultiplier =
    multiplierFor(minorAverage, "defenseMultiplier", minorUpgradeCount)
    * multiplierFor(majorAverage, "defenseMultiplier", majorUpgradeCount);
  const maxHpMultiplier =
    multiplierFor(minorAverage, "maxHpMultiplier", minorUpgradeCount)
    * multiplierFor(majorAverage, "maxHpMultiplier", majorUpgradeCount);
  const incomingDamageMultiplier =
    multiplierFor(minorAverage, "incomingDamageMultiplier", minorUpgradeCount)
    * multiplierFor(majorAverage, "incomingDamageMultiplier", majorUpgradeCount);
  const movementMultiplier =
    multiplierFor(minorAverage, "movementMultiplier", minorUpgradeCount)
    * multiplierFor(majorAverage, "movementMultiplier", majorUpgradeCount);
  const staminaRegenMultiplier =
    multiplierFor(minorAverage, "staminaRegenMultiplier", minorUpgradeCount)
    * multiplierFor(majorAverage, "staminaRegenMultiplier", majorUpgradeCount);
  const cooldownMultiplier =
    multiplierFor(minorAverage, "cooldownMultiplier", minorUpgradeCount)
    * multiplierFor(majorAverage, "cooldownMultiplier", majorUpgradeCount);
  const critRateBonus =
    bonusFor(minorAverage, "critRateBonus", minorUpgradeCount)
    + bonusFor(majorAverage, "critRateBonus", majorUpgradeCount);
  const effectiveHpMultiplier = roundBalance(
    (maxHpMultiplier * Math.sqrt(defenseMultiplier)) / incomingDamageMultiplier,
  );
  const effectiveUpgradeScore = roundBalance(
    damageMultiplier * effectiveHpMultiplier * (1 + critRateBonus),
  );

  return Object.freeze({
    minorUpgradeCount,
    majorUpgradeCount,
    damageMultiplier: roundBalance(damageMultiplier),
    defenseMultiplier: roundBalance(defenseMultiplier),
    maxHpMultiplier: roundBalance(maxHpMultiplier),
    incomingDamageMultiplier: roundBalance(incomingDamageMultiplier),
    movementMultiplier: roundBalance(movementMultiplier),
    staminaRegenMultiplier: roundBalance(staminaRegenMultiplier),
    cooldownMultiplier: roundBalance(cooldownMultiplier),
    critRateBonus: roundBalance(critRateBonus),
    effectiveHpMultiplier,
    effectiveUpgradeScore,
  });
}

export function combatRoomDamageShare({ depth, classId, build = typicalBuildForDepth(depth) }) {
  const effectiveHp = estimateEffectiveHp({ classId, build });
  const totalEnemyHp = estimateCombatRoomEnemyHp(depth, classId);
  const durationSeconds = totalEnemyHp / estimatePlayerDps({ classId, build });
  const difficulty = difficultyForDepth(depth);
  const weightedAttack = weightedEnemyStat(depth, "attack") * difficulty.enemyDamageScale;
  const weightedCycleMs = weightedEnemyAttackCycleMs(depth);
  const connectionRate = Math.min(
    1,
    weightedEnemyConnectionRate(depth)
    * NO_KNOCKBACK_REENGAGE_MULTIPLIER
    * avoidanceMultiplier(build),
  );
  const enemyCount = enemyCountForDepth(depth);
  const activeAttackers = Math.min(enemyCount, ROOM_ACTIVE_ATTACKER_CAP);
  const pressureIntervalSeconds = Math.max(
    PLAYER_HURT_INVULNERABLE_MS / 1000,
    weightedCycleMs / activeAttackers / 1000,
  );
  const expectedAppliedHits = (durationSeconds / pressureIntervalSeconds) * connectionRate;
  const rawDamagePressure =
    expectedAppliedHits
    * weightedAttack
    * roomPressureMultiplier(depth)
    * classExposureMultiplier(classId);

  return roundBalance(rawDamagePressure / effectiveHp);
}

function roomPressureMultiplier(depth) {
  return Math.max(1, Math.floor(depth)) === 1 ? FIRST_FLOOR_ROOM_PRESSURE_MULTIPLIER : 1;
}

function classExposureMultiplier(classId) {
  return classId === "knight" ? MELEE_ROOM_EXPOSURE_MULTIPLIER : 1;
}

function avoidanceMultiplier(build) {
  const cooldownThroughput = 1 / Math.max(0.2, build.cooldownMultiplier);
  const avoidance =
    build.movementMultiplier
    * Math.sqrt(build.staminaRegenMultiplier)
    * Math.sqrt(cooldownThroughput);

  return 1 / Math.max(1, avoidance);
}

function playerStatsForBuild({ classId, build }) {
  const playerClass = PLAYER_CLASSES[classId];
  if (!playerClass) {
    throw new RangeError(`未知职业: ${classId}`);
  }

  const baseStats = playerClass.baseStats;
  return {
    classId,
    attackMode: playerClass.attackMode,
    maxHp: baseStats.maxHp * build.maxHpMultiplier,
    attack: baseStats.attack * build.damageMultiplier,
    defense: baseStats.defense * build.defenseMultiplier,
    critRate: clamp01(baseStats.critRate + build.critRateBonus),
    critMultiplier: baseStats.critMultiplier,
    incomingDamageMultiplier: build.incomingDamageMultiplier,
  };
}

function estimateCombatRoomEnemyHp(depth, classId) {
  const count = enemyCountForDepth(depth);
  const weightedHp = weightedEnemyStat(depth, "baseHp");
  const difficulty = difficultyForDepth(depth);
  const classCleavingMultiplier = classId === "knight" ? 1.22 : 1;

  return (weightedHp * difficulty.enemyHpScale * count) / classCleavingMultiplier;
}

function weightedEnemyStat(depth, key) {
  const weights = enemyWeightsForDepth(depth);
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);

  return entries.reduce((sum, [enemyId, weight]) => {
    const value = ENEMY_TYPES[enemyId][key];
    return sum + value * (weight / totalWeight);
  }, 0);
}

function weightedEnemyAttackCycleMs(depth) {
  const weights = enemyWeightsForDepth(depth);
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);

  return entries.reduce((sum, [enemyId, weight]) => {
    const enemyType = ENEMY_TYPES[enemyId];
    const cycleMs = enemyType.attackWindupMs + ENEMY_ATTACK_ACTIVE_MS + ENEMY_ATTACK_COOLDOWN_MS;
    return sum + cycleMs * (weight / totalWeight);
  }, 0);
}

function weightedEnemyConnectionRate(depth) {
  const weights = enemyWeightsForDepth(depth);
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);

  return entries.reduce((sum, [enemyId, weight]) => {
    const enemyType = ENEMY_TYPES[enemyId];
    const escapeDistance =
      74 * ((enemyType.attackWindupMs + PLAYER_HURT_INVULNERABLE_MS) / 1000);
    const connectionRate = enemyType.attackRange / (enemyType.attackRange + escapeDistance);
    return sum + connectionRate * (weight / totalWeight);
  }, 0);
}

export function enemyCountForDepth(depth) {
  return Math.min(6, 4 + Math.floor((depth - 1) / 7));
}

function averagePoolBonuses(pool) {
  const average = {};
  for (const key of collectBonusKeys(pool)) {
    const neutral = key.endsWith("Bonus") ? 0 : 1;
    const total = pool.reduce(
      (sum, upgrade) => sum + (upgrade.bonuses[key] ?? neutral),
      0,
    );
    average[key] = total / pool.length;
  }

  return average;
}

function collectBonusKeys(pool) {
  return [...new Set(pool.flatMap((upgrade) => Object.keys(upgrade.bonuses)))];
}

function multiplierFor(average, key, count) {
  return (average[key] ?? 1) ** count;
}

function bonusFor(average, key, count) {
  return (average[key] ?? 0) * count;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function roundBalance(value) {
  return Math.round(value * 1000) / 1000;
}
