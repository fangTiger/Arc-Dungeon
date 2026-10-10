import {
  ENEMY_STATES,
  nextEnemyState,
  resolveApproachStep,
  resolveSurroundTargets,
  selectAttackTokens,
} from "../../core/combat.js";
import {
  applyEntityKnockbackInRoom,
  isAlive,
  moveEntityInRoom,
  patrolTarget,
} from "./dungeonCombatLogic.js";

/** 会主动向玩家移动的状态：等待态也要继续绕位，否则会站桩挨打 */
const APPROACHING_STATES = Object.freeze([ENEMY_STATES.CHASE, ENEMY_STATES.WAIT]);

/**
 * 敌人 AI 驱动层：把 core 的包围/错峰纯逻辑接到实际移动与状态推进上。
 * 只做接线与位移，规则本身都在 `core/combat/enemyCoordination.js` 里。
 */
export function createDungeonEnemyAi({ player, getRoomMap, performEnemyAttack }) {
  function update(enemies, dt, now) {
    const engaging = enemies.filter(
      (enemy) => isAlive(enemy) && APPROACHING_STATES.includes(enemy.state),
    );
    const tokens = selectAttackTokens({ enemies: enemies.filter(isAlive), target: player });
    const surroundTargets = new Map(
      resolveSurroundTargets({ enemies: engaging, target: player })
        .map((slot) => [slot.id, slot]),
    );

    for (let index = 0; index < enemies.length; index += 1) {
      let enemy = applyEntityKnockbackInRoom(getRoomMap(), enemies[index], dt);
      const previousState = enemy.state;

      enemy = nextEnemyState(enemy, {
        player,
        now,
        attackPermitted: tokens.permittedIds.has(enemy.id),
      });

      if (enemy.state === ENEMY_STATES.ATTACK && previousState === ENEMY_STATES.WINDUP) {
        performEnemyAttack(enemy, now);
      }

      if (enemy.state === ENEMY_STATES.PATROL) {
        enemy = movePatrolling(enemy, dt, now);
      } else if (APPROACHING_STATES.includes(enemy.state)) {
        enemy = moveTowardSurroundSlot(enemy, surroundTargets.get(enemy.id), dt, now);
      }

      enemies[index] = enemy;
    }
  }

  function movePatrolling(enemy, dt, now) {
    const target = patrolTarget(enemy, now);
    const step = resolveApproachStep({
      enemy,
      targetPoint: target,
      target,
      speed: enemy.speed * 0.34 * slowFactor(enemy, now),
      dt,
    });

    return moveEntityInRoom(getRoomMap(), enemy, step.dx, step.dy);
  }

  function moveTowardSurroundSlot(enemy, slot, dt, now) {
    const targetPoint = slot ?? { x: player.x, y: player.y };
    const step = resolveApproachStep({
      enemy,
      targetPoint,
      target: player,
      speed: enemy.speed * slowFactor(enemy, now),
      dt,
    });
    const moved = moveEntityInRoom(getRoomMap(), enemy, step.dx, step.dy);

    // 站位可能在玩家背后，但敌人始终要朝向玩家，否则包围看起来像背对着挨打
    return { ...moved, facingX: player.x < moved.x ? -1 : 1 };
  }

  function slowFactor(enemy, now) {
    return now < (enemy.slowUntil ?? 0) ? enemy.slowMultiplier ?? 1 : 1;
  }

  return { update };
}
