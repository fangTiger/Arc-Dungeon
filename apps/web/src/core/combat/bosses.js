import { createRng, hashSeed } from "../rng.js";
import { BOSS_FLOOR_INTERVAL, isBossFloor } from "../dungeon/progression.js";

export const BOSS_ROSTER = Object.freeze([
  Object.freeze({ name: "KingJ", baseHp: 800, baseDamage: 18 }),
  Object.freeze({ name: "Eric", baseHp: 830, baseDamage: 18 }),
  Object.freeze({ name: "youzi", baseHp: 810, baseDamage: 18 }),
]);

export const BOSS_SPRITE_PREFIXES = Object.freeze([
  "big_demon",
  "big_zombie",
  "ogre",
  "necromancer",
]);

const BOSS_SKILL_POOL = Object.freeze([
  "cleave",
  "ground-slam",
  "summon-minions",
  "shadow-bolt",
  "rage",
  "bone-prison",
]);

const BOSS_SPRITE_FRAMES = Object.freeze({
  big_demon: Object.freeze({ idleFrameName: "big_demon_idle_anim_f0", width: 32, height: 36 }),
  big_zombie: Object.freeze({ idleFrameName: "big_zombie_idle_anim_f0", width: 32, height: 36 }),
  ogre: Object.freeze({ idleFrameName: "ogre_idle_anim_f0", width: 32, height: 36 }),
  necromancer: Object.freeze({ idleFrameName: "necromancer_anim_f0", width: 16, height: 23 }),
});

export function createBossForDepth({ seed, depth }) {
  if (!Number.isInteger(depth) || !isBossFloor(depth)) {
    throw new RangeError("Boss 只能为正数的 5 倍层生成");
  }

  const rosterEntry = BOSS_ROSTER[bossRosterIndex(depth)];
  const rng = createRng(hashSeed(`${seed}:boss:${depth}`));
  const difficulty = bossDifficultyForDepth(depth);
  const difficultyRoll = roundScale(0.99 + rng.next() * 0.02);
  const hpRoll = roundScale(0.98 + rng.next() * 0.04);
  const damageRoll = roundScale(0.99 + rng.next() * 0.02);
  const spritePrefix = rng.pick(BOSS_SPRITE_PREFIXES);
  const skills = rng.shuffle(BOSS_SKILL_POOL).slice(0, 2 + rng.int(0, 2));
  const maxHp = scaleStat(rosterEntry.baseHp, difficulty.enemyHpScale * difficultyRoll * hpRoll);
  const damage = scaleStat(rosterEntry.baseDamage, difficulty.enemyDamageScale * difficultyRoll * damageRoll);

  return {
    id: `boss:${depth}`,
    type: "boss",
    name: rosterEntry.name,
    depth,
    hp: maxHp,
    maxHp,
    damage,
    attack: damage,
    speed: 34 + Math.floor(depth / 20) * 2,
    detectRadius: 320,
    attackRange: spritePrefix === "necromancer" ? 120 : 42,
    attackWindupMs: spritePrefix === "necromancer" ? 760 : 680,
    framePrefix: spritePrefix,
    spritePrefix,
    idleFrameName: BOSS_SPRITE_FRAMES[spritePrefix].idleFrameName,
    spriteSize: {
      width: BOSS_SPRITE_FRAMES[spritePrefix].width,
      height: BOSS_SPRITE_FRAMES[spritePrefix].height,
    },
    state: "patrol",
    stateSince: 0,
    stunUntil: 0,
    skills,
    difficulty: {
      hpScale: difficulty.enemyHpScale,
      damageScale: difficulty.enemyDamageScale,
      roll: difficultyRoll,
      hpRoll,
      damageRoll,
    },
  };
}

function bossRosterIndex(depth) {
  return (Math.floor(depth / BOSS_FLOOR_INTERVAL) - 1) % BOSS_ROSTER.length;
}

function bossDifficultyForDepth(depth) {
  const bossTier = Math.max(0, Math.floor(depth / BOSS_FLOOR_INTERVAL) - 1);
  const damageTierPressure = bossTier * 0.25 + bossTier * bossTier * 0.005;

  return {
    enemyHpScale: roundScale(1 + bossTier * 0.22),
    enemyDamageScale: roundScale(1 + damageTierPressure),
  };
}

function scaleStat(value, scale) {
  return Math.max(value, Math.round(value * scale));
}

function roundScale(value) {
  return Math.round(value * 1000) / 1000;
}
