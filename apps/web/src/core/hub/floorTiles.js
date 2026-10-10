import { createRng, hashSeed } from "../rng.js";

export const HUB_FLOOR_WEIGHTS = Object.freeze([
  Object.freeze({ name: "floor_1", weight: 75 }),
  ...Array.from({ length: 7 }, (_, index) =>
    Object.freeze({ name: `floor_${index + 2}`, weight: 25 / 7 }),
  ),
]);

export function buildHubFloorTiles({ width, height, seed }) {
  validateSize(width, height);
  const rng = createRng(hashSeed(seed));

  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => pickWeightedFloorTile(rng)),
  );
}

export function pickWeightedFloorTile(rng, weights = HUB_FLOOR_WEIGHTS) {
  if (!rng || typeof rng.next !== "function") {
    throw new TypeError("加权地板选择需要确定性随机源");
  }

  const totalWeight = weights.reduce((total, entry) => total + entry.weight, 0);

  if (totalWeight <= 0) {
    throw new RangeError("加权地板表总权重必须大于 0");
  }

  let cursor = rng.next() * totalWeight;

  for (const entry of weights) {
    if (entry.weight <= 0) {
      continue;
    }

    cursor -= entry.weight;
    if (cursor < 0) {
      return entry.name;
    }
  }

  return weights.at(-1).name;
}

function validateSize(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new TypeError("地板尺寸必须是整数");
  }

  if (width <= 0 || height <= 0) {
    throw new RangeError("地板尺寸必须大于 0");
  }
}
