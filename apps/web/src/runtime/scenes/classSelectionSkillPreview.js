import { getSkillsForClass } from "../../core/combat/skills.js";
import { drawPixelIcon, drawPixelPanel, drawPixelText } from "../ui/pixelUi.js";
import { createSkillVfx } from "./dungeonSkillVfx.js";
import { drawSkillVfx } from "./dungeonSkillVfxRender.js";

export const CLASS_SKILLS_PANEL = Object.freeze({
  id: "skills", x: 8, y: 143, width: 304, height: 21, fill: "#17121c",
});
export const SKILL_PREVIEW_PANEL = Object.freeze({
  id: "preview", x: 190, y: 53, width: 122, height: 88, fill: "#17121c",
});

const SKILL_KEYS = Object.freeze(["U", "I", "O", "P"]);
const SKILL_ICON_COLORS = Object.freeze(["#f4d06f", "#71b7ff", "#a77bd8", "#d94f3f"]);
const SKILL_ROW_LEFT = 14;
const SKILL_ROW_RIGHT = 309;
const SKILL_LABEL_OFFSET = 18;
const PREVIEW_BOUNDS = Object.freeze({ x: 196, y: 69, width: 110, height: 44 });
const PREVIEW_CASTER_RECT = Object.freeze({ x: 202, y: 75, width: 20, height: 36 });
const PREVIEW_TARGET_RECT = Object.freeze({ x: 282, y: 93, width: 16, height: 16 });
const PREVIEW_CASTER_ANCHOR = Object.freeze({ x: 214, y: 96 });
const PREVIEW_TARGET_ANCHOR = Object.freeze({ x: 290, y: 101 });
const PREVIEW_CYCLE_MS = 760;
const TARGET_FRAME_NAME = "goblin_idle_anim_f0";
const IDENTITY_CAMERA = Object.freeze({
  worldToScreen(x, y) {
    return { x: Math.round(x), y: Math.round(y) };
  },
});

const SKILL_PREVIEW_CONFIG = Object.freeze({
  "knight-circular-slash": createConfig(
    "spawnCircularSlash",
    () => ({ ...PREVIEW_CASTER_ANCHOR, radius: 20, color: "#ffe08a" }),
  ),
  "knight-charge": createConfig(
    "spawnChargeTrail",
    () => ({ from: PREVIEW_CASTER_ANCHOR, to: PREVIEW_TARGET_ANCHOR, color: "#f4d06f" }),
  ),
  "knight-shield-bash": createConfig(
    "spawnShieldBash",
    () => ({ ...PREVIEW_CASTER_ANCHOR, facing: { x: 1, y: 0 }, color: "#dff1ff" }),
  ),
  "knight-war-cry": createConfig(
    "spawnWarCry",
    () => ({ ...PREVIEW_CASTER_ANCHOR, color: "#ff6a4a" }),
  ),
  "wizzard-fireball": createConfig(
    "spawnFireballBurst",
    () => ({ x: PREVIEW_CASTER_ANCHOR.x + 18, y: PREVIEW_CASTER_ANCHOR.y, radius: 18, color: "#ff7a4d" }),
    { x: PREVIEW_CASTER_ANCHOR.x + 18, y: PREVIEW_CASTER_ANCHOR.y },
  ),
  "wizzard-ice-ring": createConfig(
    "spawnIceRing",
    () => ({ ...PREVIEW_CASTER_ANCHOR, radius: 20, color: "#78d8ff" }),
  ),
  "wizzard-blink": createConfig(
    "spawnBlink",
    () => ({ from: PREVIEW_CASTER_ANCHOR, to: PREVIEW_TARGET_ANCHOR, color: "#bda2ff" }),
  ),
  "wizzard-arcane-surge": createConfig(
    "spawnArcaneSurge",
    () => ({ ...PREVIEW_CASTER_ANCHOR, color: "#d48cff" }),
  ),
});

