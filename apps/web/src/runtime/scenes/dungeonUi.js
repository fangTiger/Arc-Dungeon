import { explorationRate } from "../../core/run/runState.js";
import { isBossFloor } from "../../core/dungeon/progression.js";
import {
  HUD_SKILL_SLOT_GAP,
  HUD_SKILL_SLOT_SIZE,
} from "../../core/ui/hudLayout.js";
import {
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
} from "../renderer/pixelSurface.js";
import {
  drawCenteredPixelText,
  drawPixelHealthBar,
  drawPixelPanel,
  drawPixelText,
} from "../ui/pixelUi.js";
import { translate } from "../../core/i18n/index.js";
import { setPixelFont } from "../ui/pixelFont.js";

const HEALTH_GHOSTS = new WeakMap();

export function drawDungeonHud(
  context,
  run,
  player = null,
  economySnapshot = null,
  tileset = null,
  elapsedMs = 0,
  skillSlots = [],
  options = {},
) {
  void economySnapshot;
  const layout = options.layout ?? null;
  const healthBar = layout?.healthBar ?? { x: 6, y: 6, width: 86, height: 7 };
  const depthLabel = layout?.depthLabel ?? { x: 100, y: 6 };
  context.save();
  context.globalAlpha = options.combatActive ? 0.48 : 0.92;
  if (player) {
    const ghostHp = getGhostHp(player, elapsedMs);
    drawPixelHealthBar(context, {
      ...healthBar,
      hp: player.hp,
      maxHp: player.maxHp,
      previousHp: ghostHp,
      elapsedMs,
    });
  }
  const depthText = options.t?.(
    isBossFloor(run.depth) ? "hud.depth.boss" : "hud.depth.floor",
    { depth: run.depth },
  ) ?? translate(isBossFloor(run.depth) ? "hud.depth.boss" : "hud.depth.floor", { depth: run.depth });
  drawPixelText(context, depthText, depthLabel.x, depthLabel.y, { color: "#fff1bd" });
  context.restore();

  context.save();
  drawSkillBar(context, skillSlots, tileset, layout, options.t ?? translate);
  context.restore();
}

export function buildSkillSlotRects(layout, skillSlots) {
  if (!layout?.skillBar || !Array.isArray(skillSlots) || skillSlots.length === 0) {
    return [];
  }

  const bar = layout.skillBar;
  return skillSlots.map((slot, index) => {
    void slot;
    return {
      x: Math.round(bar.x + index * (HUD_SKILL_SLOT_SIZE + HUD_SKILL_SLOT_GAP)),
      y: Math.round(bar.y),
      width: HUD_SKILL_SLOT_SIZE,
      height: HUD_SKILL_SLOT_SIZE,
    };
  });
}

function drawSkillBar(context, skillSlots, tileset, layout, t) {
  if (!Array.isArray(skillSlots) || skillSlots.length === 0) {
    return;
  }

  const bar = layout?.skillBar;
  const slotRects = buildSkillSlotRects(layout, skillSlots);
  if (!bar || slotRects.length === 0) {
    return;
  }

  drawPixelPanel(context, { tileset, ...bar, accent: "#7ce8ff", fill: "#151621" });
  skillSlots.forEach((slot, index) => {
    drawSkillSlot(context, {
      slot,
      rect: slotRects[index],
      t,
    });
  });
}

function drawSkillSlot(context, { slot, rect, t }) {
  const left = Math.round(rect.x);
  const top = Math.round(rect.y);
  const size = HUD_SKILL_SLOT_SIZE;
  const progress = Math.max(0, Math.min(1, slot.progress ?? 1));

  context.fillStyle = "#07090f";
  context.fillRect(left, top, size, size);
  context.fillStyle = "#2b3041";
  context.fillRect(left + 1, top + 1, size - 2, size - 2);
  context.fillStyle = slot.color ?? "#d2b56f";
  context.fillRect(left + 1, top + 1, size - 2, size - 2);
  const glyph = slot.id ? t(`skill.${slot.id}.glyph`) : slot.glyph ?? String(slot.slot);
  drawCenteredPixelText(context, glyph, left + Math.round(size / 2), top + 3, {
    color: "#111018",
  });

  if (!slot.ready) {
    const cooldownHeight = Math.round(size * (1 - progress));
    context.fillStyle = "rgba(5, 7, 12, 0.78)";
    context.fillRect(left, top, size, cooldownHeight);
    drawCenteredPixelText(
      context,
      String(Math.max(1, Math.ceil((slot.remainingMs ?? 0) / 1000))),
      left + Math.round(size / 2),
      top + 3,
      { color: "#f7efd0" },
    );
  }

  drawCenteredPixelText(context, slot.key, left + Math.round(size / 2), top + size - 2, {
    color: "#f7efd0",
  });
}

