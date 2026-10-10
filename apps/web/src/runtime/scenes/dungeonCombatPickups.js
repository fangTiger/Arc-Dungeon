import {
  healPlayer,
  rollCombatRoomPotionDrop,
} from "../../core/combat.js";
import { canMoveToDungeonRoom } from "../../core/dungeon/roomMap.js";
import { normalize } from "./dungeonCombatLogic.js";

const POTION_PICKUP_DELAY_MS = 650;

export function roomKey(run, roomId) {
  return `${run.depth}:${roomId}`;
}

export function createRoomClearPotionDrop({ run, roomId, enemies, player, roomMap, now }) {
  const drop = rollCombatRoomPotionDrop(run, roomId);

  if (!drop) {
    return null;
  }

  return {
    ...drop,
    ...potionDropPosition({ enemies, player, roomMap }),
    collectibleAt: now + POTION_PICKUP_DELAY_MS,
  };
}

export function collectHealingPickups({ pickups, player, now }) {
  if (player.hp <= 0 || pickups.length === 0) {
    return { pickups, healed: [], changed: false };
  }

  const healed = [];
  const remaining = [];

  for (const pickup of pickups) {
    const distance = Math.hypot(pickup.x - player.x, pickup.y - player.y);

    if (now >= pickup.collectibleAt && distance <= pickup.radius + player.radius) {
      const result = healPlayer(player, pickup.healAmount);

      if (result.healed > 0) {
        Object.assign(player, result.player);
        healed.push(result.healed);
        continue;
      }
    }

    remaining.push(pickup);
  }

  return {
    pickups: remaining,
    healed,
    changed: remaining.length !== pickups.length,
  };
}

function potionDropPosition({ enemies, player, roomMap }) {
  const source = enemies.filter((enemy) => enemy.hp <= 0 || enemy.state === "dead").at(-1) ?? player;
  const awayFromPlayer = normalize(source.x - player.x, source.y - player.y);
  const candidates = [
    { x: source.x + awayFromPlayer.x * 18, y: source.y + awayFromPlayer.y * 18 },
    { x: source.x, y: source.y },
    { x: player.x + awayFromPlayer.x * 24, y: player.y + awayFromPlayer.y * 24 },
  ];

  for (const candidate of candidates) {
    if (canMoveToDungeonRoom(roomMap, candidate.x, candidate.y, 7)) {
      return {
        x: Math.round(candidate.x),
        y: Math.round(candidate.y),
      };
    }
  }

  return { x: Math.round(player.x), y: Math.round(player.y) };
}