export function createClassSelectionSkillPreview({ initialClassId = "knight" } = {}) {
  const vfx = createSkillVfx({ seed: "rialo:class-selection-preview" });
  let selectedClassId = initialClassId;
  let selectedSkillIndex = 0;
  let cycleElapsedMs = 0;
  let previewVfxMethod = "";
  spawnSelectedSkill();

  function selectClass(classId) {
    if (classId === selectedClassId) return;
    getSkillsForClass(classId);
    selectedClassId = classId;
    selectedSkillIndex = 0;
    spawnSelectedSkill();
  }

  function move(direction) {
    const skills = getSkillsForClass(selectedClassId);
    const offset = direction < 0 ? -1 : 1;
    selectedSkillIndex = (selectedSkillIndex + offset + skills.length) % skills.length;
    spawnSelectedSkill();
  }

  function update(dtMs) {
    const safeDtMs = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
    vfx.update(safeDtMs);
    cycleElapsedMs += safeDtMs;
    if (cycleElapsedMs >= PREVIEW_CYCLE_MS) spawnSelectedSkill();
  }

  function getSnapshot() {
    const skills = getSkillsForClass(selectedClassId);
    const selectedSkill = skills[selectedSkillIndex];
    const config = requirePreviewConfig(selectedSkill.id);
    const effects = vfx.getEffects();
    return {
      selectedClassId,
      selectedSkillIndex,
      selectedSkillId: selectedSkill.id,
      previewVfxMethod,
      previewEffectAnchor: { ...config.effectAnchor },
      effects,
      effectCount: effects.length,
      effectSignature: createEffectSignature(effects),
      skills,
    };
  }

  function spawnSelectedSkill() {
    const skill = getSkillsForClass(selectedClassId)[selectedSkillIndex];
    vfx.reset(`rialo:class-selection-preview:${skill.id}`);
    previewVfxMethod = spawnSkillPreviewVfx(vfx, skill.id);
    cycleElapsedMs = 0;
  }

  return { selectClass, move, update, getSnapshot };
}

export function spawnSkillPreviewVfx(vfx, skillId) {
  const config = requirePreviewConfig(skillId);
  const spawn = vfx?.[config.method];
  if (typeof spawn !== "function") {
    throw new TypeError(`技能预览缺少既有特效函数：${config.method}`);
  }
  spawn(config.createPayload());
  return config.method;
}

export function drawClassSelectionSkillPreview(context, tileset, snapshot, t) {
  const description = t(`class.skill.${snapshot.selectedSkillId}.description`);
  drawOpaquePanel(context, tileset, SKILL_PREVIEW_PANEL, "#a77bd8");
  drawPixelText(context, t("class.preview.heading"), 196, 57, { color: "#ffe3a3" });
  const previewActors = drawPreviewWindow(context, tileset, snapshot);
  drawPixelText(context, description, 196, 116, { color: "#b8c7df" });

  drawOpaquePanel(context, tileset, CLASS_SKILLS_PANEL, "#d4af64");
  const skillItems = layoutSkillItems(context, snapshot.skills, t);
  const skillIconRects = skillItems.map(({ skill, skillName, index, x }) => {
    const y = 147;
    const selected = index === snapshot.selectedSkillIndex;
    if (selected) {
      context.fillStyle = "#fff0b3";
      context.fillRect(x - 2, y - 2, 18, 18);
    }
    drawPixelIcon(context, {
      x,
      y,
      color: SKILL_ICON_COLORS[index],
      glyph: SKILL_KEYS[index],
    });
    drawPixelText(context, skillName, x + SKILL_LABEL_OFFSET, y + 2, {
      color: selected ? "#fff0b3" : "#b7aeb9",
    });
    return { x, y, width: 14, height: 14, skillId: skill.id };
  });

  return {
    selectedSkillId: snapshot.selectedSkillId,
    skillDescriptionLines: [description],
    skillIconRects,
    skillKeys: [...SKILL_KEYS],
    previewVfxMethod: snapshot.previewVfxMethod,
    previewEffectCount: snapshot.effectCount,
    previewEffectSignature: snapshot.effectSignature,
    previewEffectAnchor: { ...snapshot.previewEffectAnchor },
    ...previewActors,
  };
}

