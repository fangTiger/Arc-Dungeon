import { HUB_INTERACTION_RANGE, getInteractionNear, hubMap } from "../../core/hub/hubMap.js";
import { calculateHubInteractionLabels } from "../../core/hub/hubInteractionLabels.js";
import { calculateHubHudLayout } from "../../core/ui/hudLayout.js";
import { createHubAtmosphere } from "./hubAtmosphere.js";
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, setImageSmoothing } from "../renderer/pixelSurface.js";
import { createSpriteRenderer } from "../renderer/spriteRenderer.js";
import { createTilemapRenderer } from "../renderer/tilemapRenderer.js";
import { createHubClassStationFlow } from "./hubClassStationFlow.js";
import { createHubEconomyFlow } from "./hubEconomyFlow.js";
import { drawHubBranding } from "./hubBranding.js";
import { createHubIdentityFlow } from "./hubIdentityFlow.js";
import { drawHubIdentityPanel } from "./hubIdentityUi.js";
import { moveToInteraction } from "./hubSceneDebug.js";
import { getFacing, moveHubPlayer, resolveHubPlayerSpriteVariant, selectedHeroClass } from "./hubSceneHelpers.js";
import { createHubSpriteFactory } from "./hubSprites.js";
import { translate } from "../../core/i18n/index.js";
import { setPixelFont } from "../ui/pixelFont.js";
import { drawHubHud, drawHubInteractionLabels, drawHubPanel, drawHubPrompt } from "./hubUi.js";
import { drawHudIconBar } from "./hudIconBar.js";
import { closeRolePanel, createRolePanelState, drawRolePanel, openRolePanel, updateRolePanel } from "./rolePanelUi.js";

const PLAYER_RADIUS = 5;
const PLAYER_SPEED = 74;
const FEEDBACK_SECONDS = 2;

