export const ENEMY_TYPES = Object.freeze({
  goblin: createEnemyType("goblin", 44, 8, 58, 210, 24, 420),
  imp: createEnemyType("imp", 36, 9, 66, 220, 26, 380),
  skelet: createEnemyType("skelet", 54, 10, 52, 230, 28, 460),
  tiny_zombie: createEnemyType("tiny_zombie", 34, 6, 40, 150, 22, 520),
  masked_orc: createEnemyType("masked_orc", 72, 12, 48, 240, 30, 560),
  orc_warrior: createEnemyType("orc_warrior", 92, 15, 44, 250, 32, 620),
  orc_shaman: createEnemyType("orc_shaman", 68, 14, 42, 260, 120, 700),
  wogol: createEnemyType("wogol", 110, 17, 38, 270, 34, 680),
  chort: createEnemyType("chort", 130, 19, 46, 290, 36, 720),
});

export const ENEMY_DEPTH_WEIGHT_TIERS = Object.freeze([
  Object.freeze({
    minDepth: 1,
    weights: Object.freeze({ tiny_zombie: 5, goblin: 4, imp: 2 }),
  }),
  Object.freeze({
    minDepth: 5,
    weights: Object.freeze({ tiny_zombie: 3, goblin: 5, imp: 4, skelet: 2 }),
  }),
  Object.freeze({
    minDepth: 10,
    weights: Object.freeze({
      goblin: 3,
      imp: 4,
      skelet: 4,
      masked_orc: 3,
      orc_shaman: 1,
    }),
  }),
  Object.freeze({
    minDepth: 16,
    weights: Object.freeze({
      imp: 2,
      skelet: 4,
      masked_orc: 4,
      orc_warrior: 3,
      orc_shaman: 2,
      wogol: 1,
    }),
  }),
  Object.freeze({
    minDepth: 23,
    weights: Object.freeze({
      masked_orc: 2,
      orc_warrior: 4,
      orc_shaman: 3,
      wogol: 3,
      chort: 2,
    }),
  }),
]);

export function enemyWeightsForDepth(depth) {
  const normalizedDepth = Math.max(1, Math.floor(depth));
  let selected = ENEMY_DEPTH_WEIGHT_TIERS[0];

  for (const tier of ENEMY_DEPTH_WEIGHT_TIERS) {
    if (normalizedDepth >= tier.minDepth) {
      selected = tier;
    }
  }

  return selected.weights;
}

export function pickEnemyTypeForDepth(depth, rng) {
  if (!rng || typeof rng.next !== "function") {
    throw new TypeError("敌人生成权重必须传入 rng");
  }

  const weights = enemyWeightsForDepth(depth);
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng.next() * totalWeight;

  for (const [id, weight] of entries) {
    if (roll < weight) {
      return ENEMY_TYPES[id];
    }

    roll -= weight;
  }

  return ENEMY_TYPES[entries.at(-1)[0]];
}

function createEnemyType(
  id,
  baseHp,
  attack,
  speed,
  detectRadius,
  attackRange,
  attackWindupMs,
) {
  return Object.freeze({
    id,
    baseHp,
    attack,
    speed,
    detectRadius,
    attackRange,
    attackWindupMs,
    framePrefix: id,
    spritePrefix: id,
  });
}
