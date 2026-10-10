/**
 * 敌人协同纯逻辑。
 *
 * 取消普攻击退后敌人可以持续贴身，如果继续让它们各自直线冲向玩家，
 * 会变成「全部叠在一个点上同时前摇」——既容易被一次躲完，又会穿模。
 * 本模块提供三件事：环形包围方位分配、同时攻击名额分配、交战距离约束。
 * 全部为纯函数，时间由调用方注入，不依赖 DOM 与随机。
 */

import { ENEMY_STATES } from "./enemy.js";

/** 同一时刻最多允许发起攻击的敌人数量 */
export const MAX_SIMULTANEOUS_ATTACKERS = 2;

/** 相邻包围站位之间的最小间距（像素） */
export const SURROUND_MIN_SEPARATION = 18;

/** 贴身压迫时敌人与玩家中心保持的最小距离（像素） */
export const PRESSURE_KEEP_DISTANCE = 13;

/** 交战距离相对自身攻击距离的占比，留出一点余量避免贴到穿模 */
export const ENGAGE_RANGE_RATIO = 0.78;

/** 交战距离上限，防止远程敌人站得太远变成无威胁的骚扰 */
export const MAX_ENGAGE_DISTANCE = 96;

/** 正在占用攻击名额的状态 */
const ATTACKING_STATES = Object.freeze([
  ENEMY_STATES.WINDUP,
  ENEMY_STATES.ATTACK,
  ENEMY_STATES.COOLDOWN,
]);

/**
 * 为一组追击同一目标的敌人分配互不重合的环绕方位。
 *
 * 以各敌人当前相对目标的角度升序排序，再把它们均匀铺到一个整圆上，
 * 基准角取排序后第一个敌人的当前角度，因此结果确定且不产生突然的换位。
 */
export function assignSurroundAngles({ enemies, target }) {
  const list = Array.isArray(enemies) ? enemies.filter(Boolean) : [];

  if (list.length === 0) {
    return [];
  }

  const sorted = list
    .map((enemy, index) => ({
      enemy,
      index,
      angle: angleFromTarget(enemy, target),
    }))
    .sort((left, right) => left.angle - right.angle || left.index - right.index);
  const step = (Math.PI * 2) / sorted.length;
  const baseAngle = sorted[0].angle;

  return sorted.map((entry, slotIndex) => ({
    id: entry.enemy.id,
    slotIndex,
    slotCount: sorted.length,
    angle: normalizeAngle(baseAngle + slotIndex * step),
  }));
}

/**
 * 给定包围数量下，保证相邻站位间距不小于 minSeparation 的最小环半径。
 */
export function minSurroundRadius(slotCount, minSeparation = SURROUND_MIN_SEPARATION) {
  const count = Math.max(1, Math.floor(slotCount));

  if (count < 2) {
    return 0;
  }

  return minSeparation / (2 * Math.sin(Math.PI / count));
}

/**
 * 敌人希望停留的交战距离：靠自身攻击距离决定，并受最小压迫距离约束。
 */
export function engageDistanceFor(enemy) {
  const attackRange = Number.isFinite(enemy?.attackRange) ? enemy.attackRange : 0;
  const radius = Number.isFinite(enemy?.radius) ? enemy.radius : 0;
  const desired = Math.min(attackRange * ENGAGE_RANGE_RATIO, MAX_ENGAGE_DISTANCE);

  return Math.max(PRESSURE_KEEP_DISTANCE + radius, desired);
}

/**
 * 解析每个敌人的包围目标点。返回的坐标为浮点，由 runtime 决定取整时机。
 */
export function resolveSurroundTargets({
  enemies,
  target,
  minSeparation = SURROUND_MIN_SEPARATION,
}) {
  const assignments = assignSurroundAngles({ enemies, target });
  const byId = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const ringFloor = minSurroundRadius(assignments.length, minSeparation);

  return enemies.filter(Boolean).map((enemy) => {
    const assignment = byId.get(enemy.id);
    const angle = assignment ? assignment.angle : angleFromTarget(enemy, target);
    const radius = Math.max(ringFloor, engageDistanceFor(enemy));

    return {
      id: enemy.id,
      angle,
      radius,
      slotIndex: assignment ? assignment.slotIndex : 0,
      x: target.x + Math.cos(angle) * radius,
      y: target.y + Math.sin(angle) * radius,
    };
  });
}

