import {
  DASH_SLASH_DAMAGE_MULTIPLIER,
  createComboState,
  createProjectile,
  canPerformActionDuringRecovery,
  isWithinSkillFollowUpWindow,
  reduceComboState,
  resolveComboAttack,
  startDodge,
  triggerAttack,
} from "../../core/combat.js";
import { isAlive, isEnemyInsideMelee } from "./dungeonCombatLogic.js";
import {
  colorFor,
  createFanProjectile,
  movePlayerAlong,
  nonZeroDirection,
  pixelAligned,
} from "./dungeonCombatActionUtils.js";
import { createDungeonCombatSkillActions } from "./dungeonCombatSkillActions.js";

const ATTACK_RECOVERY_MS = 330;
const DASH_SPEED = 330;
const AFTERIMAGE_INTERVAL_MS = 42;

export function createDungeonCombatActions({
  player,
  getRun,
  getRoomMap,
  getEnemies,
  addProjectile,
  hitEnemy,
  feedback,
  vfx,
}) {
  let comboState = createComboState();
  let attackRecoveryUntil = 0;
  let lastAfterimageAt = -Infinity;
  let lastNow = 0;
  const skills = createDungeonCombatSkillActions({
    player,
    getRun,
    getRoomMap,
    getEnemies,
    addProjectile,
    hitEnemy,
    feedback,
    vfx,
    createSkillProjectile,
    registerSkillHit,
  });

  function update(dt, now) {
    lastNow = now;
    moveDuringDodge(dt, now);
  }

  function handleInput(input, now) {
    lastNow = now;

    if (input.wasPressed("dodge")) {
      performDodge(input.getDirection(), now);
    }

    for (let slot = 1; slot <= 4; slot += 1) {
      if (input.wasPressed(`skill${slot}`)) {
        performSkill(slot, now);
      }
    }

    if (input.wasPressed("attack")) {
      performAttack(now);
    }
  }

  function performDodge(direction, now) {
    if (now < (player.dodgeUntil ?? 0)) {
      return;
    }

    if (!canPerformActionDuringRecovery(comboState, {
      action: "dodge",
      attackRecoveryUntil,
      now,
    })) {
      return;
    }

    const dodgeDirection =
      direction.x !== 0 || direction.y !== 0 ? direction : player.facing;
    const result = startDodge(player, nonZeroDirection(dodgeDirection), now);
    if (!result.started) {
      return;
    }

    Object.assign(player, pixelAligned(result.player));
    comboState = reduceComboState(
      comboState,
      { type: "dodgeStarted", durationMs: Math.max(0, player.dodgeUntil - now) },
      now,
    );
    attackRecoveryUntil = 0;
    feedback.addAfterimage(player, "#78dcff");
    lastAfterimageAt = now;
  }

  function performAttack(now) {
    const dashSlashReady = resolveComboAttack(comboState, { baseDamage: 1, now }).isDashSlash;
    if (!canPerformActionDuringRecovery(comboState, {
      action: "attack",
      attackRecoveryUntil,
      now,
    })) {
      return;
    }

    const result = triggerAttack(player, now);
    Object.assign(player, pixelAligned(result.player));
    comboState = reduceComboState(comboState, { type: "attackStarted" }, now);
    attackRecoveryUntil = now + (dashSlashReady ? ATTACK_RECOVERY_MS - 70 : ATTACK_RECOVERY_MS);

    if (result.attack.attackMode === "projectile") {
      if (dashSlashReady) {
        comboState = reduceComboState(comboState, { type: "dashSlashConsumed" }, now);
      }
      fireBasicProjectiles(result.attack, now);
      return;
    }

    performMeleeAttack(result.attack, now);
  }

  function performSkill(slot, now) {
    if (!canPerformActionDuringRecovery(comboState, {
      action: "skill",
      attackRecoveryUntil,
      now,
    })) {
      return;
    }

    skills.performSkill(slot, now);
  }

  function performMeleeAttack(sourceAttack, now) {
    const baseDamage = (sourceAttack.damage + player.attack) * attackBuffMultiplier(now);
    const comboAttack = resolveComboAttack(comboState, { baseDamage, now });
    const attack = {
      ...sourceAttack,
      damage: comboAttack.damage,
      range: comboAttack.isDashSlash ? sourceAttack.range + 18 : sourceAttack.range,
      arc: comboAttack.isDashSlash ? Math.max(sourceAttack.arc, 118) : sourceAttack.arc,
      // 普攻不再击退，冲刺斩也不例外——击退是技能的专属价值
      knockback: sourceAttack.knockback,
      burstColor: comboAttack.isDashSlash ? "#ffef8a" : "#ffe8a3",
      burstWidth: comboAttack.isDashSlash ? 4 : 2,
      maxAgeMs: comboAttack.isDashSlash ? 210 : undefined,
    };

    if (comboAttack.isDashSlash) {
      const distance = Math.round(sourceAttack.range * (DASH_SLASH_DAMAGE_MULTIPLIER - 1));
      movePlayerAlong({ player, roomMap: getRoomMap(), direction: player.facing, distance });
      feedback.addAfterimage(player, "#fff08a");
      comboState = reduceComboState(comboState, { type: "dashSlashConsumed" }, now);
    }

    feedback.addMeleeBurst(player, attack);
    const source = hitSourceFor(sourceAttack, comboAttack);
    for (const enemy of getEnemies()) {
      if (isAlive(enemy) && isEnemyInsideMelee(player, enemy, attack)) {
        hitEnemy(enemy, attack.damage, attack.knockback, now, { source });
      }
    }
  }

  /** 命中反馈分级的来源标记：冲刺斩与三段收招都按重击处理 */
  function hitSourceFor(sourceAttack, comboAttack) {
    if (comboAttack.isDashSlash) {
      return "dashSlash";
    }

    return sourceAttack.comboStep === 3 ? "comboFinisher" : "basic";
  }

  function fireBasicProjectiles(sourceAttack, now) {
    const baseProjectile = sourceAttack.projectile;
    const followUp = isWithinSkillFollowUpWindow(comboState, now);
    const buffedDamage = baseProjectile.damage * attackBuffMultiplier(now);
    const damage = followUp
      ? resolveComboAttack(createComboState({ lastSkillHitAt: comboState.lastSkillHitAt }), {
        baseDamage: buffedDamage,
        now,
      }).damage
      : Math.round(buffedDamage);
    const offsets = now < (player.arcaneSurgeUntil ?? 0) ? [-0.26, 0, 0.26] : [0];

    for (const offset of offsets) {
      addProjectile(createFanProjectile(baseProjectile, offset, damage));
    }
  }

  function createSkillProjectile(skill) {
    const effect = skill.effect;
    const direction = nonZeroDirection(player.facing);
    const projectile = createProjectile({
      x: Math.round(player.x),
      y: Math.round(player.y),
      dirX: direction.x,
      dirY: direction.y,
      speed: effect.speed,
      damage: effect.damage,
      maxLifeMs: 920,
      radius: effect.radius,
    });

    return {
      ...projectile,
      skillId: skill.id,
      explosionRadius: effect.explosionRadius,
      knockback: effect.knockback,
      skillColor: colorFor(skill),
    };
  }

  function moveDuringDodge(dt, now) {
    if (now >= (player.dodgeUntil ?? 0)) {
      return;
    }

    movePlayerAlong({
      player,
      roomMap: getRoomMap(),
      direction: player.dodgeDirection ?? player.facing,
      distance: Math.round(DASH_SPEED * dt),
    });
    if (now - lastAfterimageAt >= AFTERIMAGE_INTERVAL_MS) {
      feedback.addAfterimage(player, "#78dcff");
      lastAfterimageAt = now;
    }
  }

  function registerSkillHit(now) {
    comboState = reduceComboState(comboState, { type: "skillHit" }, now);
  }

  function attackBuffMultiplier(now) {
    return now < (player.warCryUntil ?? 0) ? player.warCryAttackMultiplier ?? 1 : 1;
  }

  return {
    update,
    handleInput,
    registerSkillHit,
    getSkillSlots: () => skills.getSkillSlots(lastNow),
    getDynamicLights: () => [
      ...skills.getDynamicLights(lastNow),
      ...(isWithinSkillFollowUpWindow(comboState, lastNow)
        ? [{ x: player.x, y: player.y - 4, radius: 34, color: "#eaff92", intensity: 0.55 }]
        : []),
    ],
    isFollowUpActive: () => isWithinSkillFollowUpWindow(comboState, lastNow),
  };
}
