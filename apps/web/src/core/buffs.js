import { translate } from "./i18n/index.js";

export const runBuffs = [
  createRunBuff({
    id: "valor-flame",
    iconColor: "#f06f4f",
    category: "combat",
    scope: "run",
    primaryBonus: "damageMultiplier",
    bonuses: { damageMultiplier: 1.12 },
  }),
  createRunBuff({
    id: "stone-guard",
    iconColor: "#9ca38f",
    category: "defense",
    scope: "run",
    primaryBonus: "defenseMultiplier",
    bonuses: { defenseMultiplier: 1.14 },
  }),
  createRunBuff({
    id: "wind-step",
    iconColor: "#8fd8ff",
    category: "mobility",
    scope: "run",
    primaryBonus: "movementMultiplier",
    bonuses: { movementMultiplier: 1.08 },
  }),
  createRunBuff({
    id: "starlit-study",
    iconColor: "#cda8ff",
    category: "growth",
    scope: "run",
    primaryBonus: "xpMultiplier",
    bonuses: { xpMultiplier: 1.15 },
  }),
  createRunBuff({
    id: "harvest-luck",
    iconColor: "#f4c95d",
    category: "loot",
    scope: "run",
    primaryBonus: "lootMultiplier",
    bonuses: { lootMultiplier: 1.12 },
  }),
  createRunBuff({
    id: "artisan-focus",
    iconColor: "#d79b63",
    category: "craft",
    scope: "run",
    primaryBonus: "gatheringMultiplier",
    bonuses: { gatheringMultiplier: 1.18 },
  }),
  createRunBuff({
    id: "echo-bond",
    iconColor: "#7bdff2",
    category: "community",
    scope: "run",
    primaryBonus: "communityMultiplier",
    bonuses: { communityMultiplier: 1.2 },
  }),
  createRunBuff({
    id: "spring-mend",
    iconColor: "#74e0a8",
    category: "sustain",
    scope: "run",
    primaryBonus: "staminaRegenMultiplier",
    bonuses: { staminaRegenMultiplier: 1.16 },
  }),
  createRunBuff({
    id: "arcane-tempo",
    iconColor: "#80a7ff",
    category: "skill",
    scope: "run",
    primaryBonus: "cooldownMultiplier",
    bonuses: { cooldownMultiplier: 0.9 },
  }),
];

export const characterBuffs = runBuffs;

const BASE_BONUSES = {
  damageMultiplier: 1,
  defenseMultiplier: 1,
  movementMultiplier: 1,
  xpMultiplier: 1,
  lootMultiplier: 1,
  gatheringMultiplier: 1,
  staminaRegenMultiplier: 1,
  cooldownMultiplier: 1,
  communityMultiplier: 1,
  ignoredBuffIds: [],
};

export function getActiveRunBuffs(buffIds, t = translate) {
  return buffIds
    .map((id) => runBuffs.find((buff) => buff.id === id))
    .filter(Boolean)
    .map((buff) => localizeRunBuff(buff, t));
}

export function localizeRunBuff(buff, t = translate) {
  return {
    ...buff,
    name: t(buff.nameKey),
    description: t(buff.descriptionKey),
  };
}

export function calculateRunBuffBonuses(activeBuffsOrIds = []) {
  const bonuses = { ...BASE_BONUSES, ignoredBuffIds: [] };
  const activeBuffs = activeBuffsOrIds.map((buffOrId) => {
    if (typeof buffOrId !== "string") {
      return buffOrId;
    }

    const buff = runBuffs.find((candidate) => candidate.id === buffOrId);
    if (!buff) {
      bonuses.ignoredBuffIds.push(buffOrId);
    }
    return buff;
  }).filter(Boolean);

  for (const buff of activeBuffs) {
    for (const [key, value] of Object.entries(buff.bonuses)) {
      bonuses[key] = roundBonus(bonuses[key] * value);
    }
  }

  return bonuses;
}

export function createDefaultRunBuffIds() {
  return [];
}

export const getActiveBuffs = getActiveRunBuffs;
export const calculateBuffBonuses = calculateRunBuffBonuses;
export const createDefaultActiveBuffIds = createDefaultRunBuffIds;

function roundBonus(value) {
  return Math.round(value * 1000) / 1000;
}

function createRunBuff(buff) {
  const nameKey = `runBuff.${buff.id}.name`;
  const descriptionKey = `runBuff.${buff.id}.description`;
  return {
    ...buff,
    nameKey,
    descriptionKey,
    name: translate(nameKey),
    description: translate(descriptionKey),
  };
}
