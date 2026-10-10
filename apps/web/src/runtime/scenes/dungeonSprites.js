import { createAnimation, getFrames } from "../../core/art/atlasIndex.js";
import { ROOM_DIRECTION_NAMES } from "../../core/dungeon/roomTransitions.js";
import { TILE_SIZE } from "../renderer/pixelSurface.js";
import { createLootDropSprite } from "./dungeonLootDrops.js";

const CHARACTER_FPS = 8;

export function createDungeonSpriteFactory({ tileset }) {
  const frames = tileset.frames ?? tileset.tiles;
  const animationCache = new Map();

  function createSceneSprites({ roomMap, player, elapsedMs, combat }) {
    const sprites = [];

    if (roomMap.content) {
      pushFootAlignedTileSprite(
        sprites,
        roomMap.content.frameName,
        roomMap.content.tileX,
        roomMap.content.tileY,
      );
    }

    if (combat?.roomLocked) {
      pushDoorLocks(sprites, roomMap);
    }

    for (const enemy of combat?.enemies ?? []) {
      pushEnemySprite(sprites, enemy, elapsedMs);
    }

    for (const pickup of combat?.pickups ?? []) {
      pushPickupSprite(sprites, pickup);
    }

    for (const drop of combat?.lootDrops ?? []) {
      const sprite = createLootDropSprite({ drop, elapsedMs, tileset, frames });
      if (sprite) {
        sprites.push(sprite);
      }
    }

    for (const afterimage of combat?.playerAfterimages ?? []) {
      pushPlayerAfterimageSprite(sprites, player, afterimage, elapsedMs);
    }

    pushPlayerSprite(sprites, player, elapsedMs, combat);
    return sprites;
  }

  function pushPlayerSprite(sprites, player, elapsedMs, combat) {
    const prefix = player.spritePrefix ?? "knight_m";
    const animation = animationFor(prefix, player.moving ? "run" : "idle");
    const dying = player.state === "dying";
    const dodging = elapsedMs < (player.dodgeUntil ?? 0);
    const invulnerable = elapsedMs < (player.invulnerableUntil ?? 0);
    const deathBlink = dying && (player.deathElapsed ?? 0) < 0.85 &&
      Math.floor(elapsedMs / 95) % 2 === 0;
    const buffTint = playerBuffTint(player, elapsedMs, combat, dodging);
    pushCharacterSprite(sprites, {
      frame: animation.frameAt(elapsedMs),
      x: player.x,
      y: player.y,
      flipX: player.facingName === "left",
      flash: elapsedMs < (player.flashUntil ?? 0) || deathBlink,
      alpha: dying ? player.deathAlpha : invulnerable ? 0.66 : 1,
      tintColor: buffTint.color,
      tintAlpha: buffTint.alpha,
    });
  }

  /**
   * 角色染色优先级：战吼与奥术涌动的持续辉光要能被看见，
   * 因此排在接续窗口与翻滚之前。辉光带轻微脉冲，避免看起来像贴图变色。
   */
  function playerBuffTint(player, elapsedMs, combat, dodging) {
    const pulse = 0.34 + Math.abs(Math.sin(elapsedMs / 190)) * 0.22;

    if (elapsedMs < (player.warCryUntil ?? 0)) {
      return { color: "#ff6a4a", alpha: pulse };
    }

    if (elapsedMs < (player.arcaneSurgeUntil ?? 0)) {
      return { color: "#d48cff", alpha: pulse };
    }

    if (combat?.followUpActive) {
      return { color: "#ecff92", alpha: 0.48 };
    }

    return dodging ? { color: "#7ce8ff", alpha: 0.44 } : { color: null, alpha: 1 };
  }

  function pushPlayerAfterimageSprite(sprites, player, afterimage, elapsedMs) {
    const prefix = player.spritePrefix ?? "knight_m";
    const animation = animationFor(prefix, player.moving ? "run" : "idle");
    const phase = afterimage.ageMs / afterimage.maxAgeMs;

    pushCharacterSprite(sprites, {
      frame: animation.frameAt(elapsedMs),
      x: afterimage.x,
      y: afterimage.y,
      flipX: afterimage.facingName === "left",
      alpha: Math.max(0, 0.36 * (1 - phase)),
      tintColor: afterimage.color,
      tintAlpha: 0.72,
      shadowWidth: 10,
    });
  }

  function pushEnemySprite(sprites, enemy, elapsedMs) {
    if (enemy.state === "dead") {
      return;
    }

    const moving = enemy.state === "chase" || enemy.state === "patrol" || enemy.state === "wait";
    const frame = enemy.staticFrameName
      ? getFrame(enemy.staticFrameName)
      : animationFor(enemy.spritePrefix ?? enemy.framePrefix, moving ? "run" : "idle").frameAt(elapsedMs);
    const windupPhase = enemy.state === "windup"
      ? 1 + Math.sin(elapsedMs / 42) * 0.06 + 0.08
      : 1;
    const tint = enemyTint(enemy, elapsedMs);

    pushCharacterSprite(sprites, {
      frame,
      x: enemy.x,
      y: enemy.y,
      flipX: enemy.facingX < 0,
      flash: elapsedMs < (enemy.flashUntil ?? 0),
      scale: windupPhase,
      tintColor: tint.color,
      tintAlpha: tint.alpha,
      shadowWidth: enemy.isBoss ? 28 : null,
    });
  }

  /** 前摇泛白提示优先，其次是破韧踉跄，再其次是冰环减速的染蓝 */
  function enemyTint(enemy, elapsedMs) {
    if (enemy.state === "windup") {
      return { color: "#ffefe0", alpha: 0.32 };
    }

    if (enemy.state === "hitstun" && elapsedMs < (enemy.stunUntil ?? 0)) {
      return { color: "#c9a0ff", alpha: 0.56 };
    }

    if (elapsedMs < (enemy.slowUntil ?? 0)) {
      return { color: "#7fd8ff", alpha: 0.5 };
    }

    return { color: null, alpha: 1 };
  }

  function pushCharacterSprite(sprites, {
    frame,
    x,
    y,
    flipX,
    flash,
    alpha = 1,
    scale = 1,
    tintColor = null,
    tintAlpha = 1,
    shadowWidth = null,
  }) {
    if (!frame) {
      return;
    }

    const frameBox = getFrameBox(frame);
    const footY = y + TILE_SIZE / 2;

    sprites.push({
      image: tileset.image,
      frame,
      x: Math.round(x - frameBox.width / 2),
      y: Math.round(footY - frameBox.height),
      sortY: footY,
      flipX,
      castsShadow: true,
      scale,
      alpha,
      tintColor: flash ? "#ffffff" : tintColor,
      tintAlpha: flash ? 0.88 : tintAlpha,
      shadowWidth,
    });
  }

  function pushPickupSprite(sprites, pickup) {
    const frame = getFrame(pickup.frameName);

    if (!frame) {
      return;
    }

    const frameBox = getFrameBox(frame);
    sprites.push({
      image: tileset.image,
      frame,
      x: Math.round(pickup.x - frameBox.width / 2),
      y: Math.round(pickup.y - frameBox.height / 2),
      sortY: pickup.y + frameBox.height / 2,
      castsShadow: true,
      shadowWidth: 12,
      shadowColor: "rgba(0, 0, 0, 0.34)",
    });
  }

  function pushDoorLocks(sprites, roomMap) {
    for (const direction of ROOM_DIRECTION_NAMES) {
      if (!roomMap.room.doors[direction]) {
        continue;
      }

      const lock = doorLockPosition(direction, roomMap);
      sprites.push({
        image: tileset.image,
        frame: getFrame("doors_leaf_closed"),
        x: lock.x,
        y: lock.y,
        sortY: lock.sortY,
        castsShadow: true,
      });
    }
  }

  function pushFootAlignedTileSprite(sprites, frameName, tileX, tileY) {
    const frame = getFrame(frameName);

    if (!frame) {
      return;
    }

    const frameBox = getFrameBox(frame);
    const footX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const footY = (tileY + 1) * TILE_SIZE;

    sprites.push({
      image: tileset.image,
      frame,
      x: Math.round(footX - frameBox.width / 2),
      y: Math.round(footY - frameBox.height),
      sortY: footY,
      castsShadow: frameName !== "floor_stairs",
    });
  }

  function animationFor(prefix, action) {
    const key = `${prefix}:${action}`;
    if (!animationCache.has(key)) {
      animationCache.set(key, createAnimation({
        frames: getFrames(frames, `${prefix}_${action}_anim`, 4),
        fps: CHARACTER_FPS,
      }));
    }

    return animationCache.get(key);
  }

  function getFrame(frameName) {
    return frames?.[frameName] ?? null;
  }

  return { createSceneSprites };
}

function doorLockPosition(direction, roomMap) {
  const centerX = Math.floor(roomMap.width / 2);
  const centerY = Math.floor(roomMap.height / 2);
  const tileSize = roomMap.tileSize;

  if (direction === "north") {
    return { x: (centerX - 1) * tileSize, y: 0, sortY: tileSize };
  }

  if (direction === "south") {
    return { x: (centerX - 1) * tileSize, y: (roomMap.height - 2) * tileSize, sortY: roomMap.height * tileSize };
  }

  if (direction === "west") {
    return { x: 0, y: centerY * tileSize - Math.floor(tileSize / 2), sortY: (centerY + 1) * tileSize };
  }

  return {
    x: (roomMap.width - 2) * tileSize,
    y: centerY * tileSize - Math.floor(tileSize / 2),
    sortY: (centerY + 1) * tileSize,
  };
}

function getFrameBox(frame) {
  return {
    width: frame.sw ?? frame.width,
    height: frame.sh ?? frame.height,
  };
}
