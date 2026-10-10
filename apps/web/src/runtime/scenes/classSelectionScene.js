import { createI18n } from "../../core/i18n/index.js";
import { drawClassSelectionScene } from "./classSelectionSceneUi.js";
import { createClassSelectionSkillPreview } from "./classSelectionSkillPreview.js";

export function createClassSelectionScene({
  surface,
  tileset,
  identityFlow,
  personaPreview,
  avatarImage = null,
  enterHub,
  i18n = createI18n(),
}) {
  const heroIdentity = identityFlow.getSelectedIdentity();
  const resolvedAvatar = avatarImage ?? loadAvatar(heroIdentity.avatarUrl);
  let confirmed = false;
  let elapsedMs = 0;
  const skillPreview = createClassSelectionSkillPreview({
    initialClassId: identityFlow.getSelectedClassId(),
  });

  function update(input, dt = 0) {
    const dtMs = Number.isFinite(dt) && dt > 0 ? dt * 1000 : 0;
    elapsedMs += dtMs;
    skillPreview.update(dtMs);
    const classDirection = readClassDirection(input);
    if (classDirection !== 0) {
      identityFlow.setSelectedClassId(
        identityFlow.getSelectedClassId() === "knight" ? "wizzard" : "knight",
      );
      skillPreview.selectClass(identityFlow.getSelectedClassId());
      return;
    }

    const skillDirection = readSkillDirection(input);
    if (skillDirection !== 0) {
      skillPreview.move(skillDirection);
      return;
    }

    if (!confirmed && input.wasPressed("confirm")) {
      confirmed = true;
      enterHub();
    }
  }

  function render(context) {
    const selectedClassId = identityFlow.getSelectedClassId();
    skillPreview.selectClass(selectedClassId);
    const rendered = drawClassSelectionScene(context, {
      width: surface.width,
      height: surface.height,
      tileset,
      selectedClassId,
      heroIdentity: identityFlow.getSelectedIdentity(),
      personaSource: personaPreview?.source,
      avatarImage: resolvedAvatar,
      elapsedMs,
      skillPreview: skillPreview.getSnapshot(),
      t: i18n.t,
    });
    return { selectedClassId, ...rendered };
  }

  return {
    update,
    render,
    getSelectedClassId: identityFlow.getSelectedClassId,
  };
}

function readClassDirection(input) {
  if (input.wasPressed("left")) {
    return -1;
  }
  if (input.wasPressed("right")) {
    return 1;
  }
  return 0;
}

function readSkillDirection(input) {
  if (input.wasPressed("up")) {
    return -1;
  }
  if (input.wasPressed("down")) {
    return 1;
  }
  return 0;
}

function loadAvatar(avatarUrl) {
  if (!avatarUrl || typeof globalThis.Image !== "function") {
    return null;
  }

  const image = new globalThis.Image();
  image.crossOrigin = "anonymous";
  image.src = avatarUrl;
  return image;
}
