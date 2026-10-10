import {
  POISE_BREAK_STUN_MS, PLAYER_HURT_INVULNERABLE_MS, applyPoiseHit, damageEnemy,
  damagePlayer, regeneratePoise, resolveCombatRoomClear, resolveDamage, shouldSpawnCombatRoom,
} from "../../core/combat.js";
import { hashSeed, createRng } from "../../core/rng.js";
import { applyEntityKnockbackInRoom, isAlive, knockbackVector } from "./dungeonCombatLogic.js";
import { createCombatFeedback } from "./dungeonCombatFeedback.js";
import { createDungeonCombatActions } from "./dungeonCombatActions.js";
import { createDungeonEnemyAi } from "./dungeonEnemyAi.js";
import { createProjectileRunner } from "./dungeonCombatProjectiles.js";
import { createSkillVfx } from "./dungeonSkillVfx.js";
import { combatDynamicLights } from "./dungeonCombatLights.js";
import { createDungeonLootDrops } from "./dungeonLootDrops.js";
import { collectHealingPickups, createRoomClearPotionDrop, roomKey } from "./dungeonCombatPickups.js";
import { resolveBossClear, shouldSpawnBossRoom, spawnBossEnemy } from "./dungeonBossCombat.js";
import { spawnCombatEnemies } from "./dungeonEnemySpawns.js";
import {
  applyTicketDifficultyToEnemy,
  rollBossLootDrop,
  rollEnemyLootDrop,
} from "../../core/run/runRewards.js";

