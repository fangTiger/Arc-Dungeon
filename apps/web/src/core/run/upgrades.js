import { createRng, hashSeed } from "../rng.js";
import { translate } from "../i18n/index.js";

export const UPGRADE_TRIGGERS = Object.freeze({
  EMBARK: "embark",
  MINOR: "minor",
  MAJOR: "major",
});

export const MINOR_UPGRADES = Object.freeze([
  createUpgrade("minor-sharp-edge", "minor", "attack", "#f0a15f", { damageMultiplier: 1.05 }),
  createUpgrade("minor-quick-feet", "minor", "move", "#7bdff2", { movementMultiplier: 1.05 }),
  createUpgrade("minor-sturdy-guard", "minor", "shield", "#a9b18f", { defenseMultiplier: 1.08 }),
  createUpgrade("minor-vital-spark", "minor", "heart", "#ef7f78", { maxHpMultiplier: 1.08 }),
  createUpgrade("minor-warding-veil", "minor", "shield", "#73c7a7", { incomingDamageMultiplier: 0.96 }),
  createUpgrade("minor-lucky-pouch", "minor", "coin", "#f4c95d", { lootMultiplier: 1.08 }),
  createUpgrade("minor-clear-breath", "minor", "stamina", "#74e0a8", { staminaRegenMultiplier: 1.1 }),
  createUpgrade("minor-arcane-spark", "minor", "cooldown", "#80a7ff", { cooldownMultiplier: 0.95 }),
]);

export const MAJOR_UPGRADES = Object.freeze([
  createUpgrade("major-berserker-blade", "major", "attack", "#ff6b4a", { damageMultiplier: 1.2, incomingDamageMultiplier: 1.1 }, true),
  createUpgrade("major-iron-skin", "major", "shield", "#bac2a0", { defenseMultiplier: 1.5, movementMultiplier: 0.95 }, true),
  createUpgrade("major-shadow-eye", "major", "crit", "#b692ff", { critRateBonus: 0.15, maxHpMultiplier: 0.92 }, true),
  createUpgrade("major-glass-cannon", "major", "blast", "#ffcf70", { damageMultiplier: 1.35, defenseMultiplier: 0.8 }, true),
  createUpgrade("major-vampire-edge", "major", "sustain", "#d85f75", { sustainMultiplier: 1.2, cooldownMultiplier: 1.08 }, true),
  createUpgrade("major-vital-bulwark", "major", "heart", "#ef7f78", { maxHpMultiplier: 1.25, damageMultiplier: 0.9 }, true),
  createUpgrade("major-guardian-pact", "major", "shield", "#76c7a0", { incomingDamageMultiplier: 0.88, damageMultiplier: 0.92 }, true),
]);

const ALL_UPGRADES = Object.freeze([...MINOR_UPGRADES, ...MAJOR_UPGRADES]);
const UPGRADE_BY_ID = new Map(ALL_UPGRADES.map((upgrade) => [upgrade.id, upgrade]));
const BASE_BUILD_BONUSES = Object.freeze({
  damageMultiplier: 1,
  defenseMultiplier: 1,
  movementMultiplier: 1,
  xpMultiplier: 1,
  lootMultiplier: 1,
  gatheringMultiplier: 1,
  staminaRegenMultiplier: 1,
  cooldownMultiplier: 1,
  communityMultiplier: 1,
  incomingDamageMultiplier: 1,
  maxHpMultiplier: 1,
  sustainMultiplier: 1,
  critRateBonus: 0,
  ignoredUpgradeIds: Object.freeze([]),
});

export function createEmptyBuild() {
  return {
    upgradeIds: [],
    bonuses: calculateBuildBonuses([]),
    pendingChoice: null,
    completedChoiceKeys: [],
  };
}

export function rollUpgradeChoices({
  seed,
  depth,
  trigger,
  choiceIndex = 0,
  ownedUpgradeIds = [],
}) {
  const pool = poolForTrigger(trigger);
  const owned = new Set(ownedUpgradeIds);
  const preferred = pool.filter((upgrade) => !owned.has(upgrade.id));
  const candidates = preferred.length >= 3 ? preferred : pool;
  const rng = createRng(hashSeed(`${seed}:upgrade:${trigger}:${depth}:${choiceIndex}`));

  return pickWeightedWithoutReplacement(candidates, rng, owned, 3);
}

