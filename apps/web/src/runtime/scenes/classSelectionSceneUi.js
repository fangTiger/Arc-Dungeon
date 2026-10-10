import { getPlayerClass } from "../../core/combat/classes.js";
import { setImageSmoothing } from "../renderer/pixelSurface.js";
import {
  drawCenteredPixelText,
  drawPixelPanel,
  drawPixelText,
  fitPixelText,
} from "../ui/pixelUi.js";
import { drawOnboardingBackground } from "./onboardingBackground.js";
import { drawHeroNiche, HERO_NICHE_PORTRAIT_RECT } from "./onboardingHeroNiche.js";
import {
  CLASS_SKILLS_PANEL,
  SKILL_PREVIEW_PANEL,
  drawClassSelectionSkillPreview,
} from "./classSelectionSkillPreview.js";

const HEADER = Object.freeze({
  id: "header", x: 36, y: 34, width: 248, height: 18, fill: "#17121c",
});
const ROLE = Object.freeze({
  id: "role", x: 0, y: 53, width: 128, height: 88, fill: "#14131c",
});
const FOOTER = Object.freeze({
  id: "footer", x: 72, y: 164, width: 176, height: 16, fill: "#17121c",
});
const INFORMATION_PANELS = Object.freeze([
  HEADER, ROLE, SKILL_PREVIEW_PANEL, CLASS_SKILLS_PANEL, FOOTER,
]);

export const classSelectionBackgroundRenderer = drawOnboardingBackground;
export const classSelectionNicheRenderer = drawHeroNiche;

export function drawClassSelectionScene(context, {
  width,
  height,
  tileset,
  selectedClassId,
  heroIdentity,
  avatarImage,
  elapsedMs = 0,
  skillPreview,
  t,
}) {
  const playerClass = getPlayerClass(selectedClassId);

  context.save();
  setImageSmoothing(context, false);
  const background = classSelectionBackgroundRenderer(context, {
    width,
    height,
    tileset,
    elapsedMs,
  });
  drawHeader(context, tileset, width, selectedClassId, t);
  const roleResult = drawRoleInformation(context, {
    tileset,
    playerClass,
    heroIdentity,
    avatarImage,
    t,
  });
  const niche = classSelectionNicheRenderer(context, tileset, {
    layer: "portrait",
    spritePrefix: playerClass.spritePrefix,
    classId: playerClass.id,
    elapsedMs,
  });
  const previewResult = drawClassSelectionSkillPreview(context, tileset, skillPreview, t);
  drawFooter(context, tileset, width, t);
  context.restore();

  return {
    portraitFrameName: niche.heroFrameName,
    portraitRect: { ...HERO_NICHE_PORTRAIT_RECT },
    classSwitchIndicators: ["left", "right"],
    background,
    informationPanels: INFORMATION_PANELS.map((panel) => ({ ...panel })),
    ...previewResult,
    ...roleResult,
  };
}

function drawHeader(context, tileset, width, selectedClassId, t) {
  drawOpaquePanel(context, tileset, HEADER, "#a77bd8");
  drawPixelText(context, t("class.header.knight"), 42, 38, {
    color: selectedClassId === "knight" ? "#fff0b3" : "#8f8793",
  });
  drawCenteredPixelText(context, t("class.header.title"), Math.round(width / 2), 38, {
    color: "#fff0b3",
  });
  drawPixelText(context, t("class.header.wizzard"), 244, 38, {
    color: selectedClassId === "wizzard" ? "#96cdff" : "#8f8793",
  });
}

function drawRoleInformation(context, options) {
  const { tileset, playerClass, heroIdentity, avatarImage, t } = options;
  drawOpaquePanel(context, tileset, ROLE, "#71b7ff");
  const { baseStats } = playerClass;
  drawPixelText(context, t(`class.label.${playerClass.id}`), 8, 56, {
    color: "#fff0b3",
    size: 20,
  });
  drawPixelText(context, t(`class.position.${playerClass.id}`), 8, 77, {
    color: "#ffe3a3",
    size: 20,
  });
  drawPixelText(context, `${t("class.stats.hp")} ${baseStats.maxHp}`, 8, 100);
  drawPixelText(context, `${t("class.stats.attack")} ${baseStats.attack}`, 68, 100);
  drawPixelText(context, `${t("class.stats.defense")} ${baseStats.defense}`, 8, 110);
  drawPixelText(context, `${t("class.stats.crit")} ${baseStats.critRate * 100}%`, 68, 110);

  drawIdentityAvatar(context, avatarImage, heroIdentity.discordId === "guest", { x: 102, y: 56 }, t);
  const title = localizeGuestIdentity(heroIdentity, "title", t);
  const displayName = localizeGuestIdentity(heroIdentity, "displayName", t);
  drawPixelText(context, fitPixelText(context, `${t("class.identity.title")} ${title}`, 120), 8, 121, {
    color: "#ffe3a3",
  });
  drawPixelText(context, fitPixelText(context, `${t("class.identity.name")} ${displayName}`, 120), 8, 131, {
    color: "#f7efd0",
  });
  return {};
}

function drawIdentityAvatar(context, avatarImage, isGuest, { x, y }, t) {
  context.fillStyle = "#0d0b12";
  context.fillRect(x, y, 18, 18);
  if (isDrawableImage(avatarImage) && typeof context.drawImage === "function") {
    context.drawImage(avatarImage, x + 1, y + 1, 16, 16);
    return;
  }
  const glyphKey = isGuest ? "class.identity.guestGlyph" : "class.identity.heroGlyph";
  drawPixelText(context, t(glyphKey), x + 4, y + 3, { color: "#96cdff" });
}

function drawFooter(context, tileset, width, t) {
  drawOpaquePanel(context, tileset, FOOTER, "#d4af64");
  drawCenteredPixelText(context, t("class.footer"), Math.round(width / 2), 167, {
    color: "#b7aeb9",
  });
}

function localizeGuestIdentity(heroIdentity, field, t) {
  if (heroIdentity.discordId !== "guest") return heroIdentity[field];
  return t(field === "title" ? "class.identity.guestTitle" : "class.identity.guestName");
}

function drawOpaquePanel(context, tileset, panel, accent) {
  context.fillStyle = panel.fill;
  context.fillRect(panel.x, panel.y, panel.width, panel.height);
  drawPixelPanel(context, { tileset, ...panel, accent });
}

function isDrawableImage(image) {
  return Boolean(image?.complete && image.naturalWidth > 0);
}
