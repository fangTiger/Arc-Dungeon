import { translate } from "../i18n/index.js";

export const KNIGHT_SKILL_COOLDOWNS_MS = Object.freeze({
  CIRCULAR_SLASH: 6000,
  CHARGE: 8000,
  SHIELD_BASH: 10000,
  WAR_CRY: 18000,
});

export const WIZZARD_SKILL_COOLDOWNS_MS = Object.freeze({
  FIREBALL: 5000,
  ICE_RING: 9000,
  BLINK: 7000,
  ARCANE_SURGE: 20000,
});

export const CLASS_SKILLS = Object.freeze({
  knight: Object.freeze([
    createSkill({
      id: "knight-circular-slash",
      classId: "knight",
      slot: 1,
      cooldownMs: KNIGHT_SKILL_COOLDOWNS_MS.CIRCULAR_SLASH,
      effect: {
        kind: "areaDamage",
        reuse: "useCircularSlash",
        damage: 28,
        radius: 76,
        knockback: 42,
      },
    }),
    createSkill({
      id: "knight-charge",
      classId: "knight",
      slot: 2,
      cooldownMs: KNIGHT_SKILL_COOLDOWNS_MS.CHARGE,
      effect: {
        kind: "dashStrike",
        damage: 24,
        distance: 96,
        knockback: 52,
      },
    }),
    createSkill({
      id: "knight-shield-bash",
      classId: "knight",
      slot: 3,
      cooldownMs: KNIGHT_SKILL_COOLDOWNS_MS.SHIELD_BASH,
      effect: {
        kind: "guardCounter",
        range: 38,
        invulnerableMs: 400,
        counterDamageMultiplier: 2,
        knockback: 46,
      },
    }),
    createSkill({
      id: "knight-war-cry",
      classId: "knight",
      slot: 4,
      cooldownMs: KNIGHT_SKILL_COOLDOWNS_MS.WAR_CRY,
      effect: {
        kind: "selfBuff",
        durationMs: 6000,
        attackMultiplier: 1.25,
      },
    }),
  ]),
  wizzard: Object.freeze([
    createSkill({
      id: "wizzard-fireball",
      classId: "wizzard",
      slot: 1,
      cooldownMs: WIZZARD_SKILL_COOLDOWNS_MS.FIREBALL,
      effect: {
        kind: "projectileExplosion",
        damage: 34,
        speed: 260,
        radius: 6,
        explosionRadius: 32,
        knockback: 18,
      },
    }),
    createSkill({
      id: "wizzard-ice-ring",
      classId: "wizzard",
      slot: 2,
      cooldownMs: WIZZARD_SKILL_COOLDOWNS_MS.ICE_RING,
      effect: {
        kind: "slowArea",
        damage: 12,
        radius: 74,
        slowMultiplier: 0.55,
        slowDurationMs: 2200,
      },
    }),
    createSkill({
      id: "wizzard-blink",
      classId: "wizzard",
      slot: 3,
      cooldownMs: WIZZARD_SKILL_COOLDOWNS_MS.BLINK,
      effect: {
        kind: "blink",
        distance: 112,
        invulnerableMs: 260,
      },
    }),
    createSkill({
      id: "wizzard-arcane-surge",
      classId: "wizzard",
      slot: 4,
      cooldownMs: WIZZARD_SKILL_COOLDOWNS_MS.ARCANE_SURGE,
      effect: {
        kind: "attackOverrideBuff",
        durationMs: 5000,
        projectileCount: 3,
      },
    }),
  ]),
});

const SKILL_BY_ID = new Map(
  Object.values(CLASS_SKILLS).flatMap((skills) =>
    skills.map((skill) => [skill.id, skill]),
  ),
);

export function createSkillCooldownState(overrides = {}) {
  return {
    readyAtBySkillId: {
      ...(overrides.readyAtBySkillId ?? {}),
    },
    lastUsedAtBySkillId: {
      ...(overrides.lastUsedAtBySkillId ?? {}),
    },
    cooldownMsBySkillId: {
      ...(overrides.cooldownMsBySkillId ?? {}),
    },
  };
}

export function getSkillsForClass(classId, t = translate) {
  const skills = CLASS_SKILLS[classId];
  if (!skills) {
    throw new RangeError(`未知职业技能: ${classId}`);
  }

  return skills.map((skill) => localizeSkill(skill, t));
}

