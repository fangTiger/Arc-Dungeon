import { parseTileList } from "../../core/art/atlasIndex.js";
import { createPlaceholderTileset } from "./placeholderTileset.js";

const ATLAS_URL = new URL("../../../assets/dungeon/0x72_DungeonTilesetII_v1.7.png", import.meta.url);
const TILE_LIST_URL = new URL("../../../assets/dungeon/tile_list_v1.7.txt", import.meta.url);
const COMBAT_SPRITE_PREFIXES = [
  "wizzard_m",
  "goblin",
  "imp",
  "skelet",
  "tiny_zombie",
  "masked_orc",
  "orc_warrior",
  "orc_shaman",
  "wogol",
  "chort",
];
const REQUIRED_FRAME_NAMES = [
  ...createNumberedNames("floor_", 1, 8),
  "wall_top_left",
  "wall_top_mid",
  "wall_top_right",
  "wall_left",
  "wall_mid",
  "wall_right",
  "wall_edge_top_left",
  "wall_edge_left",
  "wall_edge_bottom_left",
  "wall_edge_top_right",
  "wall_edge_right",
  "wall_edge_bottom_right",
  "doors_frame_left",
  "doors_frame_right",
  "doors_frame_top",
  "doors_leaf_closed",
  "chest_full_open_anim_f0",
  "flask_big_red",
  "flask_red",
  "floor_stairs",
  "wall_fountain_top_2",
  ...createAnimationNames("wall_fountain_mid_blue_anim", 3),
  ...createAnimationNames("wall_fountain_basin_blue_anim", 3),
  "wall_banner_yellow",
  "wall_banner_green",
  "wall_banner_red",
  "column",
  ...createAnimationNames("knight_m_idle_anim", 4),
  ...createAnimationNames("knight_m_run_anim", 4),
  ...COMBAT_SPRITE_PREFIXES.flatMap((prefix) => [
    ...createAnimationNames(`${prefix}_idle_anim`, 4),
    ...createAnimationNames(`${prefix}_run_anim`, 4),
  ]),
  ...createAnimationNames("lizard_m_idle_anim", 4),
];

export async function loadDungeonAtlas() {
  try {
    const [image, tileListText] = await Promise.all([
      loadImage(ATLAS_URL),
      loadText(TILE_LIST_URL),
    ]);
    const index = parseTileList(tileListText);
    const frames = createFrameMap(index);
    validateRequiredFrames(frames);

    return {
      image,
      index,
      frames,
    };
  } catch (error) {
    console.warn(`地下城图集加载失败，已降级为占位 tile：${getErrorMessage(error)}`);
    return createFallbackAtlas();
  }
}

function validateRequiredFrames(frames) {
  const missingNames = REQUIRED_FRAME_NAMES.filter((name) => !frames[name]);

  if (missingNames.length > 0) {
    throw new Error(`缺少大厅必需图集帧：${missingNames.join(", ")}`);
  }
}

function createFrameMap(index) {
  const frames = Object.fromEntries(index);
  return frames;
}

async function loadText(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`帧映射表请求失败：${response.status}`);
  }

  return response.text();
}

async function loadImage(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`主图集图片请求失败：${response.status}`);
  }

  const objectUrl = URL.createObjectURL(await response.blob());
  return loadImageFromObjectUrl(objectUrl);
}

function loadImageFromObjectUrl(objectUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    }, { once: true });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("主图集图片解码失败"));
    }, {
      once: true,
    });
    image.src = objectUrl;
  });
}

function createFallbackAtlas() {
  const placeholder = createPlaceholderTileset();
  const frames = { ...placeholder.tiles };

  aliasFrames(frames, "floor", ["floor_1", "floor_3", "floor_5", "floor_7"]);
  aliasFrames(frames, "floor_alt", ["floor_2", "floor_4", "floor_6", "floor_8"]);
  aliasFrames(frames, "wall_top", ["wall_top_left", "wall_top_mid", "wall_top_right"]);
  aliasFrames(frames, "wall_face", [
    "wall_left",
    "wall_mid",
    "wall_right",
  ]);
  aliasFrames(frames, "wall_corner_left", [
    "wall_edge_top_left",
    "wall_edge_left",
    "wall_edge_bottom_left",
  ]);
  aliasFrames(frames, "wall_corner_right", [
    "wall_edge_top_right",
    "wall_edge_right",
    "wall_edge_bottom_right",
  ]);
  aliasFrames(frames, "door_closed", [
    "doors_frame_left",
    "doors_frame_right",
    "doors_frame_top",
    "doors_leaf_closed",
  ]);
  aliasFrames(frames, "noticeboard", [
    "chest_full_open_anim_f0",
    "flask_big_red",
    "flask_red",
    "floor_stairs",
  ]);
  aliasFrames(frames, "merchant", createAnimationNames("lizard_m_idle_anim", 4));
  aliasFrames(frames, "hero", [
    ...createAnimationNames("knight_m_idle_anim", 4),
    ...createAnimationNames("knight_m_run_anim", 4),
    ...createAnimationNames("wizzard_m_idle_anim", 4),
    ...createAnimationNames("wizzard_m_run_anim", 4),
  ]);
  for (const prefix of COMBAT_SPRITE_PREFIXES.filter((prefix) => prefix !== "wizzard_m")) {
    aliasFrames(frames, "merchant", [
      ...createAnimationNames(`${prefix}_idle_anim`, 4),
      ...createAnimationNames(`${prefix}_run_anim`, 4),
    ]);
  }
  aliasFrames(frames, "noticeboard", [
    "wall_banner_yellow",
    "wall_banner_green",
    "wall_banner_red",
    "wall_fountain_top_2",
    ...createAnimationNames("wall_fountain_mid_blue_anim", 3),
    ...createAnimationNames("wall_fountain_basin_blue_anim", 3),
  ]);
  aliasFrames(frames, "merchant", ["column"]);

  return {
    image: placeholder.image,
    index: new Map(),
    frames,
  };
}

function aliasFrames(frames, sourceName, targetNames) {
  for (const targetName of targetNames) {
    frames[targetName] = frames[sourceName];
  }
}

function createAnimationNames(baseName, frameCount) {
  return Array.from({ length: frameCount }, (_, index) => `${baseName}_f${index}`);
}

function createNumberedNames(prefix, first, last) {
  return Array.from({ length: last - first + 1 }, (_, index) => `${prefix}${first + index}`);
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
