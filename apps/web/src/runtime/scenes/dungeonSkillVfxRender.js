/**
 * 战斗特效绘制层。
 *
 * 所有落笔坐标都取整，保持 320×180 内部分辨率下的像素对齐。
 * 与 `dungeonSkillVfx.js` 的 kind 字段一一对应，新增图元时两边同步。
 */

const DRAWERS = Object.freeze({
  ring: drawRing,
  trail: drawTrail,
  spark: drawSpark,
  shield: drawShield,
  node: drawNode,
  dot: drawDot,
  enemyAim: drawEnemyAim,
  enemyShot: drawEnemyShot,
});

export function drawSkillVfx(context, effects, camera) {
  if (!Array.isArray(effects) || effects.length === 0) {
    return;
  }

  context.save();

  for (const effect of effects) {
    const delayMs = effect.delayMs ?? 0;

    if (effect.ageMs < delayMs) {
      continue;
    }

    const phase = clamp01((effect.ageMs - delayMs) / Math.max(1, effect.maxAgeMs - delayMs));
    const drawer = DRAWERS[effect.kind];

    if (!drawer) {
      continue;
    }

    context.globalAlpha = effect.alpha ?? Math.max(0, 1 - phase);
    drawer(context, effect, camera, phase);
  }

  context.restore();
}

function drawRing(context, effect, camera, phase) {
  const screen = camera.worldToScreen(effect.x, effect.y);
  const radius = Math.round(effect.startRadius + (effect.endRadius - effect.startRadius) * phase);

  if (radius <= 0) {
    return;
  }

  context.lineWidth = Math.max(1, Math.round(effect.width ?? 2));
  context.strokeStyle = effect.color;
  context.beginPath();
  context.arc(Math.round(screen.x), Math.round(screen.y), radius, 0, Math.PI * 2);
  context.stroke();
}

function drawTrail(context, effect, camera) {
  const start = camera.worldToScreen(effect.x1, effect.y1);
  const end = camera.worldToScreen(effect.x2, effect.y2);

  context.lineWidth = Math.max(1, Math.round(effect.width ?? 2));
  context.strokeStyle = effect.color;
  context.beginPath();
  context.moveTo(Math.round(start.x), Math.round(start.y));
  context.lineTo(Math.round(end.x), Math.round(end.y));
  context.stroke();
}

function drawSpark(context, effect, camera) {
  const screen = camera.worldToScreen(effect.x, effect.y);
  const size = Math.max(1, Math.round(effect.size ?? 1));

  context.fillStyle = effect.color;
  context.fillRect(Math.round(screen.x), Math.round(screen.y), size, size);
}

function drawShield(context, effect, camera, phase) {
  const screen = camera.worldToScreen(effect.x, effect.y);
  const width = Math.round(6 + phase * 4);
  const height = Math.round(16 - phase * 4);

  context.save();
  context.translate(Math.round(screen.x), Math.round(screen.y));
  context.rotate(effect.angle);
  context.fillStyle = effect.color;
  context.fillRect(-Math.round(width / 2), -Math.round(height / 2), width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(-Math.round(width / 2) + 1, -Math.round(height / 2) + 1, 1, height - 2);
  context.restore();
}

function drawNode(context, effect, camera, phase) {
  const screen = camera.worldToScreen(effect.x, effect.y);
  const radius = Math.max(1, Math.round((effect.radius ?? 6) * (1 - phase)));
  const x = Math.round(screen.x);
  const y = Math.round(screen.y);

  context.fillStyle = effect.color;
  context.fillRect(x - radius, y - 1, radius * 2, 2);
  context.fillRect(x - 1, y - radius, 2, radius * 2);
}

function drawDot(context, effect, camera, phase) {
  const screen = camera.worldToScreen(effect.x, effect.y);
  const size = Math.max(1, Math.round((effect.size ?? 2) * (1 - phase)));

  context.fillStyle = effect.color;
  context.fillRect(Math.round(screen.x), Math.round(screen.y), size, size);
}

/** 暖橙瞄准线与玩家端十字准星，线宽由前摇进度数据持续增强。 */
function drawEnemyAim(context, effect, camera) {
  const start = pixelPoint(camera, effect.x1, effect.y1);
  const end = pixelPoint(camera, effect.x2, effect.y2);
  const size = 2 + Math.round((effect.chargePhase ?? 0) * 2);

  drawLine(context, start, end, effect.color, effect.width);
  context.fillStyle = effect.color;
  context.fillRect(end.x - size, end.y, size * 2 + 1, 1);
  context.fillRect(end.x, end.y - size, 1, size * 2 + 1);
}

/** 击发束使用橙红外束、暖白核心与命中端闪光，短时间内快速消散。 */
function drawEnemyShot(context, effect, camera, phase) {
  const start = pixelPoint(camera, effect.x1, effect.y1);
  const end = pixelPoint(camera, effect.x2, effect.y2);
  const outerWidth = Math.max(2, Math.round(5 - phase * 3));
  const coreWidth = Math.max(1, Math.round(2 - phase));
  const flashSize = Math.max(1, Math.round(4 - phase * 3));

  drawLine(context, start, end, "#ff6a3d", outerWidth);
  drawLine(context, start, end, effect.color, coreWidth);
  context.fillStyle = effect.color;
  context.fillRect(end.x - flashSize, end.y, flashSize * 2 + 1, 1);
  context.fillRect(end.x, end.y - flashSize, 1, flashSize * 2 + 1);
}

function drawLine(context, start, end, color, width) {
  context.lineWidth = Math.max(1, Math.round(width ?? 1));
  context.strokeStyle = color;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
}

function pixelPoint(camera, x, y) {
  const screen = camera.worldToScreen(x, y);
  return { x: Math.round(screen.x), y: Math.round(screen.y) };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