export function drawDungeonPrompt(context, { nearbyInteraction, feedbackText, feedbackTimer }, tileset = null, { t = translate } = {}) {
  const text = feedbackTimer > 0
    ? feedbackText
    : nearbyInteraction
      ? t("hub.prompt.interact", {
        label: nearbyInteraction.labelKey ? t(nearbyInteraction.labelKey) : nearbyInteraction.label,
      })
      : "";

  if (!text) {
    return;
  }

  context.save();
  setPixelFont(context, 10);
  const panelWidth = Math.min(INTERNAL_WIDTH - 16, Math.max(86, Math.ceil(context.measureText(text).width) + 20));
  const panelX = Math.round((INTERNAL_WIDTH - panelWidth) / 2);
  const panelY = INTERNAL_HEIGHT - 74;
  drawPixelPanel(context, { tileset, x: panelX, y: panelY, width: panelWidth, height: 20, accent: "#d4af64" });
  drawCenteredPixelText(context, text, Math.round(INTERNAL_WIDTH / 2), panelY + 6);
  context.restore();
  return { x: panelX, y: panelY, width: panelWidth, height: 20 };
}

export function drawFloorTransition(context, { depth, timer, duration, t = translate }) {
  if (timer <= 0) {
    return;
  }

  const phase = timer / duration;
  const alpha = Math.min(0.74, phase * 0.74);
  const text = t("hud.depth.floor", { depth });

  context.save();
  context.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  context.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);
  drawCenteredPixelText(context, text, Math.round(INTERNAL_WIDTH / 2), Math.round(INTERNAL_HEIGHT / 2) - 10, {
    size: 20,
    color: "#f7efd0",
  });
  context.restore();
}

export function drawDeathOverlay(context, death, tileset = null, { t = translate } = {}) {
  if (!death?.run) {
    return;
  }

  const darkness = Math.min(0.82, 0.22 + death.timer * 0.16);
  const run = death.run;
  const lines = [
    t("hud.death.title"),
    t("hud.death.depth", { depth: run.depth }),
    t("hud.death.bosses", { count: run.stats.bossesDefeated }),
    t("hud.death.exploration", { rate: Math.round(explorationRate(run) * 100) }),
    t(death.inputReady ? "hud.death.return" : "hud.death.falling"),
  ];

  context.save();
  context.fillStyle = `rgba(0, 0, 0, ${darkness})`;
  context.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

  setPixelFont(context, 10);
  const measuredWidth = Math.max(...lines.map((line) => context.measureText(line).width));
  const panelWidth = Math.min(INTERNAL_WIDTH - 16, Math.max(178, Math.ceil(measuredWidth) + 24));
  const panelHeight = 82;
  const panelX = Math.round((INTERNAL_WIDTH - panelWidth) / 2);
  const panelY = Math.round((INTERNAL_HEIGHT - panelHeight) / 2);

  drawPixelPanel(context, {
    tileset,
    x: panelX,
    y: panelY,
    width: panelWidth,
    height: panelHeight,
    accent: "#d65a42",
    fill: "#1c1014",
  });

  lines.forEach((line, index) => {
    drawPixelText(context, line, panelX + 12, panelY + 10 + index * 12, {
      color: index === 0 ? "#ffb08a" : "#f7efd0",
    });
  });
  context.restore();
  return { x: panelX, y: panelY, width: panelWidth, height: panelHeight };
}

function getGhostHp(player, elapsedMs) {
  const currentHp = Math.max(0, Number(player.hp) || 0);
  const maxHp = Math.max(1, Number(player.maxHp) || 1);
  const state = HEALTH_GHOSTS.get(player) ?? {
    hp: currentHp,
    elapsedMs,
  };
  const dt = Math.max(0, elapsedMs - state.elapsedMs) / 1000;

  if (currentHp < state.hp) {
    state.hp = Math.max(currentHp, state.hp - maxHp * dt * 0.9);
  } else {
    state.hp = currentHp;
  }

  state.elapsedMs = elapsedMs;
  HEALTH_GHOSTS.set(player, state);
  return state.hp;
}
