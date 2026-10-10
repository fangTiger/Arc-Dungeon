import {
  createPixelHero,
  normalizePixelHeroIdentity,
  selectPixelHeroClass,
} from "../../core/identity/heroFactory.js";
import { layoutEntryProfileText } from "../../core/ui/entryTextLayout.js";
import { calculatePanelLayout } from "../../core/ui/panelLayout.js";
import { wrapPixelText } from "../../core/ui/textLayout.js";
import { translate } from "../../core/i18n/index.js";

export const IDENTITY_PANEL_WIDTH = 300;
export const IDENTITY_PROFILE_TEXT_WIDTH = IDENTITY_PANEL_WIDTH - 28;

export const HERO_CLASS_LABELS = Object.freeze({
  knight: translate("class.label.knight"),
  wizzard: translate("class.label.wizzard"),
});

export function createHubIdentityFlow({
  getCachedEconomySnapshot,
  heroIdentity: runtimeIdentity,
  initialClassId = "knight",
  personaSource,
  measureChar,
  t = translate,
} = {}) {
  let mode = "closed";
  const initialIdentity = resolveInitialIdentity({
    runtimeIdentity,
    getCachedEconomySnapshot,
    t,
  });
  let currentRuntimeIdentity = normalizePixelHeroIdentity(runtimeIdentity);
  let selectedClassId = normalizeClassId(
    initialIdentity.selectedClassId ?? initialClassId,
  );
  let currentPersonaSource = normalizePersonaSource(personaSource);
  let profileLines = [];
  let selectedLineIndex = 0;
  refreshProfileLines({ reset: true });

  function open() {
    mode = "card";
    refreshProfileLines({ reset: true });
  }

  function close() {
    mode = "closed";
  }

  function update(input) {
    if (mode === "closed") {
      return;
    }
    if (input.wasPressed("cancel")) {
      close();
      return;
    }
    if (input.wasPressed("up")) {
      moveProfileWindow(-1);
    } else if (input.wasPressed("down")) {
      moveProfileWindow(1);
    }
  }

  function getCurrentIdentity() {
    const identity = currentRuntimeIdentity
      ?? getSavedIdentity()
      ?? initialIdentity;
    return selectPixelHeroClass(identity, selectedClassId);
  }

  function getSavedIdentity() {
    return normalizePixelHeroIdentity(
      getCachedEconomySnapshot?.()?.profile?.heroIdentity,
    );
  }

  function setSelectedClassId(classId) {
    selectedClassId = normalizeClassId(classId);
    refreshProfileLines();
    return selectedClassId;
  }

  function setHeroIdentity(heroIdentity, nextPersonaSource) {
    const normalizedIdentity = normalizePixelHeroIdentity(heroIdentity);
    if (!normalizedIdentity) {
      return getCurrentIdentity();
    }

    currentRuntimeIdentity = normalizedIdentity;
    selectedClassId = normalizeClassId(normalizedIdentity.selectedClassId);
    currentPersonaSource = normalizePersonaSource(nextPersonaSource);
    refreshProfileLines({ reset: true });
    return getCurrentIdentity();
  }

  function getViewModel() {
    const identity = getCurrentIdentity();
    const isGuest = isGuestIdentity(identity);
    const layout = createProfilePanelLayout(profileLines, selectedLineIndex);

    return {
      mode,
      statusText: createStatusText(isGuest, t),
      savePending: false,
      heroIdentity: identity,
      personaSourceLabel: sourceLabel(currentPersonaSource, t),
      profileLines,
      selectedLineIndex,
      scrollLineIndex: layout.visibleStart,
      profileLineCount: profileLines.length,
      footerText: t("hub.identity.footer"),
      recommendedClassLabel: labelForClass(identity.recommendedClassId, t),
      selectedClassLabel: labelForClass(identity.selectedClassId, t),
      alternateClassLabel: labelForClass(otherClassId(identity.selectedClassId), t),
      actions: [],
      selectedIndex: 0,
    };
  }

  function refreshProfileLines({ reset = false } = {}) {
    const identity = getCurrentIdentity();
    const isGuest = isGuestIdentity(identity);
    profileLines = createIdentityProfileLines({
      identity,
      isGuest,
      personaSource: currentPersonaSource,
      measureChar,
      t,
    });
    const layout = createProfilePanelLayout(profileLines, selectedLineIndex);
    const firstAnchor = Math.max(0, layout.visibleCount - 1);
    selectedLineIndex = reset
      ? Math.min(firstAnchor, Math.max(0, profileLines.length - 1))
      : clamp(selectedLineIndex, firstAnchor, Math.max(firstAnchor, profileLines.length - 1));
  }

  function moveProfileWindow(direction) {
    const layout = createProfilePanelLayout(profileLines, selectedLineIndex);
    const firstAnchor = Math.max(0, layout.visibleCount - 1);
    selectedLineIndex = clamp(
      selectedLineIndex + direction,
      firstAnchor,
      Math.max(firstAnchor, profileLines.length - 1),
    );
  }

  return {
    open,
    close,
    update,
    isOpen: () => mode !== "closed",
    getSavedIdentity,
    getSelectedIdentity: getCurrentIdentity,
    getSelectedClassId: () => selectedClassId,
    setSelectedClassId,
    setHeroIdentity,
    getViewModel,
  };
}

