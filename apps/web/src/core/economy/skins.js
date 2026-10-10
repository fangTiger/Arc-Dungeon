import { translate } from "../i18n/index.js";

export const SKIN_BOX_TOKEN_COST = 100;

export const SKIN_RARITY_PROBABILITIES = Object.freeze({
  common: 0.68,
  rare: 0.22,
  precious: 0.08,
  chosen: 0.02,
});

export const SKIN_RARITY_LABELS = createSkinRarityLabels();

const SKIN_METADATA = Object.freeze([
  ["common-iron-guard", "common"],
  ["common-ash-runner", "common"],
  ["common-moss-cloak", "common"],
  ["common-lantern-squire", "common"],
  ["rare-crimson-duelist", "rare"],
  ["rare-sapphire-ward", "rare"],
  ["rare-moonlit-archivist", "rare"],
  ["precious-starforged-vanguard", "precious"],
  ["precious-voidglass-magus", "precious"],
  ["chosen-rialo-oracle", "chosen"],
]);

export const SKIN_CATALOG = createSkinCatalog();

export function createSkinRarityLabels(t = translate) {
  return Object.freeze(Object.fromEntries(
    Object.keys(SKIN_RARITY_PROBABILITIES).map((rarity) => [
      rarity,
      t(`skin.rarity.${rarity}`),
    ]),
  ));
}

export function createSkinCatalog(t = translate) {
  return Object.freeze(SKIN_METADATA.map(([id, rarity]) => createSkin(id, rarity, t)));
}

export function localizeSkin(skin, t = translate) {
  if (!skin?.id) return skin;
  return {
    ...skin,
    name: t(`skin.${skin.id}.name`),
    rarityLabel: t(`skin.rarity.${skin.rarity ?? "common"}`),
  };
}

export function exchangeSkinBox({ tokens, boxCount = 0, rng } = {}) {
  const currentTokens = normalizeTokenCount(tokens);
  const currentBoxCount = normalizeTokenCount(boxCount);

  if (currentTokens < SKIN_BOX_TOKEN_COST) {
    return {
      ok: false,
      reason: "insufficient-tokens",
      tokens: currentTokens,
      required: SKIN_BOX_TOKEN_COST,
      boxCount: currentBoxCount,
    };
  }

  assertRng(rng);

  return {
    ok: true,
    cost: SKIN_BOX_TOKEN_COST,
    tokens: currentTokens - SKIN_BOX_TOKEN_COST,
    remainingTokens: currentTokens - SKIN_BOX_TOKEN_COST,
    boxCount: currentBoxCount + 1,
    box: createSkinBox(rng),
  };
}

export function openSkinBox({ boxCount = 0, tokens = 0, rng } = {}) {
  const currentBoxCount = normalizeTokenCount(boxCount);
  const currentTokens = normalizeTokenCount(tokens);

  if (currentBoxCount < 1) {
    return {
      ok: false,
      reason: "no-skin-box",
      tokens: currentTokens,
      boxCount: currentBoxCount,
    };
  }

  assertRng(rng);

  const rarity = rollRarity(rng);
  const skin = rollSkinByRarity(rarity, rng);

  return {
    ok: true,
    tokens: currentTokens,
    boxCount: currentBoxCount - 1,
    skin,
  };
}

export function craftSkin({ tokens, rng } = {}) {
  const exchanged = exchangeSkinBox({ tokens, boxCount: 0, rng });

  if (!exchanged.ok) {
    return exchanged;
  }

  const opened = openSkinBox({
    tokens: exchanged.tokens,
    boxCount: exchanged.boxCount,
    rng,
  });

  return {
    ...opened,
    cost: exchanged.cost,
    remainingTokens: opened.tokens,
    box: exchanged.box,
  };
}

export function rollRarity(rng) {
  assertRng(rng);

  /*
   * 四档概率以普通为主，越稀有概率越低。
   * 使用传入 rng 的单次 `next()`，避免任何全局随机源，保证同 seed 可复现。
   */
  const roll = rng.next();
  let cursor = 0;

  for (const [rarity, probability] of Object.entries(SKIN_RARITY_PROBABILITIES)) {
    cursor += probability;

    if (roll < cursor) {
      return rarity;
    }
  }

  return "chosen";
}

export function skinsByRarity(rarity) {
  return SKIN_CATALOG.filter((skin) => skin.rarity === rarity);
}

function rollSkinByRarity(rarity, rng) {
  const pool = skinsByRarity(rarity);

  if (pool.length === 0) {
    throw new RangeError(`缺少稀有度皮肤: ${rarity}`);
  }

  return cloneSkin(rng.pick(pool));
}

function createSkin(id, rarity, t) {
  return Object.freeze({
    id,
    name: t(`skin.${id}.name`),
    rarity,
    rarityLabel: t(`skin.rarity.${rarity}`),
  });
}

function cloneSkin(skin) {
  return {
    id: skin.id,
    name: skin.name,
    rarity: skin.rarity,
    rarityLabel: skin.rarityLabel,
  };
}

function createSkinBox(rng) {
  return {
    id: `skin-box-${rng.int(0, 0x100000000).toString(16).padStart(8, "0")}`,
  };
}

function normalizeTokenCount(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function assertRng(rng) {
  if (
    !rng ||
    typeof rng.next !== "function" ||
    typeof rng.int !== "function" ||
    typeof rng.pick !== "function"
  ) {
    throw new TypeError("盲盒必须传入可复现 rng");
  }
}
