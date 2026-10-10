import { normalizePixelHeroIdentity } from "../identity/heroFactory.js";
import {
  MAX_TICKET_HOLDINGS,
  normalizeTicketState,
} from "./tickets.js";
import { SKIN_APPEARANCE_BY_ID } from "./skinAppearance.js";

export const DEFAULT_ECONOMY_PROFILE = Object.freeze({
  highestDepth: 0,
  totalBossesDefeated: 0,
  completedRuns: 0,
  tickets: 0,
  lastDailyTicketClaimDate: null,
  skinBoxes: 0,
  ownedSkins: Object.freeze([]),
  equippedSkinId: null,
  craftCount: 0,
  heroIdentity: null,
  hudHintSeen: false,
});

export function createDefaultEconomyProfile() {
  return {
    highestDepth: 0,
    totalBossesDefeated: 0,
    completedRuns: 0,
    tickets: 0,
    lastDailyTicketClaimDate: null,
    skinBoxes: 0,
    ownedSkins: [],
    equippedSkinId: null,
    craftCount: 0,
    heroIdentity: null,
    hudHintSeen: false,
  };
}

export function normalizeEconomyProfile(profile = {}) {
  const source = isRecord(profile) ? profile : {};
  const ownedSkins = normalizeOwnedSkins(source.ownedSkins);

  return {
    highestDepth: normalizeNonNegativeInteger(source.highestDepth),
    totalBossesDefeated: normalizeNonNegativeInteger(source.totalBossesDefeated),
    completedRuns: normalizeNonNegativeInteger(source.completedRuns),
    ...normalizeProfileTicketFields(source),
    skinBoxes: normalizeNonNegativeInteger(source.skinBoxes),
    ownedSkins,
    equippedSkinId: normalizeEquippedSkinId(source.equippedSkinId, ownedSkins),
    craftCount: normalizeNonNegativeInteger(source.craftCount),
    heroIdentity: normalizePixelHeroIdentity(source.heroIdentity),
    hudHintSeen: normalizeBoolean(source.hudHintSeen),
  };
}

export function normalizeRunSummary(summary = {}) {
  if (!isRecord(summary)) {
    return null;
  }

  return {
    depthReached: Math.max(1, normalizeNonNegativeInteger(summary.depthReached)),
    bossesDefeated: normalizeNonNegativeInteger(summary.bossesDefeated),
    explorationRate: clamp01(summary.explorationRate),
  };
}

export function applyRunSummaryToProfile(profile, summary) {
  const current = normalizeEconomyProfile(profile);
  const normalizedSummary = normalizeRunSummary(summary);

  if (!normalizedSummary) {
    return current;
  }

  return {
    ...current,
    highestDepth: Math.max(current.highestDepth, normalizedSummary.depthReached),
    totalBossesDefeated: current.totalBossesDefeated + normalizedSummary.bossesDefeated,
    completedRuns: current.completedRuns + 1,
  };
}

export function addCraftedSkinToProfile(profile, skin) {
  const current = normalizeEconomyProfile(profile);
  const normalizedSkin = normalizeSkin(skin);
  const ownedSkins = normalizedSkin && !current.ownedSkins.some((owned) => owned.id === normalizedSkin.id)
    ? [...current.ownedSkins, normalizedSkin]
    : current.ownedSkins;

  return {
    ...current,
    ownedSkins,
    craftCount: current.craftCount + 1,
  };
}

export function addSkinBoxToProfile(profile, count = 1) {
  const current = normalizeEconomyProfile(profile);

  return {
    ...current,
    skinBoxes: current.skinBoxes + normalizePositiveInteger(count),
  };
}

export function openSkinBoxOnProfile(profile, skin) {
  const current = normalizeEconomyProfile(profile);

  if (current.skinBoxes <= 0) {
    return current;
  }

  return {
    ...addCraftedSkinToProfile(current, skin),
    skinBoxes: current.skinBoxes - 1,
  };
}

export function setHeroIdentityOnProfile(profile, heroIdentity) {
  const current = normalizeEconomyProfile(profile);

  return {
    ...current,
    heroIdentity: normalizePixelHeroIdentity(heroIdentity),
  };
}

export function setEquippedSkinOnProfile(profile, skinId) {
  const current = normalizeEconomyProfile(profile);

  return {
    ...current,
    equippedSkinId: normalizeEquippedSkinId(skinId, current.ownedSkins),
  };
}

export function markHudHintSeenOnProfile(profile) {
  const current = normalizeEconomyProfile(profile);

  return {
    ...current,
    hudHintSeen: true,
  };
}

export function setTicketStateOnProfile(profile, ticketState) {
  const current = normalizeEconomyProfile(profile);
  const source = isRecord(ticketState)
    ? { ...current, ...ticketState }
    : current;

  return {
    ...current,
    ...normalizeProfileTicketFields(source),
  };
}

export function sameRunSummary(left, right) {
  const normalizedLeft = normalizeRunSummary(left);
  const normalizedRight = normalizeRunSummary(right);

  return Boolean(
    normalizedLeft &&
    normalizedRight &&
    normalizedLeft.depthReached === normalizedRight.depthReached &&
    normalizedLeft.bossesDefeated === normalizedRight.bossesDefeated &&
    normalizedLeft.explorationRate === normalizedRight.explorationRate,
  );
}

function normalizeOwnedSkins(ownedSkins) {
  const normalized = [];
  const seenIds = new Set();

  for (const skin of Array.isArray(ownedSkins) ? ownedSkins : []) {
    const normalizedSkin = normalizeSkin(skin);

    if (normalizedSkin && !seenIds.has(normalizedSkin.id)) {
      seenIds.add(normalizedSkin.id);
      normalized.push(normalizedSkin);
    }
  }

  return normalized;
}

function normalizeProfileTicketFields(source) {
  const normalized = normalizeTicketState(source);

  return {
    tickets: Math.min(MAX_TICKET_HOLDINGS, normalized.tickets),
    lastDailyTicketClaimDate: normalized.lastDailyTicketClaimDate ?? null,
  };
}

function normalizeEquippedSkinId(equippedSkinId, ownedSkins) {
  if (typeof equippedSkinId !== "string") {
    return null;
  }

  const skinId = equippedSkinId.trim();

  if (!Object.hasOwn(SKIN_APPEARANCE_BY_ID, skinId)) {
    return null;
  }

  return ownedSkins.some((skin) => skin.id === skinId) ? skinId : null;
}

function normalizeSkin(skin) {
  if (!isRecord(skin) || typeof skin.id !== "string" || skin.id.trim().length === 0) {
    return null;
  }

  return {
    id: skin.id.trim(),
    name: normalizeText(skin.name, skin.id.trim()),
    rarity: normalizeText(skin.rarity, "common"),
    rarityLabel: normalizeText(skin.rarityLabel, ""),
  };
}

function normalizeText(value, fallback) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizeNonNegativeInteger(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function normalizePositiveInteger(value) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeBoolean(value) {
  return typeof value === "boolean" ? value : false;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
