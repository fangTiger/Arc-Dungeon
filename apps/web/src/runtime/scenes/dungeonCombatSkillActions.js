import {
  createSkillCooldownState,
  getSkillCooldownProgress,
  getSkillsForClass,
  useCircularSlash,
  useSkill,
} from "../../core/combat.js";
import { isAlive, isEnemyInsideMelee } from "./dungeonCombatLogic.js";
import {
  SKILL_GLYPHS,
  SKILL_KEYS,
  colorFor,
  distanceToSegment,
  movePlayerAlong,
  nonZeroDirection,
  pixelAligned,
} from "./dungeonCombatActionUtils.js";

export function createDungeonCombatSkillActions({
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
}) {
  let skillCooldownState = createSkillCooldownState();

  function performSkill(slot, now) {
    const skill = getSkillsForClass(player.classId ?? "knight").find(
      (candidate) => candidate.slot === slot,
    );
    if (!skill) {
      return;
    }

    const used = useSkill(skillCooldownState, skill.id, {
      now,
      build: getRun().build,
    });
    if (!used.activated) {
      return;
    }

    skillCooldownState = used.state;
    applySkillEffect(skill, now);
  }

  function getSkillSlots(now) {
    return getSkillsForClass(player.classId ?? "knight").map((skill) => ({
      id: skill.id,
      slot: skill.slot,
      key: SKILL_KEYS[skill.slot - 1],
      name: skill.name,
      glyph: SKILL_GLYPHS[skill.effect.kind] ?? String(skill.slot),
      color: colorFor(skill),
      ...getSkillCooldownProgress(skillCooldownState, skill.id, now),
    }));
  }

  /** 增益持续期间角色自带辉光：战吼偏红、奥术涌动偏紫，两者可辨认 */
  function getDynamicLights(now) {
    const lights = [];

    if (now < (player.warCryUntil ?? 0)) {
      lights.push({ x: player.x, y: player.y - 5, radius: 42, color: "#ff6a4a", intensity: 0.5 });
    }

    if (now < (player.arcaneSurgeUntil ?? 0)) {
      lights.push({ x: player.x, y: player.y - 5, radius: 44, color: "#d48cff", intensity: 0.52 });
    }

    return lights;
  }

  function applySkillEffect(skill, now) {
    const effect = skill.effect;

    if (effect.reuse === "useCircularSlash") {
      const circular = useCircularSlash({ ...player, skillReadyAt: 0 }, now);
      Object.assign(player, pixelAligned(circular.player));
      applyAreaSkill(skill, circular.attack, now);
    } else if (effect.kind === "dashStrike") {
      performDashStrike(skill, now);
    } else if (effect.kind === "guardCounter") {
      performGuardCounter(skill, now);
    } else if (effect.kind === "selfBuff") {
      applySelfBuff(skill, now);
    } else if (effect.kind === "projectileExplosion") {
      fireSkillProjectile(skill, now);
    } else if (effect.kind === "slowArea") {
      applySlowArea(skill, now);
    } else if (effect.kind === "blink") {
      performBlink(skill, now);
    } else if (effect.kind === "attackOverrideBuff") {
      applyAttackOverrideBuff(skill, now);
    }
  }

  /** 圆斩：环形刀光扩散 */
  function applyAreaSkill(skill, attack, now) {
    vfx.spawnCircularSlash({
      x: player.x,
      y: player.y,
      radius: attack.radius,
      color: colorFor(skill),
    });
    const hitCount = damageEnemiesInRadius(player.x, player.y, attack.radius, attack, now);
    registerSkillHitIfNeeded(hitCount, now);
  }

  /** 冲锋：冲刺轨迹残影 + 撞击尘土 */
  function performDashStrike(skill, now) {
    const start = { x: player.x, y: player.y };
    const effect = skill.effect;

    movePlayerAlong({
      player,
      roomMap: getRoomMap(),
      direction: nonZeroDirection(player.facing),
      distance: effect.distance,
    });
    vfx.spawnChargeTrail({
      from: start,
      to: { x: player.x, y: player.y },
      color: colorFor(skill),
    });
    feedback.addAfterimage({ ...player, x: start.x, y: start.y }, "#ffb36a");

    let hitCount = 0;
    for (const enemy of getEnemies()) {
      if (isAlive(enemy) && distanceToSegment(enemy, start, player) <= 22 + enemy.radius) {
        hitEnemy(enemy, effect.damage, effect.knockback, now, { source: "skill" });
        hitCount += 1;
      }
    }
    registerSkillHitIfNeeded(hitCount, now);
  }

  function performGuardCounter(skill, now) {
    const effect = skill.effect;
    player.invulnerableUntil = Math.max(player.invulnerableUntil ?? 0, now + effect.invulnerableMs);
    const attack = {
      range: effect.range,
      arc: 82,
      damage: Math.round(player.attack * effect.counterDamageMultiplier),
      knockback: effect.knockback,
      burstColor: colorFor(skill),
      burstWidth: 3,
    };

    vfx.spawnShieldBash({
      x: player.x,
      y: player.y,
      facing: nonZeroDirection(player.facing),
      color: colorFor(skill),
    });
    let hitCount = 0;
    for (const enemy of getEnemies()) {
      if (isAlive(enemy) && isEnemyInsideMelee(player, enemy, attack)) {
        // 格挡成功（打到人）才迸火花，让「挡下来了」这件事看得见
        vfx.spawnShieldSpark({ x: enemy.x, y: enemy.y - 4, color: "#dff1ff" });
        hitEnemy(enemy, attack.damage, attack.knockback, now, { source: "skill" });
        hitCount += 1;
      }
    }
    registerSkillHitIfNeeded(hitCount, now);
  }

  /** 战吼：周身红色脉冲波，持续期间的武器辉光由动态光源与精灵染色承担 */
  function applySelfBuff(skill, now) {
    player.warCryUntil = now + skill.effect.durationMs;
    player.warCryAttackMultiplier = skill.effect.attackMultiplier;
    vfx.spawnWarCry({ x: player.x, y: player.y });
  }

  /** 火球：出手光点，拖尾与命中爆炸在投射物更新与命中时生成 */
  function fireSkillProjectile(skill, now) {
    const projectile = createSkillProjectile(skill);

    addProjectile(projectile);
    vfx.spawnProjectileTrail({ x: player.x, y: player.y, color: colorFor(skill) });
    void now;
  }

  /** 冰环：蓝色环形波纹扩散，命中敌人打上减速染蓝标记 */
  function applySlowArea(skill, now) {
    const effect = skill.effect;
    const attack = { damage: effect.damage, radius: effect.radius, knockback: 16 };
    vfx.spawnIceRing({
      x: player.x,
      y: player.y,
      radius: effect.radius,
      color: colorFor(skill),
    });
    let hitCount = 0;

    for (const enemy of getEnemies()) {
      const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (isAlive(enemy) && distance <= effect.radius + enemy.radius) {
        enemy.slowUntil = now + effect.slowDurationMs;
        enemy.slowMultiplier = effect.slowMultiplier;
        hitEnemy(enemy, attack.damage, attack.knockback, now, { source: "skill" });
        hitCount += 1;
      }
    }
    registerSkillHitIfNeeded(hitCount, now);
  }

  /** 闪现：消失与出现两端各留一枚光点，中间连一道细线 */
  function performBlink(skill, now) {
    const start = { x: player.x, y: player.y };
    feedback.addAfterimage(player, colorFor(skill));
    movePlayerAlong({
      player,
      roomMap: getRoomMap(),
      direction: nonZeroDirection(player.facing),
      distance: skill.effect.distance,
    });
    player.invulnerableUntil = Math.max(player.invulnerableUntil ?? 0, now + skill.effect.invulnerableMs);
    vfx.spawnBlink({
      from: start,
      to: { x: player.x, y: player.y },
      color: colorFor(skill),
    });
  }

  /** 奥术涌动：紫色内收光环，持续期间普攻变三重投射 */
  function applyAttackOverrideBuff(skill, now) {
    player.arcaneSurgeUntil = now + skill.effect.durationMs;
    vfx.spawnArcaneSurge({ x: player.x, y: player.y, color: colorFor(skill) });
  }

  function damageEnemiesInRadius(x, y, radius, attack, now) {
    let hitCount = 0;
    for (const enemy of getEnemies()) {
      const distance = Math.hypot(enemy.x - x, enemy.y - y);
      if (isAlive(enemy) && distance <= radius + enemy.radius) {
        hitEnemy(enemy, attack.damage, attack.knockback, now, { source: "skill" });
        hitCount += 1;
      }
    }
    return hitCount;
  }

  function registerSkillHitIfNeeded(hitCount, now) {
    if (hitCount > 0) {
      registerSkillHit(now);
    }
  }

  return {
    performSkill,
    getSkillSlots,
    getDynamicLights,
  };
}