export function getSkillById(skillId, t = translate) {
  const skill = SKILL_BY_ID.get(skillId);
  return skill ? localizeSkill(skill, t) : null;
}

export function localizeSkill(skill, t = translate) {
  return Object.freeze({
    ...skill,
    name: t(skill.nameKey),
    effectSummary: t(skill.effectSummaryKey),
  });
}

export function canUseSkill(state, skillId, now) {
  const skill = requireSkill(skillId);
  return safeTime(now) >= readyAtFor(state, skill.id);
}

export function getSkillCooldownProgress(state, skillId, now) {
  const skill = requireSkill(skillId);
  const timestamp = safeTime(now);
  const readyAt = readyAtFor(state, skill.id);
  const remainingMs = Math.max(0, Math.round(readyAt - timestamp));
  const cooldownMs = readCooldownMs(state, skill.id, skill.cooldownMs);
  const lastUsedAt = readLastUsedAt(state, skill.id, readyAt - cooldownMs);
  const totalMs = Math.max(1, readyAt - lastUsedAt);
  const progress = remainingMs === 0
    ? 1
    : clamp01((timestamp - lastUsedAt) / totalMs);

  return {
    ready: remainingMs === 0,
    remainingMs,
    progress: roundProgress(progress),
    readyAt,
    cooldownMs,
  };
}

export function resolveSkillCooldownMs(skillId, build = {}) {
  const skill = requireSkill(skillId);
  const cooldownMultiplier = readCooldownMultiplier(build);

  return Math.round(skill.cooldownMs * cooldownMultiplier);
}

export function useSkill(state = createSkillCooldownState(), skillId, { now, build = {} } = {}) {
  const skill = requireSkill(skillId);
  const timestamp = safeTime(now);
  const readyAt = readyAtFor(state, skill.id);

  if (timestamp < readyAt) {
    return {
      activated: false,
      state,
      skill,
      readyAt,
      remainingMs: readyAt - timestamp,
    };
  }

  const cooldownMs = resolveSkillCooldownMs(skill.id, build);
  const nextReadyAt = timestamp + cooldownMs;

  return {
    activated: true,
    state: {
      readyAtBySkillId: {
        ...(state.readyAtBySkillId ?? {}),
        [skill.id]: nextReadyAt,
      },
      lastUsedAtBySkillId: {
        ...(state.lastUsedAtBySkillId ?? {}),
        [skill.id]: timestamp,
      },
      cooldownMsBySkillId: {
        ...(state.cooldownMsBySkillId ?? {}),
        [skill.id]: cooldownMs,
      },
    },
    skill,
    cooldownMs,
    readyAt: nextReadyAt,
    remainingMs: 0,
  };
}

function createSkill({ effect, ...skill }) {
  const nameKey = `class.skill.${skill.id}.name`;
  const effectSummaryKey = `skill.${skill.id}.effectSummary`;
  return Object.freeze({
    ...skill,
    nameKey,
    effectSummaryKey,
    name: translate(nameKey),
    effectSummary: translate(effectSummaryKey),
    effect: Object.freeze(effect),
  });
}

function requireSkill(skillId) {
  const skill = getSkillById(skillId);
  if (!skill) {
    throw new RangeError(`未知技能: ${skillId}`);
  }

  return skill;
}

function readyAtFor(state, skillId) {
  const readyAt = state?.readyAtBySkillId?.[skillId] ?? 0;
  return Number.isFinite(readyAt) ? readyAt : 0;
}

function readLastUsedAt(state, skillId, fallback) {
  const value = state?.lastUsedAtBySkillId?.[skillId];
  return Number.isFinite(value) ? value : fallback;
}

function readCooldownMs(state, skillId, fallback) {
  const value = state?.cooldownMsBySkillId?.[skillId];
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readCooldownMultiplier(build) {
  const value = build?.bonuses?.cooldownMultiplier ?? build?.cooldownMultiplier ?? 1;
  return Number.isFinite(value) ? Math.max(0.2, value) : 1;
}

function safeTime(value) {
  if (!Number.isFinite(value)) {
    throw new RangeError("技能时间必须由调用方注入为有限数字");
  }

  return value;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function roundProgress(value) {
  return Math.round(value * 1000) / 1000;
}
