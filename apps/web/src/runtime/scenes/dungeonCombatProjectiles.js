import {
  hitsCircle, isExpired, markProjectileHit, stepProjectile,
} from "../../core/combat.js";
import { canMoveToDungeonRoom } from "../../core/dungeon/roomMap.js";
import { isAlive } from "./dungeonCombatLogic.js";

const TRAIL_INTERVAL_MS = 34;
const DEFAULT_TRAIL_COLOR = "#ff9f5d";

/**
 * 投射物推进：移动、撞墙/超时销毁、命中结算、爆炸范围伤害与拖尾特效。
 * 技能投射物在飞行途中持续留下火点，命中时交给 `spawnFireballBurst` 生成爆炸与光源。
 */
export function createProjectileRunner({ getRoomMap, getEnemies, hitEnemy, vfx, onSkillHit }) {
  let lastTrailAt = -Infinity;

  function reset() {
    lastTrailAt = -Infinity;
  }

  function update(projectiles, dtMs, now) {
    const nextProjectiles = [];
    const enemies = getEnemies();

    for (const projectile of projectiles) {
      let moved = stepProjectile(projectile, dtMs);

      if (isExpired(moved) || !canMoveToDungeonRoom(getRoomMap(), moved.x, moved.y, moved.radius)) {
        continue;
      }

      const target = enemies.find((enemy) => isAlive(enemy) && hitsCircle(moved, enemy));

      if (target) {
        moved = markProjectileHit(moved, target);
        hitEnemy(target, moved.damage, moved.knockback ?? 0, now, {
          source: moved.skillId ? "skill" : "basic",
        });

        if (moved.skillId) {
          onSkillHit(now);
        }

        explode(moved, target, enemies, now);
        continue;
      }

      emitTrail(moved, now);
      nextProjectiles.push(moved);
    }

    return nextProjectiles;
  }

  function emitTrail(projectile, now) {
    if (!projectile.skillId || now - lastTrailAt < TRAIL_INTERVAL_MS) {
      return;
    }

    vfx.spawnProjectileTrail({
      x: projectile.x,
      y: projectile.y,
      color: projectile.skillColor ?? DEFAULT_TRAIL_COLOR,
    });
    lastTrailAt = now;
  }

  function explode(projectile, primaryTarget, enemies, now) {
    if (!projectile.explosionRadius) {
      return;
    }

    vfx.spawnFireballBurst({
      x: projectile.x,
      y: projectile.y,
      radius: projectile.explosionRadius,
      color: projectile.skillColor,
    });

    for (const enemy of enemies) {
      if (!isAlive(enemy) || enemy === primaryTarget) continue;

      const distance = Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y);
      if (distance <= projectile.explosionRadius + enemy.radius) {
        hitEnemy(enemy, projectile.damage, projectile.knockback ?? 0, now, { source: "skill" });
      }
    }
  }

  return { reset, update };
}
