export const HUB_BLOCKING_DECOR_TILES = freezeTiles([
  [2, 2],
]);

const DECOR_SPRITE_SIZES = Object.freeze({
  merchant: Object.freeze([16, 28]),
  classStation: Object.freeze([10, 21]),
  weapon_regular_sword: Object.freeze([10, 21]),
  weapon_bow: Object.freeze([14, 26]),
  weapon_axe: Object.freeze([9, 21]),
  weapon_spear: Object.freeze([6, 30]),
});

const DECOR_PLACEMENTS = Object.freeze([
  // 既有墙面与交互物。
  [2, 0, "wall_fountain_top_2"],
  [2, 1, "wall_fountain_mid_blue_anim"],
  [2, 2, "wall_fountain_basin_blue_anim"],
  [6, 1, "wall_banner_yellow"],
  [13, 1, "identity"],
  [16, 1, "noticeboard"],
  [4, 3, "merchant"],
  [5, 7, "classStation"],

  // 商人区保留四种药剂，清空妨碍走动的货箱。
  [5, 3, "flask_red"],
  [2, 4, "flask_blue"],
  [5, 4, "flask_green"],
  [2, 5, "flask_yellow"],

  // 下方靠墙只保留左侧武器架，作为职业站点陈设。
  [4, 8, "weapon_regular_sword"],
  [5, 8, "weapon_bow"],
  [6, 8, "weapon_axe"],
  [7, 8, "weapon_spear"],

  // 四角只保留骷髅，中央集合区保持完整空地。
  [1, 2, "skull"],
  [18, 3, "skull"],
  [1, 8, "skull"],
  [18, 8, "skull"],
]);

export function buildHubDecorTiles({ width, height }) {
  const tiles = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => null),
  );

  for (const [tileX, tileY, frame] of DECOR_PLACEMENTS) {
    tiles[tileY][tileX] = frame;
  }

  return tiles;
}

/**
 * 按实际脚底对齐尺寸计算陈设精灵矩形，供标签布局避让。
 */
export function calculateHubDecorSpriteRects(map) {
  const rects = [];

  map.layers.decor.tiles.forEach((row, tileY) => row.forEach((frame, tileX) => {
    if (!frame) {
      return;
    }

    const [width, height] = DECOR_SPRITE_SIZES[frame] ?? [map.tileSize, map.tileSize];
    rects.push(Object.freeze({
      frame,
      x: Math.round(tileX * map.tileSize + (map.tileSize - width) / 2),
      y: Math.round((tileY + 1) * map.tileSize - height),
      width,
      height,
    }));
  }));

  return Object.freeze(rects);
}

function freezeTiles(tiles) {
  return Object.freeze(tiles.map((tile) => Object.freeze(tile)));
}
