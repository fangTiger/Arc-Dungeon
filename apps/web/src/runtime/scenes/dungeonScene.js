import { applyBuildBonusesToPlayer, createPlayer } from "../../core/combat.js";
import { buildDungeonRoomMap, canMoveToDungeonRoom, DUNGEON_ROOM_HEIGHT, DUNGEON_ROOM_WIDTH, DUNGEON_TILE_SIZE, getDungeonInteractionNear, getDungeonSpawnPosition } from "../../core/dungeon/roomMap.js";
import { minimapFadeAlpha, resolveStuckPosition } from "../../core/dungeon/playerSafety.js";
import { getEntryPositionAfterExit, getExitDirectionForPosition, getNeighborRoomId, isInsideDoorway } from "../../core/dungeon/roomTransitions.js";
import { beginUpgradeChoice, canDescendFromCurrentRoom, descend, enterRoom, isRunOver } from "../../core/run/runState.js";
import { applyRoomEventBuffsToPlayer } from "../../core/run/roomEvents.js";
import { translate } from "../../core/i18n/index.js";
import { calculateHudLayout } from "../../core/ui/hudLayout.js";
import { withDiscoveredStairsForRun } from "../../core/ui/minimapReveal.js";
import { setImageSmoothing } from "../renderer/pixelSurface.js";
import { createSpriteRenderer } from "../renderer/spriteRenderer.js";
import { createTilemapRenderer } from "../renderer/tilemapRenderer.js";
import { createDungeonCombat } from "./dungeonCombat.js";
import { drawCombatBursts, drawDamageNumbers, drawProjectileBodies } from "./dungeonCombatRender.js";
import { drawSkillVfx } from "./dungeonSkillVfxRender.js";
import { createDungeonAtmosphere } from "./dungeonAtmosphere.js";
import { createDungeonInputHint, drawDungeonInputHint } from "./dungeonInputHint.js";
import { createDungeonSpriteFactory } from "./dungeonSprites.js";
import { getFacing, normalizeHeroClass, resolveDungeonPlayerSpriteVariant } from "./dungeonScenePlayer.js";
import { drawDeathOverlay, drawDungeonHud, drawDungeonPrompt, drawFloorTransition } from "./dungeonUi.js";
import { calculateMinimapRect, drawDungeonMinimap } from "./dungeonMinimapUi.js";
import { drawHudHintBanner, drawHudIconBar, shouldShowHudHintBanner } from "./hudIconBar.js";
import { drawHudInfoBar } from "./hudInfoBar.js";
import { createDungeonSettlementFlow } from "./dungeonSettlementFlow.js";
import { drawSettlementOverlay } from "./dungeonSettlementUi.js";
import { drawBossNameplate, drawUpgradeChoiceOverlay } from "./dungeonUpgradeUi.js";
import { getActiveBoss, handleUpgradeChoiceInput } from "./dungeonUpgradeFlow.js";
import { createDungeonRoomEventFlow } from "./dungeonRoomEventFlow.js";
import { drawGamePanel } from "./gamePanelUi.js";
import { closeRolePanel, createRolePanelState, drawRolePanel, openRolePanel, updateRolePanel } from "./rolePanelUi.js";
const PLAYER_RADIUS = 5, PLAYER_SPEED = 74, INTERACTION_RANGE = 24, FEEDBACK_SECONDS = 2, FLOOR_TRANSITION_SECONDS = 0.85;
export function calculateDungeonHudLayout(run) { return calculateHudLayout({ minimap: calculateMinimapRect(run) }); }
export function isDungeonModalOpen({ settlementActive = false, pendingChoice = null, roomEventOpen = false, rolePanelOpen = false } = {}) { return Boolean(settlementActive || pendingChoice || roomEventOpen || rolePanelOpen); }
export function createDungeonScene({ surface, camera, tileset, getRun, setRun, returnToHub, settleRun, getCachedEconomySnapshot, setEquippedSkin, markHudHintSeen, i18n }) {
  const t = i18n?.t ?? translate;
  const tilemapRenderer = createTilemapRenderer(tileset);
  const spriteRenderer = createSpriteRenderer();
  const spriteFactory = createDungeonSpriteFactory({ tileset });
  const atmosphere = createDungeonAtmosphere({ width: surface.width, height: surface.height, camera });
  const inputHint = createDungeonInputHint({ t });
  const spawn = getDungeonSpawnPosition();
  let run = withDiscoveredStairsForRun(getRun());
  const player = applyHeroIdentitySprite(
    applyBuildBonusesToPlayer(createPlayer({
      classId: normalizeHeroClass(run.heroClass),
      x: spawn.x,
      y: spawn.y,
      radius: PLAYER_RADIUS,
      facing: { x: 0, y: 1 },
      facingName: "down",
      moving: false,
      knockbackX: 0,
      knockbackY: 0,
    }), run.build?.bonuses),
    { profile: getCachedEconomySnapshot?.()?.profile, heroIdentity: run.heroIdentity, classId: normalizeHeroClass(run.heroClass) },
  );
  let roomMap = buildDungeonRoomMap({ run });
  const combat = createDungeonCombat({ player, getRun: () => run, getRoomMap: () => roomMap, updateRun });
  const settlement = createDungeonSettlementFlow({ settleRun, returnToHub, t });
  const roomEventFlow = createDungeonRoomEventFlow({ t });
  let elapsedMs = 0, minimapAlpha = 1, nearbyInteraction = null, feedbackText = "";
  let feedbackTimer = 0, floorTransitionTimer = FLOOR_TRANSITION_SECONDS;
  let afterUpgradeChoice = null;
  const rolePanel = createRolePanelState();
  let hudHintDismissed = false;
  function isModalOpen() { return isDungeonModalOpen({ settlementActive: settlement.isActive(), pendingChoice: run.build?.pendingChoice, roomEventOpen: roomEventFlow.isOpen(), rolePanelOpen: rolePanel.open }); }
  camera.setPosition(0, 0);
  combat.enterCurrentRoom();
  function update(input, dt) {
    elapsedMs += dt * 1000;
    atmosphere.update(dt);
    if (settlement.isActive()) {
      settlement.update(input, dt);
      updateTimers(dt);
      return;
    }
    if (isRunOver({ player })) {
      settlement.begin({ run, player, reason: "death" });
      updateTimers(dt);
      return;
    }
    if (run.build?.pendingChoice) {
      handleUpgradeChoiceInput({
        input,
        run,
        updateRun,
        descendToNextFloor,
        afterUpgradeChoice,
        setAfterUpgradeChoice: (nextAction) => { afterUpgradeChoice = nextAction; },
      });
      updateTimers(dt);
      return;
    }
    if (roomEventFlow.isOpen()) { roomEventFlow.update(input, { run, player, applyResult: applyRoomEventResult, showFeedback }); updateTimers(dt); return; }
    if (!isModalOpen() && !hudHintDismissed && shouldShowHudHintBanner(getCachedEconomySnapshot?.()?.profile, inputHint.getSnapshot(run, roomMap)) && (input.wasPressed("confirm") || input.wasPressed("cancel"))) { hudHintDismissed = true; void Promise.resolve().then(() => markHudHintSeen?.()).catch(() => undefined); updateTimers(dt); return; }
    if (rolePanel.open) { updateRolePanel(rolePanel, input, { economySnapshot: getCachedEconomySnapshot?.(), setEquippedSkin: equipRolePanelSkin, runPickups: combat.getSnapshot().pickups, t }); updateTimers(dt); return; }
    if (input.wasPressed("tabPanel")) { openRolePanel(rolePanel); updateTimers(dt); return; }
    if (input.wasPressed("cancel")) {
      settlement.begin({ run, player, reason: "evacuated" });
      updateTimers(dt);
      return;
    }
    if (combat.isHitStopped()) {
      combat.update(input, dt, elapsedMs);
      updateTimers(dt);
      return;
    }
    const direction = input.getDirection();
    if (direction.x !== 0 || direction.y !== 0) {
      player.facingName = getFacing(direction, player.facingName);
      player.facing = direction;
      player.moving = movePlayer(direction, dt);
    } else {
      player.moving = false;
    }
    combat.update(input, dt, elapsedMs);
    if (isRunOver({ player })) {
      settlement.begin({ run, player, reason: "death" });
      updateTimers(dt);
      return;
    }
    nearbyInteraction = getDungeonInteractionNear(roomMap, player.x, player.y, INTERACTION_RANGE);
    if (nearbyInteraction && input.wasPressed("interact")) {
      interactWith(nearbyInteraction);
    }
    updateTimers(dt);
  }
  function render(context) {
    const combatState = combat.getSnapshot();
    camera.setPosition(-combatState.cameraShake.x, -combatState.cameraShake.y);
    setImageSmoothing(context, false);
    context.clearRect(0, 0, surface.width, surface.height);
    context.fillStyle = "#000000";
    context.fillRect(0, 0, surface.width, surface.height);
    tilemapRenderer.drawLayer(context, roomMap.layers.floor, camera);
    tilemapRenderer.drawLayer(context, roomMap.layers.walls, camera, elapsedMs);
    const inputHintSnapshot = inputHint.getSnapshot(run, roomMap); drawDungeonInputHint(context, inputHintSnapshot, camera);
    drawCombatBursts(context, combatState.bursts, camera);
    drawSkillVfx(context, combatState.skillEffects, camera);
    drawProjectileBodies(context, combatState.projectiles, camera);
    const sprites = spriteFactory.createSceneSprites({
      roomMap,
      player,
      elapsedMs,
      combat: combatState,
    });
    spriteRenderer.drawShadows(context, sprites, camera);
    spriteRenderer.drawSorted(context, sprites, camera);
    atmosphere.drawParticles(context, camera);
    atmosphere.applyLighting(context, player, elapsedMs, combatState.dynamicLights);
    atmosphere.applyVignette(context);
    drawDamageNumbers(context, combatState.damageNumbers, camera);
    camera.setPosition(0, 0);
    drawFloorTransition(context, { depth: run.depth, timer: floorTransitionTimer, duration: FLOOR_TRANSITION_SECONDS, t });
    drawBossNameplate(context, getActiveBoss(combatState), tileset);
    const economySnapshot = getCachedEconomySnapshot?.();
    const hudLayout = calculateDungeonHudLayout(run);
    drawDungeonHud(context, run, player, economySnapshot, tileset, elapsedMs, combatState.skillSlots, { combatActive: combatState.enemies.some((enemy) => enemy.hp > 0 && enemy.state !== "dead"), layout: hudLayout, t });
    drawDungeonMinimap(context, run, tileset, { alpha: minimapAlpha, t });
    drawHudInfoBar(context, { layout: hudLayout.infoBar, run, economySnapshot, tileset, t });
    drawDungeonPrompt(context, { nearbyInteraction, feedbackText, feedbackTimer }, tileset, { t });
    drawGamePanel(context, roomEventFlow.getPanel({ run, player }), tileset, { t });
    drawRolePanel(context, { run, player, economySnapshot, heroIdentity: run.heroIdentity, skillSlots: combatState.skillSlots, runPickups: combatState.pickups, t }, rolePanel, tileset, { t });
    drawHudHintBanner(context, { layout: hudLayout.hintBanner, visible: !isModalOpen() && !hudHintDismissed && shouldShowHudHintBanner(economySnapshot?.profile, inputHintSnapshot), tileset, t });
    drawHudIconBar(context, { layout: hudLayout.iconBar, rolePanel, t });
    drawUpgradeChoiceOverlay(context, run.build?.pendingChoice, tileset, { t });
    drawSettlementState(context, settlement.getSnapshot());
  }
  function drawSettlementState(context, snapshot) {
    if (snapshot?.reason === "death" && snapshot.status === "settling") {
      drawDeathOverlay(context, snapshot, tileset, { t });
      return;
    }
    drawSettlementOverlay(context, snapshot, tileset, { t });
  }
  function movePlayer(direction, dt) {
    const speed = PLAYER_SPEED * (player.movementMultiplier ?? 1);
    const nextX = player.x + direction.x * speed * dt;
    const nextY = player.y + direction.y * speed * dt;
    const roomIdBeforeMove = roomMap.id;
    let moved = false;
    if (tryMoveTo(nextX, player.y)) {
      moved = true;
    }
    if (roomMap.id !== roomIdBeforeMove) {
      return true;
    }
    if (tryMoveTo(player.x, nextY)) {
      moved = true;
    }
    return moved;
  }
  function tryMoveTo(nextX, nextY) {
    const exitDirection = getExitDirectionForPosition({
      x: nextX,
      y: nextY,
      width: DUNGEON_ROOM_WIDTH,
      height: DUNGEON_ROOM_HEIGHT,
      tileSize: DUNGEON_TILE_SIZE,
      margin: player.radius,
    });
    if (exitDirection && canExitThrough(exitDirection, nextX, nextY)) {
      transitionToRoom(exitDirection);
      return true;
    }
    if (canMoveToDungeonRoom(roomMap, nextX, nextY, player.radius)) {
      player.x = nextX;
      player.y = nextY;
      return true;
    }
    return false;
  }
  function canExitThrough(exitDirection, x, y) {
    return !combat.isRoomLocked() && Boolean(roomMap.room.doors[exitDirection]) && isInsideDoorway({
      direction: exitDirection,
      x,
      y,
      width: DUNGEON_ROOM_WIDTH,
      height: DUNGEON_ROOM_HEIGHT,
      tileSize: DUNGEON_TILE_SIZE,
    });
  }
  function transitionToRoom(exitDirection) {
    const nextRoomId = getNeighborRoomId(run.floorPlan, roomMap.room, exitDirection);
    if (!nextRoomId) {
      return;
    }
    updateRun(enterRoom(run, nextRoomId));
    const entry = getEntryPositionAfterExit({
      exitDirection,
      width: DUNGEON_ROOM_WIDTH,
      height: DUNGEON_ROOM_HEIGHT,
      tileSize: DUNGEON_TILE_SIZE,
    });
    player.x = entry.x;
    player.y = entry.y;
    combat.enterCurrentRoom();
    nearbyInteraction = null;
    feedbackTimer = 0;
  }
  function interactWith(interaction) {
    if (interaction.id === "stairs") {
      closeRolePanel(rolePanel);
      if (!canDescendFromCurrentRoom(run)) {
        showFeedback(t("dungeon.prompt.bossLocked"));
        return;
      }
      if (roomMap.room.type === "stairs") {
        afterUpgradeChoice = "descend";
        updateRun(beginUpgradeChoice(run, "minor"));
        return;
      }
      descendToNextFloor(run);
      return;
    }
    if (interaction.id === "event") { closeRolePanel(rolePanel); if (interaction.used) { showFeedback(t(interaction.feedbackKey)); return; } roomEventFlow.open({ run, player, roomId: roomMap.id }); feedbackTimer = 0; return; }
    showFeedback(interaction.feedbackKey ? t(interaction.feedbackKey) : "");
  }
  function updateRun(nextRun, sourcePlayer = player) {
    run = withDiscoveredStairsForRun(nextRun);
    setRun(run);
    Object.assign(player, applyRoomEventBuffsToPlayer(applyBuildBonusesToPlayer(sourcePlayer, run.build?.bonuses), run));
    roomMap = buildDungeonRoomMap({ run });
  }
  function applyRoomEventResult(result) { updateRun(result.run, result.player); }
  function showFeedback(text) { feedbackText = text; feedbackTimer = FEEDBACK_SECONDS; }
  function descendToNextFloor(sourceRun) {
    updateRun(descend(sourceRun));
    const nextSpawn = getDungeonSpawnPosition();
    player.x = nextSpawn.x;
    player.y = nextSpawn.y;
    player.facing = { x: 0, y: 1 };
    player.facingName = "down";
    floorTransitionTimer = FLOOR_TRANSITION_SECONDS;
    nearbyInteraction = null;
    feedbackTimer = 0;
    combat.enterCurrentRoom();
  }
  function equipRolePanelSkin(skinId) {
    return Promise.resolve(setEquippedSkin?.(skinId)).then((result) => { Object.assign(player, applyHeroIdentitySprite(player, { profile: getCachedEconomySnapshot?.()?.profile, heroIdentity: run.heroIdentity, classId: player.classId })); return result; });
  }
  function updateTimers(dt) {
    Object.assign(player, resolveStuckPosition({ roomMap, x: player.x, y: player.y, radius: player.radius }));
    minimapAlpha = minimapFadeAlpha({ playerX: player.x, playerY: player.y, minimapRect: calculateDungeonHudLayout(run).minimap, currentAlpha: minimapAlpha, previousElapsedMs: elapsedMs - dt * 1000, elapsedMs });
    inputHint.update({
      run,
      roomMap,
      dt,
      paused: isModalOpen(),
    });
    if (feedbackTimer > 0) {
      feedbackTimer = Math.max(0, feedbackTimer - dt);
    }
    if (floorTransitionTimer > 0) {
      floorTransitionTimer = Math.max(0, floorTransitionTimer - dt);
    }
  }
  return { update, render, debugKillPlayer: () => { player.hp = 0; } };
}
function applyHeroIdentitySprite(player, options = {}) { return { ...player, spritePrefix: resolveDungeonPlayerSpriteVariant({ ...options, classId: options.classId ?? player.classId }) }; }
