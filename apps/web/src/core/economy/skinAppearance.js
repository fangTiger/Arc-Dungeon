import { PLAYER_CLASSES } from "../combat/classes.js";
import { translate } from "../i18n/index.js";

const DEFAULT_CLASS_ID = "knight";
const DEFAULT_SPRITE_VARIANT = "knight_m";
const APPEARANCE_FAMILIES = Object.freeze([
  "knight",
  "wizzard",
  "elf",
  "dwarf",
  "lizard",
  "doc",
  "angel",
]);

export const SKIN_APPEARANCE_BY_ID = Object.freeze({
  "common-iron-guard": Object.freeze({ spriteVariant: "knight_m" }),
  "common-ash-runner": Object.freeze({ spriteVariant: "knight_f" }),
  "common-moss-cloak": Object.freeze({ spriteVariant: "wizzard_f" }),
  "common-lantern-squire": Object.freeze({ spriteVariant: "wizzard_m" }),
  "rare-crimson-duelist": Object.freeze({ spriteVariant: "elf_m" }),
  "rare-sapphire-ward": Object.freeze({ spriteVariant: "dwarf_m" }),
  "rare-moonlit-archivist": Object.freeze({ spriteVariant: "elf_f" }),
  "precious-starforged-vanguard": Object.freeze({ spriteVariant: "lizard_m" }),
  "precious-voidglass-magus": Object.freeze({ spriteVariant: "doc" }),
  "chosen-rialo-oracle": Object.freeze({ spriteVariant: "angel" }),
});

export const SKIN_APPEARANCE_VARIANTS = Object.freeze(
  Object.values(SKIN_APPEARANCE_BY_ID).map((appearance) => appearance.spriteVariant),
);

export function getSkinAppearance(skinId) {
  if (typeof skinId !== "string") {
    return null;
  }

  return SKIN_APPEARANCE_BY_ID[skinId] ?? null;
}

export function getSkinAppearanceLabel(skinId, t = translate) {
  const spriteVariant = getSkinAppearance(skinId)?.spriteVariant;
  return getSpriteVariantAppearanceLabel(spriteVariant, t);
}

export function getSpriteVariantAppearanceLabel(spriteVariant, t = translate) {
  if (typeof spriteVariant !== "string" || spriteVariant.length === 0) {
    return t("skin.appearance.unknown");
  }

  const family = spriteVariant.replace(/_[mf]$/, "");
  return APPEARANCE_FAMILIES.includes(family)
    ? t(`skin.appearance.${family}`)
    : t("skin.appearance.custom", { variant: spriteVariant });
}

export function resolveHeroSpriteVariant({
  equippedSkinId,
  ownedSkinIds,
  heroIdentity,
  classId,
} = {}) {
  const equippedAppearance = resolveEquippedAppearance(equippedSkinId, ownedSkinIds);

  if (equippedAppearance) {
    return equippedAppearance.spriteVariant;
  }

  if (typeof classId === "string" && Object.hasOwn(PLAYER_CLASSES, classId)) {
    return classSpriteVariant(classId);
  }

  if (typeof heroIdentity?.spriteVariant === "string" && heroIdentity.spriteVariant.trim().length > 0) {
    return heroIdentity.spriteVariant.trim();
  }

  return classSpriteVariant(classId);
}

function resolveEquippedAppearance(equippedSkinId, ownedSkinIds) {
  const appearance = getSkinAppearance(equippedSkinId);

  if (!appearance || !ownedSkinIdsContain(ownedSkinIds, equippedSkinId)) {
    return null;
  }

  return appearance;
}

function ownedSkinIdsContain(ownedSkinIds, skinId) {
  if (!Array.isArray(ownedSkinIds)) {
    return false;
  }

  return ownedSkinIds.includes(skinId);
}

function classSpriteVariant(classId) {
  if (typeof classId !== "string" || !Object.hasOwn(PLAYER_CLASSES, classId)) {
    return DEFAULT_SPRITE_VARIANT;
  }

  return `${classId}_m`;
}
