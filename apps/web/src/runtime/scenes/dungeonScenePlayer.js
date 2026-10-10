import { resolveHeroSpriteVariant } from "../../core/economy/skinAppearance.js";

export function getFacing(direction, currentFacing) {
  if (direction.x < 0) {
    return "left";
  }

  if (direction.x > 0) {
    return "right";
  }

  if (direction.y < 0) {
    return "up";
  }

  if (direction.y > 0) {
    return "down";
  }

  return currentFacing;
}

export function normalizeHeroClass(heroClass) {
  return heroClass === "mage" ? "wizzard" : heroClass ?? "knight";
}

export function resolveDungeonPlayerSpriteVariant({ profile = {}, heroIdentity, classId } = {}) {
  const ownedSkinIds = Array.isArray(profile.ownedSkins)
    ? profile.ownedSkins.map((skin) => skin.id).filter((id) => typeof id === "string")
    : [];

  return resolveHeroSpriteVariant({
    equippedSkinId: profile.equippedSkinId,
    ownedSkinIds,
    heroIdentity,
    classId,
  });
}