/**
 * 分配同一时刻的攻击名额。
 *
 * 已经在前摇/攻击/冷却中的敌人优先占位（否则会出现攻击被中途剥夺的怪异表现），
 * 剩余名额发给已经进入攻击距离、且等待时间最长的敌人。
 */
export function selectAttackTokens({
  enemies,
  target,
  maxAttackers = MAX_SIMULTANEOUS_ATTACKERS,
}) {
  const list = Array.isArray(enemies) ? enemies.filter(isEngageable) : [];
  const cap = Math.max(0, Math.floor(maxAttackers));
  const holders = list.filter((enemy) => ATTACKING_STATES.includes(enemy.state));
  const permitted = new Set(holders.slice(0, cap).map((enemy) => enemy.id));
  const contenders = list
    .filter((enemy) => !permitted.has(enemy.id) && withinAttackRange(enemy, target))
    .map((enemy, index) => ({ enemy, index }))
    .sort((left, right) =>
      (left.enemy.stateSince ?? 0) - (right.enemy.stateSince ?? 0) || left.index - right.index);

  for (const { enemy } of contenders) {
    if (permitted.size >= cap) {
      break;
    }

    permitted.add(enemy.id);
  }

  return {
    permittedIds: permitted,
    waitingIds: new Set(
      list.filter((enemy) => !permitted.has(enemy.id)).map((enemy) => enemy.id),
    ),
  };
}

/**
 * 计算这一帧的靠近步长：已经进入交战距离就不再压近，避免挤进玩家身体。
 */
export function resolveApproachStep({ enemy, targetPoint, target, speed, dt }) {
  const distanceToTarget = distanceBetween(enemy, target);
  const keepDistance = PRESSURE_KEEP_DISTANCE + (enemy?.radius ?? 0);
  const dx = targetPoint.x - enemy.x;
  const dy = targetPoint.y - enemy.y;
  const length = Math.hypot(dx, dy);
  const stride = Math.max(0, speed) * Math.max(0, dt);

  if (length <= 0.5 || stride <= 0) {
    return { dx: 0, dy: 0 };
  }

  const step = Math.min(stride, length);
  const unitX = dx / length;
  const unitY = dy / length;

  // 已经比最小压迫距离更近，且这一步还在继续拉近 -> 只允许沿切线滑动
  if (distanceToTarget <= keepDistance && closesDistance(enemy, target, unitX, unitY)) {
    return { dx: -unitY * step * 0.6, dy: unitX * step * 0.6 };
  }

  return { dx: unitX * step, dy: unitY * step };
}

function closesDistance(enemy, target, unitX, unitY) {
  const awayX = enemy.x - target.x;
  const awayY = enemy.y - target.y;

  return unitX * awayX + unitY * awayY < 0;
}

function isEngageable(enemy) {
  return Boolean(enemy)
    && enemy.hp > 0
    && enemy.state !== ENEMY_STATES.DEAD
    && enemy.state !== ENEMY_STATES.PATROL;
}

function withinAttackRange(enemy, target) {
  const range = Number.isFinite(enemy?.attackRange) ? enemy.attackRange : 0;
  return distanceBetween(enemy, target) <= range + (target?.radius ?? 0);
}

function distanceBetween(enemy, target) {
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
    return Infinity;
  }

  return Math.hypot((enemy?.x ?? 0) - target.x, (enemy?.y ?? 0) - target.y);
}

function angleFromTarget(enemy, target) {
  const dx = (enemy?.x ?? 0) - (target?.x ?? 0);
  const dy = (enemy?.y ?? 0) - (target?.y ?? 0);

  if (dx === 0 && dy === 0) {
    return 0;
  }

  return normalizeAngle(Math.atan2(dy, dx));
}

function normalizeAngle(angle) {
  const twoPi = Math.PI * 2;
  return ((angle % twoPi) + twoPi) % twoPi;
}