export function applyUpgradeChoice(run, upgradeId) {
  const upgrade = getUpgradeById(upgradeId);
  if (!upgrade) {
    throw new RangeError("不能应用未知强化");
  }

  const build = run.build ?? createEmptyBuild();
  if (build.upgradeIds.includes(upgradeId)) {
    return { ...run, build: { ...build, bonuses: calculateBuildBonuses(build.upgradeIds) } };
  }

  const upgradeIds = [...build.upgradeIds, upgradeId];
  return {
    ...run,
    build: {
      ...build,
      upgradeIds,
      bonuses: calculateBuildBonuses(upgradeIds),
      pendingChoice: null,
    },
  };
}

export function calculateBuildBonuses(upgradeIds = []) {
  const bonuses = { ...BASE_BUILD_BONUSES, ignoredUpgradeIds: [] };

  for (const upgradeId of upgradeIds) {
    const upgrade = typeof upgradeId === "string" ? getUpgradeById(upgradeId) : upgradeId;
    if (!upgrade) {
      bonuses.ignoredUpgradeIds.push(upgradeId);
      continue;
    }

    applyBonuses(bonuses, upgrade.bonuses);
  }

  return bonuses;
}

export function getUpgradeById(upgradeId, t = translate) {
  const upgrade = UPGRADE_BY_ID.get(upgradeId);
  return upgrade ? localizeUpgrade(upgrade, t) : null;
}

export function getUpgradesByIds(upgradeIds = [], t = translate) {
  return upgradeIds.map((upgradeId) => getUpgradeById(upgradeId, t)).filter(Boolean);
}

export function localizeUpgrade(upgrade, t = translate) {
  return Object.freeze({
    ...upgrade,
    name: t(upgrade.nameKey),
    description: t(upgrade.descriptionKey),
    costDescription: upgrade.costDescriptionKey ? t(upgrade.costDescriptionKey) : "",
  });
}

function createUpgrade(id, pool, icon, iconColor, bonuses, hasCost = false) {
  const nameKey = `upgrade.${id}.name`;
  const descriptionKey = `upgrade.${id}.description`;
  const costDescriptionKey = hasCost ? `upgrade.${id}.cost` : null;
  return Object.freeze({
    id,
    pool,
    nameKey,
    name: translate(nameKey),
    icon,
    iconColor,
    descriptionKey,
    description: translate(descriptionKey),
    costDescriptionKey,
    costDescription: costDescriptionKey ? translate(costDescriptionKey) : "",
    bonuses: Object.freeze(bonuses),
    weight: 10,
  });
}

function poolForTrigger(trigger) {
  if (trigger === UPGRADE_TRIGGERS.EMBARK || trigger === UPGRADE_TRIGGERS.MINOR) {
    return MINOR_UPGRADES;
  }

  if (trigger === UPGRADE_TRIGGERS.MAJOR) {
    return MAJOR_UPGRADES;
  }

  throw new RangeError("未知强化触发类型");
}

function pickWeightedWithoutReplacement(candidates, rng, owned, count) {
  if (candidates.length < count) {
    throw new RangeError("强化池不足以抽取三选一");
  }

  const remaining = [...candidates];
  const choices = [];

  while (choices.length < count) {
    const totalWeight = remaining.reduce((sum, upgrade) => sum + weightFor(upgrade, owned), 0);
    let roll = rng.next() * totalWeight;
    let selectedIndex = remaining.length - 1;

    for (let index = 0; index < remaining.length; index += 1) {
      roll -= weightFor(remaining[index], owned);
      if (roll <= 0) {
        selectedIndex = index;
        break;
      }
    }

    choices.push(remaining[selectedIndex]);
    remaining.splice(selectedIndex, 1);
  }

  return choices;
}

function weightFor(upgrade, owned) {
  return owned.has(upgrade.id) ? Math.max(1, upgrade.weight * 0.2) : upgrade.weight;
}

function applyBonuses(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (key.endsWith("Bonus")) {
      target[key] = roundBonus((target[key] ?? 0) + value);
    } else {
      target[key] = roundBonus((target[key] ?? 1) * value);
    }
  }
}

function roundBonus(value) {
  return Math.round(value * 1000) / 1000;
}
