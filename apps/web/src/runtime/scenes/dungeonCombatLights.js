const PROJECTILE_LIGHT = Object.freeze({ radius: 34, color: "#7ce8ff", intensity: 0.78 });
const ENEMY_LIGHTING = Object.freeze({
  normal: Object.freeze({ radius: 30, color: "#ff5a36", intensity: 0.44 }),
  boss: Object.freeze({ radius: 54, color: "#ff6a32", intensity: 0.66 }),
});
const POTION_LIGHT = Object.freeze({ radius: 18, color: "#ff5a4a", intensity: 0.34 });

export function combatDynamicLights({ projectiles, enemies, pickups, isAlive }) {
  const projectileLights = projectiles.map((projectile) => ({
    x: projectile.x,
    y: projectile.y,
    radius: projectile.lightRadius ?? PROJECTILE_LIGHT.radius,
    color: projectile.skillColor ?? PROJECTILE_LIGHT.color,
    intensity: projectile.lightIntensity ?? PROJECTILE_LIGHT.intensity,
  }));
  const enemyLights = enemies.filter(isAlive).map(enemyLightFor);
  const pickupLights = pickups.map((pickup) => ({
    x: pickup.x,
    y: pickup.y,
    ...POTION_LIGHT,
  }));

  return {
    projectileLights,
    enemyLights,
    dynamicLights: [...projectileLights, ...enemyLights, ...pickupLights],
  };
}

function enemyLightFor(enemy) {
  const tuning = enemy.isBoss ? ENEMY_LIGHTING.boss : ENEMY_LIGHTING.normal;

  return {
    x: enemy.x,
    y: enemy.y - 5,
    ...tuning,
  };
}
