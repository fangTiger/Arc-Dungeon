import { createRng, hashSeed } from "../../core/rng.js";
import {
  BIG_DROP_THRESHOLD,
  createLootDrop,
  lootHopOffset,
  stepLootDrops,
} from "../../core/run/lootDrops.js";
import { addTokensToRunBag } from "../../core/run/runBag.js";
import { roomKey } from "./dungeonCombatPickups.js";

const LOOT_TEXT_COLOR = "#f4c95d";
const LOOT_LIGHT_COLOR = "#f4c95d";
const LOOT_COIN_FPS = 8;

export function createDungeonLootDrops({ player, getRun, getRoomMap, updateRun, feedback }) {
  let drops = [];
  const dropsByRoomKey = new Map();
  const scatterRngByRoomKey = new Map();
  const dropSequenceByRoomKey = new Map();
  const enemyKillIndexByRoomKey = new Map();
  const forceCollectRoomKeys = new Set();

  function enterCurrentRoom() {
    const key = currentRoomKey();
    clearOtherRooms(key);
    drops = dropsByRoomKey.get(key) ?? [];
  }

  function nextEnemyKillIndex() {
    const key = currentRoomKey();
    const index = enemyKillIndexByRoomKey.get(key) ?? 0;
    enemyKillIndexByRoomKey.set(key, index + 1);
    return index;
  }

  function spawnTokenDrop({ source, amount, now }) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return null;
    }

    const key = currentRoomKey();
    const drop = createLootDrop({
      id: `${key}:token:${nextDropSequence(key)}`,
      x: source?.x,
      y: source?.y,
      amount,
      now,
      rng: scatterRngForRoom(key),
    });
    drops = [...drops, drop];
    dropsByRoomKey.set(key, drops);
    return drop;
  }

  function update(now, dtMs, { roomLocked = false } = {}) {
    if (drops.length === 0) {
      return;
    }

    const key = currentRoomKey();
    const result = stepLootDrops({
      drops,
      player,
      now,
      dtMs,
      forceCollect: forceCollectRoomKeys.has(key),
      // 战斗未结束时玩家没有安全窗口去捡，此时不能让掉落物过期
      pauseExpiry: roomLocked,
    });
    drops = result.drops;
    dropsByRoomKey.set(key, drops);

    if (drops.length === 0) {
      forceCollectRoomKeys.delete(key);
    }

    if (result.collected.length > 0) {
      creditCollectedDrops(result.collected);
    }
  }

  function forceCollectCurrentRoom() {
    const key = currentRoomKey();
    if (drops.length > 0) {
      forceCollectRoomKeys.add(key);
    }
  }

  function getSnapshot() {
    return {
      drops,
      dynamicLights: drops.map(lootDropLight),
    };
  }

  function creditCollectedDrops(collected) {
    let run = getRun();

    for (const drop of collected) {
      run = { ...run, bag: addTokensToRunBag(run.bag, drop.amount) };
      feedback.addDamageNumber(player.x, player.y - 18, `+${drop.amount}`, {
        color: LOOT_TEXT_COLOR,
      });
    }

    updateRun(run);
  }

  function nextDropSequence(key) {
    const index = dropSequenceByRoomKey.get(key) ?? 0;
    dropSequenceByRoomKey.set(key, index + 1);
    return index;
  }

  function scatterRngForRoom(key) {
    if (!scatterRngByRoomKey.has(key)) {
      const run = getRun();
      const roomId = getRoomMap().id;
      scatterRngByRoomKey.set(
        key,
        createRng(hashSeed(`${run.seed}:depth:${run.depth}:room:${roomId}:loot-scatter`)),
      );
    }

    return scatterRngByRoomKey.get(key);
  }

  function clearOtherRooms(currentKey) {
    for (const key of dropsByRoomKey.keys()) {
      if (key !== currentKey) {
        dropsByRoomKey.delete(key);
        scatterRngByRoomKey.delete(key);
        dropSequenceByRoomKey.delete(key);
        enemyKillIndexByRoomKey.delete(key);
        forceCollectRoomKeys.delete(key);
      }
    }
  }

  function currentRoomKey() {
    return roomKey(getRun(), getRoomMap().id);
  }

  return {
    enterCurrentRoom,
    nextEnemyKillIndex,
    spawnTokenDrop,
    update,
    forceCollectCurrentRoom,
    getSnapshot,
  };
}

export function createLootDropSprite({ drop, elapsedMs, tileset, frames }) {
  const frame = frames?.[lootDropFrameName(drop, elapsedMs)] ?? null;

  if (!frame || !tileset?.image) {
    return null;
  }

  const frameBox = getFrameBox(frame);
  const drawY = drop.y + lootHopOffset(drop, elapsedMs);

  return {
    image: tileset.image,
    frame,
    x: Math.round(drop.x - frameBox.width / 2),
    y: Math.round(drawY - frameBox.height / 2),
    sortY: Math.round(drop.y + frameBox.height / 2),
    castsShadow: true,
    shadowWidth: Math.max(8, Math.min(18, frameBox.width + Math.ceil(drop.amount / 2))),
    shadowColor: "rgba(92, 62, 18, 0.36)",
  };
}

export function lootDropFrameName(drop, elapsedMs) {
  if ((drop?.amount ?? 0) >= BIG_DROP_THRESHOLD) {
    return "chest_full_open_anim_f0";
  }

  const safeElapsedMs = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const frameIndex = Math.floor(safeElapsedMs / (1000 / LOOT_COIN_FPS)) % 4;
  return `coin_anim_f${frameIndex}`;
}

function lootDropLight(drop) {
  const amount = Math.max(0, Math.floor(drop.amount ?? 0));
  return {
    x: drop.x,
    y: drop.y,
    radius: Math.min(42, 18 + Math.ceil(Math.sqrt(amount) * 5)),
    color: LOOT_LIGHT_COLOR,
    intensity: Math.min(0.72, 0.34 + amount / 60),
  };
}

function getFrameBox(frame) {
  return {
    width: frame.sw ?? frame.width,
    height: frame.sh ?? frame.height,
  };
}
