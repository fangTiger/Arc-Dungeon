import { createAnimation, getFrames } from "../../core/art/atlasIndex.js";
import { hubMap } from "../../core/hub/hubMap.js";
import { TILE_SIZE } from "../renderer/pixelSurface.js";
import { createCharacterAnimationCache } from "./characterAnimationCache.js";
import { getFrameBox } from "./hubSceneHelpers.js";

const CHARACTER_FPS = 8;
const FOUNTAIN_FPS = 5;

export function createHubSpriteFactory({ tileset, getPlayerSpriteVariant }) {
  const frames = tileset.frames ?? tileset.tiles;
  const animations = createAnimations(frames);
  const characterAnimations = createCharacterAnimationCache({ frames, fps: CHARACTER_FPS });
  const interactionIds = new Set(hubMap.interactions.map((interaction) => interaction.id));

  function createSceneSprites({ player, elapsedMs }) {
    const sprites = [];

    for (let tileY = 0; tileY < hubMap.height; tileY += 1) {
      for (let tileX = 0; tileX < hubMap.width; tileX += 1) {
        const tileName = hubMap.layers.decor.tiles[tileY][tileX];

        if (tileName && !interactionIds.has(tileName)) {
          pushDecorSprite(sprites, tileName, tileX, tileY, elapsedMs);
        }
      }
    }

    pushInteractionSprites(sprites, elapsedMs);
    pushPlayerSprite(sprites, player, elapsedMs);

    return sprites;
  }

  function pushInteractionSprites(sprites, elapsedMs) {
    for (const interaction of hubMap.interactions) {
      if (interaction.id === "portal") {
        pushPortalSprites(sprites, interaction);
      } else if (interaction.id === "merchant") {
        pushFootAlignedTileSprite(sprites, "lizard_m_idle_anim_f0", interaction.tileX, interaction.tileY, {
          frame: animations.merchantIdle.frameAt(elapsedMs),
          castsShadow: true,
        });
      } else if (interaction.id === "noticeboard") {
        pushFootAlignedTileSprite(sprites, "wall_banner_red", interaction.tileX, interaction.tileY);
      } else if (interaction.id === "identity") {
        pushFootAlignedTileSprite(sprites, "wall_banner_green", interaction.tileX, interaction.tileY);
      } else if (interaction.id === "classStation") {
        pushFootAlignedTileSprite(sprites, "weapon_regular_sword", interaction.tileX, interaction.tileY, {
          castsShadow: true,
        });
      }
    }
  }

  function pushPortalSprites(sprites, interaction) {
    const portalX = interaction.tileX * TILE_SIZE;
    const portalY = interaction.tileY * TILE_SIZE;
    const portalSortY = interaction.tileY * TILE_SIZE - 1;

    pushSprite(sprites, "doors_leaf_closed", portalX, portalY, { sortY: portalSortY });
    pushSprite(sprites, "doors_frame_left", portalX - TILE_SIZE, portalY, { sortY: portalSortY });
    pushSprite(sprites, "doors_frame_right", portalX + TILE_SIZE * 2, portalY, { sortY: portalSortY });
    pushSprite(sprites, "doors_frame_top", portalX, portalY - TILE_SIZE, { sortY: portalSortY });
  }

  function pushDecorSprite(sprites, tileName, tileX, tileY, elapsedMs) {
    if (tileName === "wall_fountain_mid_blue_anim") {
      pushFootAlignedTileSprite(sprites, tileName, tileX, tileY, {
        frame: animations.fountainMidBlue.frameAt(elapsedMs),
      });
      return;
    }

    if (tileName === "wall_fountain_basin_blue_anim") {
      pushFootAlignedTileSprite(sprites, tileName, tileX, tileY, {
        frame: animations.fountainBasinBlue.frameAt(elapsedMs),
      });
      return;
    }

    pushFootAlignedTileSprite(sprites, tileName, tileX, tileY, {
      castsShadow: tileName === "column",
    });
  }

  function pushPlayerSprite(sprites, player, elapsedMs) {
    const spriteVariant = getPlayerSpriteVariant?.() ?? "knight_m";
    const animation = characterAnimations.animationFor(spriteVariant, player.moving ? "run" : "idle");
    const frame = animation.frameAt(elapsedMs);
    const frameBox = getFrameBox(frame);
    const footY = player.y + TILE_SIZE / 2;

    sprites.push({
      image: tileset.image,
      frame,
      x: Math.round(player.x - frameBox.width / 2),
      y: Math.round(footY - frameBox.height),
      sortY: footY,
      flipX: player.facing === "left",
      castsShadow: true,
    });
  }

  function pushFootAlignedTileSprite(sprites, frameName, tileX, tileY, overrides = {}) {
    const { frame: overrideFrame, ...spriteOverrides } = overrides;
    const frame = overrideFrame ?? getFrame(frameName);
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
      ...spriteOverrides,
    });
  }

  function pushSprite(sprites, frameName, x, y, overrides = {}) {
    const frame = getFrame(frameName);
    if (!frame) {
      return;
    }
    sprites.push({
      image: tileset.image,
      frame,
      x,
      y,
      sortY: overrides.sortY ?? y,
    });
  }

  function getFrame(frameName) {
    return frames?.[frameName] ?? null;
  }

  return { createSceneSprites };
}

function createAnimations(frames) {
  return {
    merchantIdle: createAnimation({ frames: getFrames(frames, "lizard_m_idle_anim", 4), fps: CHARACTER_FPS }),
    fountainMidBlue: createAnimation({ frames: getFrames(frames, "wall_fountain_mid_blue_anim", 3), fps: FOUNTAIN_FPS }),
    fountainBasinBlue: createAnimation({ frames: getFrames(frames, "wall_fountain_basin_blue_anim", 3), fps: FOUNTAIN_FPS }),
  };
}
