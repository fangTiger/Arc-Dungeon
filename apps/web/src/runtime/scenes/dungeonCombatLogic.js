import { enemyCountForDepth } from "../../core/combat/balance.js";
import { canMoveToDungeonRoom } from "../../core/dungeon/roomMap.js";
import { collectDoorPathTiles } from "../../core/dungeon/roomContentPlacement.js";

export { enemyCountForDepth };

export const ENEMY_RADIUS = 7;

export function collectWalkableTiles(roomMap) {
  const tiles = [];

  for (let tileY = 0; tileY < roomMap.height; tileY += 1) {
    for (let tileX = 0; tileX < roomMap.width; tileX += 1) {
      const x = tileX * roomMap.tileSize + roomMap.tileSize / 2;
      const y = tileY * roomMap.tileSize + roomMap.tileSize / 2;
      if (canMoveToDungeonRoom(roomMap, x, y, ENEMY_RADIUS)) {
        tiles.push({ tileX, tileY });
      }
    }
  }

  return tiles;
}

export function collectDoorTiles(roomMap) {
  return collectDoorPathTiles({
    doors: roomMap.room.doors,
    extendToCenter: false,
    width: roomMap.width,
    height: roomMap.height,
  });
}

export function patrolTarget(enemy, now) {
  const seconds = now / 1000;
  return {
    x: enemy.spawnX + Math.cos(seconds * 0.8 + enemy.patrolPhase) * 18,
    y: enemy.spawnY + Math.sin(seconds * 0.65 + enemy.patrolPhase) * 14,
  };
}

export function isEnemyInsideMelee(player, enemy, attack) {
  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  const distance = Math.hypot(dx, dy);

  if (distance > attack.range + enemy.radius) {
    return false;
  }

  return angleBetween(player.facing, normalize(dx, dy)) <= (attack.arc * Math.PI) / 360;
}

export function moveEntityInRoom(roomMap, entity, dx, dy) {
  const moved = { ...entity };

  if (canMoveToDungeonRoom(roomMap, moved.x + dx, moved.y, moved.radius)) {
    moved.x += dx;
  }

  if (canMoveToDungeonRoom(roomMap, moved.x, moved.y + dy, moved.radius)) {
    moved.y += dy;
  }

  if (moved.x === entity.x && moved.y === entity.y && Math.abs(dx) + Math.abs(dy) > 0) {
    const slideX = -Math.sign(dy) * Math.min(1.2, Math.abs(dy));
    const slideY = Math.sign(dx) * Math.min(1.2, Math.abs(dx));
    if (canMoveToDungeonRoom(roomMap, moved.x + slideX, moved.y + slideY, moved.radius)) {
      moved.x += slideX;
      moved.y += slideY;
    }
  }

  if (moved.x !== entity.x) {
    moved.facingX = moved.x < entity.x ? -1 : 1;
  }

  return moved;
}

export function applyEntityKnockbackInRoom(roomMap, entity, dt) {
  const vx = entity.knockbackX ?? 0;
  const vy = entity.knockbackY ?? 0;

  if (Math.abs(vx) + Math.abs(vy) < 1) {
    return {
      ...entity,
      knockbackX: 0,
      knockbackY: 0,
    };
  }

  const moved = moveEntityInRoom(roomMap, entity, vx * dt, vy * dt);
  const decay = Math.exp(-dt * 12);

  return {
    ...moved,
    knockbackX: vx * decay,
    knockbackY: vy * decay,
  };
}

export function knockbackVector(target, source, force) {
  const direction = normalize(target.x - source.x, target.y - source.y);
  return { x: direction.x * force, y: direction.y * force };
}

export function normalize(x, y) {
  const length = Math.hypot(x, y);
  if (length === 0) {
    return { x: 0, y: 1 };
  }

  return { x: x / length, y: y / length };
}

export function isAlive(enemy) {
  return enemy.hp > 0 && enemy.state !== "dead";
}

function angleBetween(left, right) {
  const dot = left.x * right.x + left.y * right.y;
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}
