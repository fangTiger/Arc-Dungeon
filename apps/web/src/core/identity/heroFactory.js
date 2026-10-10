import { createRng, hashSeed } from "../rng.js";
import { createTranslator, translate } from "../i18n/index.js";

export const PLAYER_CLASS_IDS = Object.freeze(["knight", "wizzard"]);
export const PIXEL_HERO_SPRITE_VARIANTS = Object.freeze([
  "knight_m",
  "knight_f",
  "wizzard_m",
  "wizzard_f",
]);

const DEFAULT_DISCORD_ID = "guest";
const KNIGHT_HINTS = Object.freeze([
  "战团",
  "先锋",
  "前线",
  "守卫",
  "护卫",
  "骑士",
  "剑士",
  "战士",
  "武者",
  "号角",
  "深林旅团",
  "边境行会",
]);

const WIZZARD_HINTS = Object.freeze([
  "符文",
  "秘闻",
  "学者",
  "法术",
  "魔法",
  "军师",
  "策略",
  "策士",
  "向导",
  "记录",
  "工匠",
  "主城议会",
]);

export function createPixelHero({ discordId, displayName, avatarUrl, personaCard, language, t } = {}) {
  const translateText = t ?? (language ? createTranslator(language) : translate);
  const defaults = createDefaultHeroText(translateText);
  const normalizedDiscordId = normalizeDiscordId(discordId ?? personaCard?.userId);
  const normalizedDisplayName = normalizeOptionalText(displayName);
  const hasDiscordIdentity = Boolean(normalizedDiscordId && normalizedDisplayName);
  const identitySeed = normalizedDiscordId || DEFAULT_DISCORD_ID;
  const recommendedClassId = recommendClassFromPersona(personaCard);
  const spriteVariant = selectSpriteVariant(identitySeed, recommendedClassId);
  const hero = {
    source: hasDiscordIdentity ? "Discord" : defaults.source,
    discordId: hasDiscordIdentity ? normalizedDiscordId : DEFAULT_DISCORD_ID,
    displayName: hasDiscordIdentity ? normalizedDisplayName : defaults.displayName,
    avatarUrl: hasDiscordIdentity ? normalizeAvatarUrl(avatarUrl) : null,
    title: normalizeText(personaCard?.rialoTitle, defaults.title),
    archetype: normalizeText(personaCard?.soulArchetype, defaults.archetype),
    spriteVariant,
    recommendedClassId,
    selectedClassId: recommendedClassId,
    factionAffinity: normalizeFactionAffinity(personaCard?.factionAffinity, defaults),
    recommendedRoles: normalizeStringList(personaCard?.recommendedRoles, defaults.recommendedRoles),
    npcFirstImpression: normalizeText(personaCard?.npcFirstImpression, defaults.npcFirstImpression),
    narrativeSummary: normalizeText(personaCard?.narrativeSummary, defaults.narrativeSummary),
    displayOnly: true,
  };

  return normalizePixelHeroIdentity(hero, translateText);
}

export function selectPixelHeroClass(heroIdentity, classId) {
  const hero = normalizePixelHeroIdentity(heroIdentity) ?? createPixelHero();
  const selectedClassId = normalizeClassId(classId, hero.recommendedClassId);
  const gender = hero.spriteVariant.endsWith("_f") ? "f" : "m";

  return normalizePixelHeroIdentity({
    ...hero,
    selectedClassId,
    spriteVariant: `${selectedClassId}_${gender}`,
  });
}

export function normalizePixelHeroIdentity(identity, t = translate) {
  if (!isRecord(identity)) {
    return null;
  }

  const defaults = createDefaultHeroText(t);
  const recommendedClassId = normalizeClassId(identity.recommendedClassId, "knight");
  const selectedClassId = normalizeClassId(identity.selectedClassId, recommendedClassId);
  const spriteVariant = normalizeSpriteVariant(identity.spriteVariant, selectedClassId);

  return {
    source: normalizeText(identity.source, defaults.source),
    discordId: normalizeText(identity.discordId, DEFAULT_DISCORD_ID),
    displayName: normalizeText(identity.displayName, defaults.displayName),
    avatarUrl: normalizeAvatarUrl(identity.avatarUrl),
    title: normalizeText(identity.title, defaults.title),
    archetype: normalizeText(identity.archetype, defaults.archetype),
    spriteVariant,
    recommendedClassId,
    selectedClassId,
    factionAffinity: normalizeStringList(identity.factionAffinity, defaults.factionAffinity),
    recommendedRoles: normalizeStringList(identity.recommendedRoles, defaults.recommendedRoles),
    npcFirstImpression: normalizeText(identity.npcFirstImpression, defaults.npcFirstImpression),
    narrativeSummary: normalizeText(identity.narrativeSummary, defaults.narrativeSummary),
    displayOnly: true,
  };
}