function drawPreviewWindow(context, tileset, snapshot) {
  context.fillStyle = "#0b0910";
  context.fillRect(PREVIEW_BOUNDS.x, PREVIEW_BOUNDS.y, PREVIEW_BOUNDS.width, PREVIEW_BOUNDS.height);
  drawPreviewTiles(context, tileset);
  const casterFrameName = `${snapshot.selectedClassId}_m_idle_anim_f0`;
  drawFrame(context, tileset, casterFrameName, PREVIEW_CASTER_RECT);
  drawFrame(context, tileset, TARGET_FRAME_NAME, PREVIEW_TARGET_RECT);

  if (["beginPath", "rect", "clip", "arc", "stroke"].every(
    (method) => typeof context[method] === "function",
  )) {
    context.save();
    context.beginPath();
    context.rect(PREVIEW_BOUNDS.x, PREVIEW_BOUNDS.y, PREVIEW_BOUNDS.width, PREVIEW_BOUNDS.height);
    context.clip();
    drawSkillVfx(context, snapshot.effects, IDENTITY_CAMERA);
    context.restore();
  }

  return {
    previewBounds: { ...PREVIEW_BOUNDS },
    previewCasterFrameName: casterFrameName,
    previewCasterRect: { ...PREVIEW_CASTER_RECT },
    previewCasterAnchor: { ...PREVIEW_CASTER_ANCHOR },
    previewTargetFrameName: TARGET_FRAME_NAME,
    previewTargetRect: { ...PREVIEW_TARGET_RECT },
  };
}

function drawPreviewTiles(context, tileset) {
  const frame = tileset?.frames?.wall_mid ?? tileset?.tiles?.wall_mid;
  if (!tileset?.image || !frame || typeof context.drawImage !== "function") return;
  for (let x = PREVIEW_BOUNDS.x; x < PREVIEW_BOUNDS.x + PREVIEW_BOUNDS.width; x += 16) {
    context.drawImage(
      tileset.image,
      Math.round(frame.sx ?? frame.x), Math.round(frame.sy ?? frame.y),
      Math.round(frame.sw ?? frame.width), Math.round(frame.sh ?? frame.height),
      Math.round(x), PREVIEW_BOUNDS.y, 16, PREVIEW_BOUNDS.height,
    );
  }
}

function drawFrame(context, tileset, frameName, rect) {
  const frame = tileset?.frames?.[frameName] ?? tileset?.tiles?.[frameName];
  if (!tileset?.image || !frame || typeof context.drawImage !== "function") {
    context.fillStyle = frameName === TARGET_FRAME_NAME ? "#6b8f45" : "#d4af64";
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    return;
  }
  context.drawImage(
    tileset.image,
    Math.round(frame.sx ?? frame.x), Math.round(frame.sy ?? frame.y),
    Math.round(frame.sw ?? frame.width), Math.round(frame.sh ?? frame.height),
    rect.x, rect.y, rect.width, rect.height,
  );
}

function drawOpaquePanel(context, tileset, panel, accent) {
  context.fillStyle = panel.fill;
  context.fillRect(panel.x, panel.y, panel.width, panel.height);
  drawPixelPanel(context, { tileset, ...panel, accent });
}

function layoutSkillItems(context, skills, t) {
  const items = skills.map((skill, index) => {
    const skillName = t(`class.skill.${skill.id}.name`);
    const textWidth = Math.ceil(context.measureText(skillName).width);
    return { skill, skillName, index, width: SKILL_LABEL_OFFSET + textWidth };
  });
  const contentWidth = items.reduce((total, item) => total + item.width, 0);
  const gapCount = Math.max(1, items.length - 1);
  const gap = Math.max(2, Math.floor(
    (SKILL_ROW_RIGHT - SKILL_ROW_LEFT - contentWidth) / gapCount,
  ));
  let x = SKILL_ROW_LEFT;

  return items.map((item) => {
    const positioned = { ...item, x };
    x += item.width + gap;
    return positioned;
  });
}

function createConfig(method, createPayload, effectAnchor = PREVIEW_CASTER_ANCHOR) {
  return Object.freeze({ method, createPayload, effectAnchor: Object.freeze(effectAnchor) });
}

function requirePreviewConfig(skillId) {
  const config = SKILL_PREVIEW_CONFIG[skillId];
  if (!config) throw new RangeError(`未知技能预览：${skillId}`);
  return config;
}

function createEffectSignature(effects) {
  const counts = new Map();
  effects.forEach((effect) => {
    const key = `${effect.kind}:${effect.color}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => `${key}:${count}`).join("|");
}
