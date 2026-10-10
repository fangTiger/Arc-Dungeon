export function createProjectile({
  x,
  y,
  dirX,
  dirY,
  speed,
  damage,
  maxLifeMs,
  radius,
}) {
  const direction = normalizeDirection({ x: dirX, y: dirY });

  return {
    x,
    y,
    dirX: direction.x,
    dirY: direction.y,
    speed,
    damage,
    maxLifeMs,
    radius,
    ageMs: 0,
    hitTargetIds: [],
  };
}

export function stepProjectile(projectile, dtMs) {
  const seconds = dtMs / 1000;

  return {
    ...projectile,
    x: projectile.x + projectile.dirX * projectile.speed * seconds,
    y: projectile.y + projectile.dirY * projectile.speed * seconds,
    ageMs: projectile.ageMs + dtMs,
  };
}

export function isExpired(projectile) {
  return projectile.ageMs >= projectile.maxLifeMs;
}

export function hitsCircle(projectile, target) {
  if (hasHitTarget(projectile, target)) {
    return false;
  }

  const distance = Math.hypot(projectile.x - target.x, projectile.y - target.y);

  return distance <= projectile.radius + target.radius;
}

export function markProjectileHit(projectile, target) {
  const targetId = targetIdentifier(target);

  if (projectile.hitTargetIds.includes(targetId)) {
    return projectile;
  }

  return {
    ...projectile,
    hitTargetIds: [...projectile.hitTargetIds, targetId],
  };
}

export function hasHitTarget(projectile, target) {
  return projectile.hitTargetIds.includes(targetIdentifier(target));
}

function normalizeDirection(direction) {
  const length = Math.hypot(direction.x, direction.y);

  if (length === 0) {
    throw new RangeError("投射物方向不能为零向量");
  }

  return {
    x: direction.x / length,
    y: direction.y / length,
  };
}

function targetIdentifier(target) {
  if (target.id === undefined || target.id === null) {
    throw new TypeError("投射物命中目标必须提供 id");
  }

  return String(target.id);
}
