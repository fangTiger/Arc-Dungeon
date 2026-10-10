import {
  SUPPORTED_LANGUAGES,
  createTranslator,
  normalizeLanguage,
} from "./i18n/index.js";

const ARCHETYPE_KEYS = Object.freeze({
  architect: "persona.archetype.architect",
  scholar: "persona.archetype.scholar",
  trader: "persona.archetype.trader",
  vanguard: "persona.archetype.vanguard",
  strategist: "persona.archetype.strategist",
});
const SOCIAL_ROLE_KEYS = Object.freeze({
  organizer: "persona.social.organizer",
  guide: "persona.social.guide",
  motivator: "persona.social.motivator",
  observer: "persona.social.observer",
});
const EXPRESSION_KEYS = Object.freeze({
  cautious: "persona.expression.cautious",
  longForm: "persona.expression.longForm",
  questioning: "persona.expression.questioning",
  concise: "persona.expression.concise",
});

export function createPersonaPresentation(features = {}, options = {}) {
  const language = normalizeLanguage(options.language);
  const t = options.t ?? createTranslator(language);
  const archetype = createArchetype(features, t);

  return {
    soulArchetype: archetype.name,
    rialoTitle: archetype.title,
    factionAffinity: createFactionAffinity(features, t),
    recommendedRoles: archetype.roles,
    npcFirstImpression: createNpcFirstImpression(features, t),
    narrativeSummary: createNarrativeSummary(features, archetype, t),
  };
}

function createArchetype(features, t) {
  const prefix = ARCHETYPE_KEYS[chooseArchetypeId(features)];
  return {
    name: t(`${prefix}.name`),
    title: t(`${prefix}.title`),
    roles: [t(`${prefix}.role1`), t(`${prefix}.role2`)],
  };
}

function chooseArchetypeId(features) {
  const interests = features.interestSpectrum ?? {};
  const topInterest = chooseMaxKey(interests, "groupPlay");
  if (matchesLocalizedValue(features.socialRole, SOCIAL_ROLE_KEYS.organizer)
    && (interests.technology ?? 0) >= (interests.lore ?? 0)) {
    return "architect";
  }
  if (topInterest === "lore") return "scholar";
  if (topInterest === "trade") return "trader";
  if (topInterest === "combat") return "vanguard";
  return "strategist";
}

function createFactionAffinity(features, t) {
  const interests = features.interestSpectrum ?? {};
  const council = 40 + Math.min((interests.technology ?? 0) * 4 + (interests.lore ?? 0) * 2, 26);
  const guild = 20 + Math.min((interests.groupPlay ?? 0) * 2 + (interests.trade ?? 0) * 3, 20);
  const forest = Math.max(10, 100 - council - guild);
  return [
    { faction: t("persona.faction.council"), score: council },
    { faction: t("persona.faction.guild"), score: guild },
    { faction: t("persona.faction.forest"), score: forest },
  ];
}

function createNpcFirstImpression(features, t) {
  if ((features.confidence ?? 0) < 0.5) {
    return t("persona.impression.lowConfidence");
  }
  if (matchesLocalizedValue(features.socialRole, SOCIAL_ROLE_KEYS.organizer)) {
    return t("persona.impression.organizer");
  }
  return t("persona.impression.default");
}

function createNarrativeSummary(features, archetype, t) {
  if ((features.confidence ?? 0) < 0.5) {
    return t("persona.narrative.lowConfidence", { archetype: archetype.name });
  }
  return t("persona.narrative.confident", {
    archetype: archetype.name,
    expressionStyle: localizeKnownValue(
      features.expressionStyle,
      EXPRESSION_KEYS,
      "cautious",
      t,
    ),
    socialRole: localizeKnownValue(
      features.socialRole,
      SOCIAL_ROLE_KEYS,
      "observer",
      t,
    ),
  });
}

function localizeKnownValue(value, keys, fallback, t) {
  const matchingEntry = Object.entries(keys).find(([, key]) => (
    matchesLocalizedValue(value, key)
  ));
  return t(matchingEntry?.[1] ?? keys[fallback]);
}

function matchesLocalizedValue(value, key) {
  return SUPPORTED_LANGUAGES.some((language) => (
    createTranslator(language)(key) === value
  ));
}

function chooseMaxKey(scores, fallback) {
  let selected = fallback;
  let selectedScore = -Infinity;
  for (const [key, value] of Object.entries(scores ?? {})) {
    if (value > selectedScore) {
      selected = key;
      selectedScore = value;
    }
  }
  return selected;
}