export function createHubScene({
  surface,
  camera,
  tileset,
  enterDungeon,
  getEconomySnapshot,
  getCachedEconomySnapshot,
  craftSkin,
  exchangeSkinBox,
  openSkinBox,
  claimDailyTickets,
  buyTickets,
  setEquippedSkin,
  heroIdentity,
  sharedIdentityFlow,
  i18n,
}) {
  const t = i18n?.t ?? translate;
  const tilemapRenderer = createTilemapRenderer(tileset);
  const spriteRenderer = createSpriteRenderer();
  const atmosphere = createHubAtmosphere({ width: surface.width, height: surface.height, camera });
  const hubSprites = createHubSpriteFactory({
    tileset,
    getPlayerSpriteVariant,
  });
  const player = {
    x: hubMap.spawn.x,
    y: hubMap.spawn.y,
    facing: "down",
    radius: PLAYER_RADIUS,
    moving: false,
  };
  let elapsedMs = 0;
  let nearbyInteraction = null;
  let feedbackText = "";
  let feedbackTimer = 0;
  const rolePanel = createRolePanelState();
  const hubHudLayout = calculateHubHudLayout({
    canvasWidth: INTERNAL_WIDTH,
    canvasHeight: INTERNAL_HEIGHT,
  });
  const hubInteractionLabels = calculateHubInteractionLabels({
    map: hubMap,
    hudLayout: hubHudLayout,
    t,
    measureText: surface.context ? (text) => {
      setPixelFont(surface.context, 10);
      return surface.context.measureText(text).width;
    } : undefined,
  });

  camera.setPosition(0, 0);
  const identityFlow = sharedIdentityFlow ?? createHubIdentityFlow({
    getCachedEconomySnapshot,
    heroIdentity,
    initialClassId: selectedHeroClass(),
    t,
  });
  const classStationFlow = createHubClassStationFlow({
    getSelectedClassId: identityFlow.getSelectedClassId,
    setSelectedClassId: identityFlow.setSelectedClassId,
    t,
  });
  const economyFlow = createHubEconomyFlow({
    enterDungeon,
    getEconomySnapshot,
    craftSkin,
    exchangeSkinBox,
    openSkinBox,
    claimDailyTickets,
    buyTickets,
    selectedHeroClass: getSelectedHeroClass,
    selectedHeroIdentity: getCurrentHeroIdentity,
    showFeedback,
    t,
  });

  function update(input, dt) {
    elapsedMs += dt * 1000;
    atmosphere.update(dt);

    if (identityFlow.isOpen()) {
      identityFlow.update(input);
      updateFeedbackTimer(dt);
      return;
    }

    if (classStationFlow.getPanel()) {
      classStationFlow.update(input);
      updateFeedbackTimer(dt);
      return;
    }

    if (economyFlow.getPanel()) {
      economyFlow.update(input);
      updateFeedbackTimer(dt);
      return;
    }

    if (rolePanel.open) {
      updateRolePanel(rolePanel, input, {
        economySnapshot: getCurrentEconomySnapshot(),
        setEquippedSkin: equipRolePanelSkin,
        t,
      });
      updateFeedbackTimer(dt);
      return;
    }

    if (input.wasPressed("tabPanel")) {
      openRolePanel(rolePanel);
      updateFeedbackTimer(dt);
      return;
    }

    const direction = input.getDirection();

    if (direction.x !== 0 || direction.y !== 0) {
      player.facing = getFacing(direction, player.facing);
      player.moving = moveHubPlayer({
        map: hubMap,
        player,
        direction,
        speed: PLAYER_SPEED,
        dt,
      });
    } else {
      player.moving = false;
    }

    nearbyInteraction = getInteractionNear(hubMap, player.x, player.y, HUB_INTERACTION_RANGE);

    if (nearbyInteraction && input.wasPressed("interact")) {
      interactWith(nearbyInteraction.id);
    }

    if (feedbackTimer > 0) {
      updateFeedbackTimer(dt);
    }
  }

  function render(context) {
    setImageSmoothing(context, false);
    context.clearRect(0, 0, surface.width, surface.height);
    context.fillStyle = "#000000";
    context.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

    tilemapRenderer.drawLayer(context, hubMap.layers.floor, camera);
    tilemapRenderer.drawLayer(context, hubMap.layers.walls, camera);
    const sprites = hubSprites.createSceneSprites({ player, elapsedMs });
    spriteRenderer.drawShadows(context, sprites, camera);
    spriteRenderer.drawSorted(context, sprites, camera);
    drawHubBranding(context);
    atmosphere.drawParticles(context, camera);
    atmosphere.applyLighting(context, player, elapsedMs);
    atmosphere.applyVignette(context);
    const economyPanel = economyFlow.getPanel();
    const classStationPanel = classStationFlow.getPanel();
    const overlayOpen = Boolean(economyPanel || classStationPanel) || identityFlow.isOpen() || rolePanel.open;

    drawHubInteractionLabels(context, hubInteractionLabels);
    drawHubHud(context, economyFlow.getSnapshot(), tileset, { layout: hubHudLayout, t });
    if (!overlayOpen) {
      drawHubPrompt(context, { nearbyInteraction, feedbackText, feedbackTimer }, tileset, { t });
    }
    drawHubPanel(context, economyPanel, tileset, { t });
    drawHubPanel(context, classStationPanel, tileset, { t });
    drawHubIdentityPanel(context, identityFlow.getViewModel(), tileset, { t });
    drawRolePanel(context, {
      economySnapshot: getCurrentEconomySnapshot(),
      heroIdentity: getCurrentHeroIdentity(),
      t,
    }, rolePanel, tileset, { t });
    drawHudIconBar(context, { layout: hubHudLayout.iconBar, rolePanel, t });
  }

  return {
    update,
    render,
    debugInteract: (id) => interactWith(id ?? nearbyInteraction?.id),
    debugMoveToInteraction: (id) => moveToInteraction({
      hubMap,
      player,
      setNearbyInteraction: (interaction) => {
        nearbyInteraction = interaction;
      },
      clearFeedback: () => {
        feedbackTimer = 0;
      },
    }, id),
  };

  function interactWith(id) {
    if (id === "portal" && typeof enterDungeon === "function") {
      closeRolePanel(rolePanel);
      economyFlow.openTicketPanel();
      return;
    }

    if (id === "merchant") {
      closeRolePanel(rolePanel);
      economyFlow.openMerchantPanel();
      return;
    }

    if (id === "noticeboard") {
      closeRolePanel(rolePanel);
      economyFlow.openNoticeboardPanel();
      return;
    }

    if (id === "identity") {
      closeRolePanel(rolePanel);
      identityFlow.open();
      economyFlow.closePanel();
      return;
    }

    if (id === "classStation") {
      closeRolePanel(rolePanel);
      identityFlow.close();
      economyFlow.closePanel();
      classStationFlow.openPanel();
      return;
    }

    if (nearbyInteraction) {
      showFeedback(nearbyInteraction.feedbackKey ? t(nearbyInteraction.feedbackKey) : nearbyInteraction.feedback);
    }
  }

  function showFeedback(text) {
    feedbackText = text;
    feedbackTimer = FEEDBACK_SECONDS;
  }

  function updateFeedbackTimer(dt) {
    feedbackTimer = Math.max(0, feedbackTimer - dt);
  }

  function getCurrentHeroIdentity() {
    return identityFlow.getSelectedIdentity();
  }

  function getCurrentEconomySnapshot() {
    return getCachedEconomySnapshot?.() ?? economyFlow.getSnapshot();
  }

  function getPlayerSpriteVariant() {
    const profile = getCurrentEconomySnapshot()?.profile ?? {};
    return resolveHubPlayerSpriteVariant({
      profile,
      heroIdentity: getCurrentHeroIdentity(),
      classId: getSelectedHeroClass(),
    });
  }

  function equipRolePanelSkin(skinId) {
    return Promise.resolve(setEquippedSkin?.(skinId)).then((result) => {
      economyFlow.refreshEconomySnapshot();
      return result;
    });
  }

  function getSelectedHeroClass() {
    return identityFlow.getSelectedClassId();
  }
}
