import { createRng, hashSeed } from "../rng.js";
import {
  rollBossTokenDrop,
  rollEnemyTokenDrop,
} from "./runBag.js";

export function applyTicketDifficultyToEnemy(enemy, run) {
  const multiplier = normalizeMultiplier(run?.ticketInvestment?.difficultyMultiplier);

  if (multiplier === 1) {
    return enemy;
  }

  const maxHp = scaleStat(enemy.maxHp, multiplier);
  const attack = scaleStat(enemy.attack, multiplier);

  return {
    ...enemy,
    hp: maxHp,
    maxHp,
    damage: attack,
    attack,
  };
}

export function addCombatTokenDropsToRun({ run, roomId, enemies }) {
  let totalDrop = 0;
  let killIndex = 0;

  for (const enemy of enemies) {
    if (enemy.hp > 0 || enemy.state !== "dead") {
      continue;
    }

    totalDrop += rollEnemyLootDrop({ run, roomId, enemy, killIndex });
    killIndex += 1;
  }

  return {
    run,
    totalDrop,
  };
}

export function addBossTokenDropToRun({ run, roomId }) {
  return {
    run,
    totalDrop: rollBossLootDrop({ run, roomId }),
  };
}

export function rollEnemyLootDrop({ run, roomId, enemy, killIndex = 0 }) {
  if (enemy?.hp > 0 || enemy?.state !== "dead") {
    return 0;
  }

  const rng = createRng(hashSeed(`${run.seed}:depth:${run.depth}:room:${roomId}:tokens`));
  const targetIndex = normalizeKillIndex(killIndex);
  let drop = 0;

  for (let index = 0; index <= targetIndex; index += 1) {
    drop = rollEnemyTokenDrop({
      rng,
      depth: run.depth,
      lootMultiplier: runLootMultiplier(run),
    });
  }

  return drop;
}

export function rollBossLootDrop({ run, roomId }) {
  return rollBossTokenDrop({
    rng: createRng(hashSeed(`${run.seed}:depth:${run.depth}:room:${roomId}:boss-tokens`)),
    depth: run.depth,
    lootMultiplier: runLootMultiplier(run),
  });
}

function runLootMultiplier(run) {
  return normalizeMultiplier(run?.ticketInvestment?.lootMultiplier)
    * normalizeMultiplier(run?.build?.bonuses?.lootMultiplier);
}

function normalizeMultiplier(value) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(0, value);
}

function scaleStat(value, multiplier) {
  return Math.max(1, Math.floor(value * multiplier));
}

function normalizeKillIndex(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}
