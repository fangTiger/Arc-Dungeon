import { createRng, hashSeed } from "../rng.js";

export const COMBAT_ROOM_POTION_DROP = Object.freeze({
  chance: 0.50,
  largeChance: 0.18,
  small: Object.freeze({
    type: "healing",
    frameName: "flask_red",
    healAmount: 20,
    radius: 7,
  }),
  large: Object.freeze({
    type: "largeHealing",
    frameName: "flask_big_red",
    healAmount: 34,
    radius: 8,
  }),
});

export function shouldSpawnCombatRoom(run, room) {
  return room?.type === "battle" && !isCombatRoomCleared(run, room.id);
}

export function isCombatRoomCleared(run, roomId) {
  return clearedRoomsForDepth(run, run.depth).includes(roomId);
}

export function resolveCombatRoomClear(run, roomId, enemies) {
  if (!Array.isArray(enemies) || enemies.some(isEnemyAlive)) {
    return run;
  }

  return markCombatRoomCleared(run, roomId);
}

export function markCombatRoomCleared(run, roomId) {
  const clearedByDepth = run.clearedCombatRoomIdsByDepth ?? {};
  const currentCleared = clearedRoomsForDepth(run, run.depth);

  if (currentCleared.includes(roomId)) {
    return run;
  }

  return {
    ...run,
    clearedCombatRoomIdsByDepth: {
      ...clearedByDepth,
      [run.depth]: [...currentCleared, roomId],
    },
  };
}

export function rollCombatRoomPotionDrop(run, roomId, rng = potionRng(run, roomId)) {
  if (!rng || typeof rng.next !== "function") {
    throw new TypeError("药水掉落必须传入 rng");
  }

  if (rng.next() >= COMBAT_ROOM_POTION_DROP.chance) {
    return null;
  }

  const template = rng.next() < COMBAT_ROOM_POTION_DROP.largeChance
    ? COMBAT_ROOM_POTION_DROP.large
    : COMBAT_ROOM_POTION_DROP.small;

  return {
    id: `${roomId}:potion`,
    ...template,
  };
}

function clearedRoomsForDepth(run, depth) {
  return run.clearedCombatRoomIdsByDepth?.[depth] ?? [];
}

function isEnemyAlive(enemy) {
  return enemy.hp > 0 && enemy.state !== "dead";
}

function potionRng(run, roomId) {
  return createRng(hashSeed(`${run.seed}:depth:${run.depth}:room:${roomId}:potion`));
}
