import { createProjectile } from "../../core/combat.js";
import { translate } from "../../core/i18n/index.js";
import { moveEntityInRoom } from "./dungeonCombatLogic.js";

export const SKILL_KEYS = Object.freeze(["U", "I", "O", "P"]);
export const SKILL_COLORS = Object.freeze({
  areaDamage: "#ffe083",
  dashStrike: "#ff9f5d",
  guardCounter: "#8bd3ff",
  selfBuff: "#ffd15c",
  projectileExplosion: "#ff7a4d",
  slowArea: "#78d8ff",
  blink: "#bda2ff",
  attackOverrideBuff: "#d48cff",
});
export const SKILL_GLYPHS = Object.freeze({
  areaDamage: translate("skill.knight-circular-slash.glyph"),
  dashStrike: translate("skill.knight-charge.glyph"),
  guardCounter: translate("skill.knight-shield-bash.glyph"),
  selfBuff: translate("skill.knight-war-cry.glyph"),
  projectileExplosion: translate("skill.wizzard-fireball.glyph"),
  slowArea: translate("skill.wizzard-ice-ring.glyph"),
  blink: translate("skill.wizzard-blink.glyph"),
  attackOverrideBuff: translate("skill.wizzard-arcane-surge.glyph"),
});

export function colorFor(skill) {
  return SKILL_COLORS[skill.effect.kind] ?? "#f7efd0";
}

export function createFanProjectile(projectile, angleOffset, damage) {
  const angle = Math.atan2(projectile.dirY, projectile.dirX) + angleOffset;

  return createProjectile({
    x: Math.round(projectile.x),
    y: Math.round(projectile.y),
    dirX: Math.cos(angle),
    dirY: Math.sin(angle),
    speed: projectile.speed,
    damage,
    maxLifeMs: projectile.maxLifeMs,
    radius: projectile.radius,
  });
}

export function movePlayerAlong({ player, roomMap, direction, distance }) {
  const movement = nonZeroDirection(direction);
  let remaining = Math.max(0, Math.round(distance));

  while (remaining > 0) {
    const step = Math.min(12, remaining);
    const moved = moveEntityInRoom(
      roomMap,
      player,
      Math.round(movement.x * step),
      Math.round(movement.y * step),
    );
    Object.assign(player, pixelAligned(moved));
    remaining -= step;
  }
}

export function nonZeroDirection(direction) {
  const x = direction?.x ?? 0;
  const y = direction?.y ?? 0;
  const length = Math.hypot(x, y);

  if (length === 0) {
    return { x: 0, y: 1 };
  }

  return { x: x / length, y: y / length };
}

export function pixelAligned(entity) {
  return {
    ...entity,
    x: Math.round(entity.x),
    y: Math.round(entity.y),
  };
}

export function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  const x = start.x + dx * t;
  const y = start.y + dy * t;

  return Math.hypot(point.x - x, point.y - y);
}
