const ANIMATION_ROWS = {
  idle_down: 0,
  idle_right: 1,
  idle_up: 2,
  walk_down: 3,
  walk_right: 4,
  walk_up: 5,
  atk_down: 6,
  atk_right: 7,
  atk_up: 8,
};

const BODY_ANCHOR = { x: -16, y: -25 };
const BODY_SOURCE_OFFSET = { x: -8, y: -16 };
const WEAPON_SOURCE_OFFSET = { x: -16, y: -24 };

const BODY_LAYERS = [
  { asset: "player", frameWidth: 32, frameHeight: 32, offsetX: -8, offsetY: -16 },
  { asset: "legplates", frameWidth: 32, frameHeight: 32, offsetX: -8, offsetY: -16 },
  { asset: "chestplate", frameWidth: 32, frameHeight: 32, offsetX: -8, offsetY: -16 },
  { asset: "helmet", frameWidth: 32, frameHeight: 32, offsetX: -8, offsetY: -16 },
];

const WEAPON_LAYER = {
  asset: "sword",
  frameWidth: 48,
  frameHeight: 48,
  offsetX: WEAPON_SOURCE_OFFSET.x,
  offsetY: WEAPON_SOURCE_OFFSET.y,
};

const NPC_FRAME_SPECS = {
  guard: {
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 2,
  },
  blacksmith: {
    frameWidth: 32,
    frameHeight: 38,
    frameCount: 5,
  },
};

export const scenicProps = [
  { id: "town-chest", kind: "object", asset: "reinforcedChest", x: 500, y: 470, width: 16, height: 16, scale: 2 },
  { id: "town-locker", kind: "object", asset: "footlocker", x: 115, y: 468, width: 16, height: 16, scale: 1.9 },
  { id: "town-berries-left", kind: "bush", asset: "blueberryBush", x: 92, y: 502, width: 24, height: 24, scale: 1.7 },
  { id: "town-berries-right", kind: "bush", asset: "raspberryBush", x: 704, y: 496, width: 24, height: 24, scale: 1.65 },
  { id: "town-old-oak", kind: "tree", asset: "oak3", x: 704, y: 520, width: 128, height: 96, scale: 1.25 },
  { id: "grass-bush-1", kind: "bush", asset: "blueberryBush", x: 875, y: 255, width: 24, height: 24, scale: 1.6 },
  { id: "grass-bush-2", kind: "bush", asset: "raspberryBush", x: 1070, y: 508, width: 24, height: 24, scale: 1.55 },
  { id: "grass-oak", kind: "tree", asset: "oak4", x: 1042, y: 520, width: 96, height: 80, scale: 1.2 },
  { id: "forest-cache", kind: "object", asset: "reinforcedChest", x: 980, y: 470, width: 16, height: 16, scale: 2.15 },
  { id: "forest-oak-1", kind: "tree", asset: "oak3", x: 1290, y: 232, width: 128, height: 96, scale: 1.34 },
  { id: "forest-oak-2", kind: "tree", asset: "oak5", x: 1418, y: 178, width: 128, height: 96, scale: 1.32 },
  { id: "forest-oak-3", kind: "tree", asset: "oak4", x: 1496, y: 396, width: 96, height: 80, scale: 1.28 },
  { id: "forest-spruce-1", kind: "tree", asset: "spruce", x: 1612, y: 470, width: 64, height: 80, scale: 1.5 },
  { id: "forest-berries-1", kind: "bush", asset: "blueberryBush", x: 1316, y: 532, width: 24, height: 24, scale: 1.75 },
  { id: "forest-berries-2", kind: "bush", asset: "raspberryBush", x: 1502, y: 536, width: 24, height: 24, scale: 1.75 },
  { id: "mine-locker", kind: "object", asset: "footlocker", x: 1894, y: 714, width: 16, height: 16, scale: 2 },
  { id: "mine-cache", kind: "object", asset: "reinforcedChest", x: 1935, y: 660, width: 16, height: 16, scale: 2.2 },
  { id: "mine-spruce", kind: "tree", asset: "spruce", x: 1704, y: 742, width: 64, height: 80, scale: 1.35 },
  { id: "mine-berries", kind: "bush", asset: "blueberryBush", x: 1998, y: 730, width: 24, height: 24, scale: 1.55 },
];

export function getCharacterFrameSpec({ facing, moving = false, attacking = false }) {
  const direction = getKaetramDirection(facing);
  const action = attacking ? "atk" : moving ? "walk" : "idle";
  const animation = `${action}_${direction.animationDirection}`;

  return {
    animation,
    row: ANIMATION_ROWS[animation],
    frameCount: 4,
    flipX: direction.flipX,
  };
}

export function getPaperDollLayers({ facing, moving = false, attacking = false }) {
  const frameSpec = getCharacterFrameSpec({ facing, moving, attacking });

  return [...BODY_LAYERS, WEAPON_LAYER].map((layer) => ({
    ...layer,
    ...frameSpec,
    drawOffsetX: getDrawOffsetX(layer),
    drawOffsetY: getDrawOffsetY(layer),
  }));
}

export function getSpriteDrawBox(layer, anchor, scale) {
  const drawOffsetX = layer.drawOffsetX ?? getDrawOffsetX(layer);
  const drawOffsetY = layer.drawOffsetY ?? getDrawOffsetY(layer);
  const width = roundPixelValue(layer.frameWidth * scale);
  const height = roundPixelValue(layer.frameHeight * scale);
  const x = layer.flipX
    ? anchor.x - roundPixelValue((drawOffsetX + layer.frameWidth) * scale)
    : anchor.x + roundPixelValue(drawOffsetX * scale);

  return {
    x,
    y: anchor.y + roundPixelValue(drawOffsetY * scale),
    width,
    height,
  };
}

export function splitScenicPropsByDepth(props, anchorY, padding = 6) {
  return props.reduce(
    (bands, prop) => {
      if (prop.y <= anchorY + padding) {
        bands.background.push(prop);
      } else {
        bands.foreground.push(prop);
      }

      return bands;
    },
    { background: [], foreground: [] },
  );
}

export function getNpcFrameSpec(key) {
  return (
    NPC_FRAME_SPECS[key] ?? {
      frameWidth: 16,
      frameHeight: 16,
      frameCount: 1,
    }
  );
}

function getKaetramDirection(facing) {
  if (Math.abs(facing.x) > Math.abs(facing.y)) {
    return {
      animationDirection: "right",
      flipX: facing.x < 0,
    };
  }

  return {
    animationDirection: facing.y < 0 ? "up" : "down",
    flipX: false,
  };
}

function getDrawOffsetX(layer) {
  if (layer.asset !== "sword") {
    return BODY_ANCHOR.x;
  }

  return BODY_ANCHOR.x + WEAPON_SOURCE_OFFSET.x - BODY_SOURCE_OFFSET.x;
}

function getDrawOffsetY(layer) {
  if (layer.asset !== "sword") {
    return BODY_ANCHOR.y;
  }

  return BODY_ANCHOR.y + WEAPON_SOURCE_OFFSET.y - BODY_SOURCE_OFFSET.y;
}

function roundPixelValue(value) {
  return Math.round(value * 100) / 100;
}
