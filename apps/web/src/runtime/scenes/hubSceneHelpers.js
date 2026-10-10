import { readBrowserOption } from "../browserOptions.js";
import { resolveHeroSpriteVariant } from "../../core/economy/skinAppearance.js";
import { canMoveTo } from "../../core/hub/hubMap.js";

export function selectedHeroClass() {
  return (readBrowserOption("heroClass") ?? readBrowserOption("rialoHeroClass")) === "wizzard" ? "wizzard" : "knight";
}

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

export function moveHubPlayer({ map, player, direction, speed, dt }) {
  const nextX = player.x + direction.x * speed * dt;
  const nextY = player.y + direction.y * speed * dt;
  let moved = false;

  if (canMoveTo(map, nextX, player.y, player.radius)) {
    player.x = nextX;
    moved = true;
  }
  if (canMoveTo(map, player.x, nextY, player.radius)) {
    player.y = nextY;
    moved = true;
  }

  return moved;
}

export function getFrameBox(frame) {
  return {
    width: frame.sw ?? frame.width,
    height: frame.sh ?? frame.height,
  };
}

export function resolveHubPlayerSpriteVariant({ profile = {}, heroIdentity, classId }) {
  const selectedIdentity = heroIdentity ?? profile.heroIdentity;
  const ownedSkinIds = Array.isArray(profile.ownedSkins)
    ? profile.ownedSkins.map((skin) => skin.id).filter((id) => typeof id === "string")
    : [];

  return resolveHeroSpriteVariant({
    equippedSkinId: profile.equippedSkinId,
    ownedSkinIds,
    heroIdentity: selectedIdentity,
    classId: classId ?? selectedIdentity?.selectedClassId,
  });
}