export function recommendClassFromPersona(personaCard = {}) {
  const factionNames = normalizeFactionAffinity(personaCard?.factionAffinity);
  const roleTexts = normalizeStringList(personaCard?.recommendedRoles, []);
  const texts = [...roleTexts, ...factionNames, personaCard?.soulArchetype, personaCard?.rialoTitle];
  const knightScore = countHints(texts, KNIGHT_HINTS);
  const wizzardScore = countHints(texts, WIZZARD_HINTS);

  /*
   * 映射规则：
   * - recommendedRoles 是画像对玩家身份倾向的直接描述，命中“先锋/前线/守卫”等词视为 knight。
   * - recommendedRoles 或阵营文本命中“符文/秘闻/学者/军师/策略”等词视为 wizzard。
   * - factionAffinity 只读取阵营名称，不读取 score；分数仍只属于画像展示，不进入强度或奖励。
   * - 无明确倾向时使用 knight 作为保守默认职业，保证缺省输入可以直接游玩。
   */
  if (knightScore > wizzardScore) {
    return "knight";
  }
  if (wizzardScore > knightScore) {
    return "wizzard";
  }

  return "knight";
}

function selectSpriteVariant(discordId, classId) {
  const normalizedClassId = normalizeClassId(classId, "knight");
  const rng = createRng(hashSeed(`pixel-hero:sprite:${discordId || DEFAULT_DISCORD_ID}`));
  const gender = rng.pick(["m", "f"]);
  return `${normalizedClassId}_${gender}`;
}

function countHints(texts, hints) {
  return texts.reduce((total, text) => {
    const normalized = String(text ?? "").toLowerCase();
    return total + hints.filter((hint) => normalized.includes(hint.toLowerCase())).length;
  }, 0);
}

function normalizeFactionAffinity(factionAffinity, defaults = createDefaultHeroText(translate)) {
  const factions = (Array.isArray(factionAffinity) ? factionAffinity : [])
    .map((entry) => normalizeText(isRecord(entry) ? entry.faction : entry, ""))
    .filter(Boolean);
  return factions.length > 0 ? [...new Set(factions)] : [...defaults.factionAffinity];
}

function normalizeStringList(value, fallback) {
  const list = (Array.isArray(value) ? value : [])
    .map((item) => normalizeText(item, ""))
    .filter(Boolean);
  return list.length > 0 ? [...new Set(list)] : [...fallback];
}

function normalizeSpriteVariant(value, selectedClassId) {
  if (PIXEL_HERO_SPRITE_VARIANTS.includes(value)) {
    return value;
  }
  return `${normalizeClassId(selectedClassId, "knight")}_m`;
}

function normalizeClassId(value, fallback) {
  return PLAYER_CLASS_IDS.includes(value) ? value : fallback;
}

function normalizeDiscordId(value) {
  const text = String(value ?? "").trim();
  return /^\d{1,32}$/.test(text) ? text : "";
}

function normalizeAvatarUrl(value) {
  const text = normalizeOptionalText(value);
  return text && /^https?:\/\//i.test(text) ? text : null;
}

function normalizeOptionalText(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeText(value, fallback) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function createDefaultHeroText(t) {
  return {
    displayName: t("persona.default.displayName"),
    title: t("persona.default.title"),
    archetype: t("persona.default.archetype"),
    factionAffinity: [t("persona.default.faction")],
    recommendedRoles: [t("persona.default.role")],
    npcFirstImpression: t("persona.default.impression"),
    narrativeSummary: t("persona.default.narrative"),
    source: t("persona.default.source"),
  };
}