export function createDungeonCombat({ player, getRun, getRoomMap, updateRun }) {
  let enemies = [];
  let projectiles = [];
  let pickups = [];
  const pickupsByRoomKey = new Map();
  let lockedRoomId = null;
  let currentTimeMs = 0;
  let rng = createRng(hashSeed(`${getRun().seed}:combat`));
  const feedback = createCombatFeedback();
  const vfx = createSkillVfx({ seed: `${getRun().seed}:vfx` });
  const actions = createDungeonCombatActions({
    player,
    getRun,
    getRoomMap,
    getEnemies: () => enemies,
    addProjectile: (projectile) => { projectiles.push(projectile); },
    hitEnemy,
    feedback,
    vfx,
  });
  const enemyAi = createDungeonEnemyAi({ player, getRoomMap, performEnemyAttack });
  const projectileRunner = createProjectileRunner({
    getRoomMap,
    getEnemies: () => enemies,
    hitEnemy,
    vfx,
    onSkillHit: (now) => actions.registerSkillHit(now),
  });
  const lootDrops = createDungeonLootDrops({ player, getRun, getRoomMap, updateRun, feedback });

  function enterCurrentRoom() {
    const run = getRun();
    const roomMap = getRoomMap();
    projectiles = [];
    feedback.reset();
    projectileRunner.reset();
    vfx.reset(`${run.seed}:depth:${run.depth}:room:${roomMap.id}:vfx`);
    pickups = pickupsByRoomKey.get(roomKey(run, roomMap.id)) ?? [];
    lootDrops.enterCurrentRoom();

    if (shouldSpawnBossRoom(run, roomMap.room)) {
      lockedRoomId = roomMap.id;
      rng = createRng(hashSeed(`${run.seed}:depth:${run.depth}:room:${roomMap.id}:boss`));
      enemies = [applyTicketDifficultyToEnemy(spawnBossEnemy({ roomMap, run, rng }), run)];
      return;
    }

    if (!shouldSpawnCombatRoom(run, roomMap.room)) {
      enemies = [];
      lockedRoomId = null;
      return;
    }

    lockedRoomId = roomMap.id;
    rng = createRng(hashSeed(`${run.seed}:depth:${run.depth}:room:${roomMap.id}:combat`));
    enemies = spawnCombatEnemies({ roomMap, run, player, rng });
  }

  function update(input, dt, elapsedMs) {
    currentTimeMs = elapsedMs;
    const dtMs = dt * 1000;
    feedback.update(dtMs);
    vfx.update(dtMs);
    actions.update(dt, elapsedMs);
    lootDrops.update(elapsedMs, dtMs, { roomLocked: isRoomLocked() });

    if (feedback.tickHitstop(dtMs)) {
      return;
    }

    actions.handleInput(input, elapsedMs);

    Object.assign(player, applyEntityKnockbackInRoom(getRoomMap(), player, dt));
    projectiles = projectileRunner.update(projectiles, dtMs, elapsedMs);
    regenerateEnemyPoise(elapsedMs);
    enemyAi.update(enemies, dt, elapsedMs);
    collectPickups(elapsedMs);
    checkRoomClear(elapsedMs);
  }

  function getSnapshot() {
    const lights = combatDynamicLights({ projectiles, enemies, pickups, isAlive });
    const actionLights = actions.getDynamicLights();
    const lootSnapshot = lootDrops.getSnapshot();
    return {
      enemies,
      projectiles,
      pickups,
      lootDrops: lootSnapshot.drops,
      damageNumbers: feedback.damageNumbers,
      bursts: feedback.bursts,
      skillEffects: vfx.getEffects({ enemies, player, now: currentTimeMs }),
      playerAfterimages: feedback.afterimages,
      skillSlots: actions.getSkillSlots(),
      followUpActive: actions.isFollowUpActive(),
      roomLocked: isRoomLocked(),
      ...lights,
      dynamicLights: [
        ...lights.dynamicLights,
        ...lootSnapshot.dynamicLights,
        ...actionLights,
        ...vfx.getDynamicLights(),
        ...getRoomMap().interactions.flatMap(({ light, interactX: x, interactY: y }) =>
          light ? [{ x, y, ...light }] : []),
      ],
      cameraShake: feedback.cameraShake(),
    };
  }

  function isRoomLocked() {
    return lockedRoomId === getRoomMap().id && enemies.some(isAlive);
  }

  function hitEnemy(enemy, attack, knockback, now, options = {}) {
    const wasAlive = enemy.hp > 0 && enemy.state !== "dead";
    const result = resolveDamage({
      attack,
      defense: 0,
      critRate: player.critRate,
      critMultiplier: player.critMultiplier,
      rng,
    });
    const force = knockbackVector(enemy, player, knockback * 10);
    const { broken, ...poiseState } = applyPoiseHit(enemy, {
      source: options.source ?? "basic",
      now,
    });
    const damaged = damageEnemy({ ...enemy, ...poiseState }, result.damage, now);
    const killed = wasAlive && damaged.hp <= 0;
    const nextEnemy = {
      ...damaged,
      flashUntil: now + 90,
      knockbackX: force.x,
      knockbackY: force.y,
    };

    if (killed) {
      Object.assign(enemy, nextEnemy, { stunUntil: now });
    } else if (broken) {
      Object.assign(enemy, nextEnemy, {
        state: "hitstun",
        stateSince: now,
        stunUntil: now + POISE_BREAK_STUN_MS,
      });
    } else {
      Object.assign(enemy, nextEnemy);
    }

    const hit = feedback.applyHitFeedback({
      x: enemy.x,
      y: enemy.y - 8,
      damage: result.damage,
      isCrit: result.isCrit,
      killed,
      source: options.source ?? "basic",
    });

    if (hit.burstParticles > 0) {
      vfx.spawnDeathBurst({ x: enemy.x, y: enemy.y - 4, count: hit.burstParticles });
    }

    if (killed) {
      spawnTokenDropForEnemy(enemy, now);
    }
  }

  function regenerateEnemyPoise(now) {
    for (let index = 0; index < enemies.length; index += 1) {
      if (isAlive(enemies[index])) {
        enemies[index] = regeneratePoise(enemies[index], { now });
      }
    }
  }

  function spawnTokenDropForEnemy(enemy, now) {
    const run = getRun();
    const roomId = getRoomMap().id;
    const amount = enemy.isBoss
      ? rollBossLootDrop({ run, roomId })
      : rollEnemyLootDrop({ run, roomId, enemy, killIndex: lootDrops.nextEnemyKillIndex() });

    lootDrops.spawnTokenDrop({ source: enemy, amount, now });
  }

  function performEnemyAttack(enemy, now) {
    if (player.hp <= 0 || now < (player.invulnerableUntil ?? 0)) {
      return;
    }

    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (distance > enemy.attackRange + player.radius) {
      return;
    }

    const result = resolveDamage({
      attack: enemy.attack,
      defense: player.defense,
      damageMultiplier: player.incomingDamageMultiplier ?? 1,
      rng,
    });
    const force = knockbackVector(player, enemy, 135);
    const damaged = damagePlayer(player, {
      damage: result.damage,
      now,
      invulnerableMs: PLAYER_HURT_INVULNERABLE_MS,
      knockback: force,
    });

    if (!damaged.applied) {
      return;
    }

    Object.assign(player, damaged.player);
    vfx.spawnRangedEnemyShot({ enemy, player });
    feedback.addDamageNumber(player.x, player.y - 12, damaged.damage, { color: "#ff6b6b" });
    feedback.startPlayerHitFeedback();
  }

  function collectPickups(now) {
    const result = collectHealingPickups({ pickups, player, now });

    for (const healed of result.healed) {
      feedback.addDamageNumber(player.x, player.y - 14, `+${healed}`, { color: "#8cff9b" });
    }

    if (result.changed) {
      pickups = result.pickups;
      pickupsByRoomKey.set(roomKey(getRun(), getRoomMap().id), pickups);
    }
  }

  function checkRoomClear(now) {
    if (!lockedRoomId || enemies.some(isAlive)) {
      return;
    }

    const clearedRoomId = lockedRoomId;
    const run = getRun();
    lootDrops.forceCollectCurrentRoom();

    if (getRoomMap().room.type === "boss") {
      updateRun(resolveBossClear(run));
      lockedRoomId = null;
      return;
    }

    dropPotionForRoomClear(run, clearedRoomId, now);
    updateRun(resolveCombatRoomClear(run, clearedRoomId, enemies));
    lockedRoomId = null;
  }

  function dropPotionForRoomClear(run, roomId, now) {
    const pickup = createRoomClearPotionDrop({
      run,
      roomId,
      enemies,
      player,
      roomMap: getRoomMap(),
      now,
    });

    if (!pickup) {
      return;
    }

    pickups = [...pickups, pickup];
    pickupsByRoomKey.set(roomKey(run, roomId), pickups);
  }

  return {
    enterCurrentRoom,
    update,
    getSnapshot,
    isRoomLocked,
    isHitStopped: feedback.isHitStopped,
  };
}