export function createIdentityProfileLines({
  identity,
  isGuest = false,
  personaSource,
  measureChar,
  t = translate,
}) {
  const wrapOptions = {
    maxWidth: IDENTITY_PROFILE_TEXT_WIDTH,
    cjkWidth: 10,
    latinWidth: 5,
    spaceWidth: 5,
    measureChar,
  };
  const profileLayout = layoutEntryProfileText({
    narrativeSummary: t("hub.identity.summary", { text: identity.narrativeSummary }),
    npcFirstImpression: t("hub.identity.impression", { text: identity.npcFirstImpression }),
    maxWidth: IDENTITY_PROFILE_TEXT_WIDTH,
    fontSize: 10,
    measureChar,
  });
  const lines = [
    ...wrapInfoLine(createStatusText(isGuest, t), "#96cdff", wrapOptions),
    ...wrapInfoLine(t("hub.identity.title", { text: identity.title }), "#ffe3a3", wrapOptions),
    ...wrapInfoLine(t("hub.identity.soul", { text: identity.archetype }), "#f7efd0", wrapOptions),
    ...wrapInfoLine(
      t("hub.identity.class", {
        recommended: labelForClass(identity.recommendedClassId, t),
        current: labelForClass(identity.selectedClassId, t),
      }),
      "#f7efd0",
      wrapOptions,
    ),
    ...wrapInfoLine(t("hub.identity.faction", { text: identity.factionAffinity.join(" / ") }), "#f7efd0", wrapOptions),
    ...profileLayout.narrativeSummary.lines.map((text) => ({ text, color: "#d8cfb8" })),
    ...profileLayout.npcFirstImpression.lines.map((text) => ({ text, color: "#d8cfb8" })),
    ...wrapInfoLine(t("hub.identity.source", { source: sourceLabel(personaSource, t) }), "#96cdff", wrapOptions),
  ];
  return lines;
}

export function labelForClass(classId, t = translate) {
  return classId === "wizzard" ? t("class.label.wizzard") : t("class.label.knight");
}

function resolveInitialIdentity({ runtimeIdentity, getCachedEconomySnapshot, t }) {
  return normalizePixelHeroIdentity(runtimeIdentity)
    ?? normalizePixelHeroIdentity(
      getCachedEconomySnapshot?.()?.profile?.heroIdentity,
    )
    ?? createPixelHero({ t });
}

function otherClassId(classId) {
  return classId === "wizzard" ? "knight" : "wizzard";
}

function normalizeClassId(classId) {
  return classId === "wizzard" ? "wizzard" : "knight";
}

function createProfilePanelLayout(lines, selectedIndex) {
  return calculatePanelLayout({
    canvasWidth: 320,
    canvasHeight: 180,
    rowCount: Math.max(1, lines.length),
    selectedIndex,
    width: IDENTITY_PANEL_WIDTH,
  });
}

function wrapInfoLine(text, color, options) {
  return wrapPixelText(text, options).map((wrappedText) => ({ text: wrappedText, color }));
}

function createStatusText(isGuest, t) {
  return t(isGuest ? "hub.identity.statusGuest" : "hub.identity.statusDiscord");
}

function normalizePersonaSource(source) {
  return source === "llm" ? "llm" : "local";
}

function sourceLabel(source, t) {
  return normalizePersonaSource(source) === "llm" ? "LLM" : t("common.local");
}

function isGuestIdentity(identity) {
  return identity.discordId === "guest" || identity.source === translate("class.identity.guestName");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}
