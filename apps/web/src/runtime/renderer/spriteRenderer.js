export function createSpriteRenderer() {
  function drawShadow(context, sprite, camera) {
    if (
      !sprite?.castsShadow ||
      !sprite.frame ||
      typeof context.beginPath !== "function" ||
      typeof context.ellipse !== "function"
    ) {
      return;
    }

    const frame = getFrameBox(sprite.frame);
    const footX = sprite.shadowX ?? sprite.x + frame.sw / 2;
    const footY = sprite.shadowY ?? sprite.y + frame.sh;
    const screen = camera.worldToScreen(footX, footY);
    const width = Math.max(4, Math.round((sprite.shadowWidth ?? frame.sw) * 0.7));
    const height = Math.max(2, Math.round(width * 0.48));

    context.save();
    context.fillStyle = sprite.shadowColor ?? "rgba(0, 0, 0, 0.28)";
    context.beginPath();
    context.ellipse(
      Math.round(screen.x),
      Math.round(screen.y) - 1,
      Math.round(width / 2),
      Math.round(height / 2),
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.restore();
  }

  function draw(context, sprite, camera) {
    if (!sprite?.image || !sprite.frame) {
      return;
    }

    const screen = camera.worldToScreen(sprite.x, sprite.y);
    const x = Math.round(screen.x);
    const y = Math.round(screen.y);
    const frame = getFrameBox(sprite.frame);
    const scale = Number.isFinite(sprite.scale) ? sprite.scale : 1;
    const alpha = Number.isFinite(sprite.alpha) ? sprite.alpha : 1;

    if (sprite.flipX || scale !== 1 || sprite.tintColor || Number.isFinite(sprite.alpha)) {
      context.save();
      context.globalAlpha = alpha;
      context.translate(
        x + Math.round(frame.sw / 2),
        y + Math.round(frame.sh / 2),
      );
      context.scale(sprite.flipX ? -scale : scale, scale);
      drawImageFrame(context, sprite.image, frame, -Math.round(frame.sw / 2), -Math.round(frame.sh / 2));

      if (sprite.tintColor) {
        context.globalAlpha = alpha * clamp(sprite.tintAlpha ?? 1, 0, 1);
        context.globalCompositeOperation = "source-atop";
        context.fillStyle = sprite.tintColor;
        context.fillRect(
          -Math.round(frame.sw / 2),
          -Math.round(frame.sh / 2),
          frame.sw,
          frame.sh,
        );
      }

      context.restore();
      return;
    }

    drawImageFrame(context, sprite.image, frame, x, y);
  }

  function drawSorted(context, sprites, camera) {
    for (const sprite of [...sprites].sort((left, right) => getSortY(left) - getSortY(right))) {
      draw(context, sprite, camera);
    }
  }

  function drawShadows(context, sprites, camera) {
    for (const sprite of [...sprites].sort((left, right) => getSortY(left) - getSortY(right))) {
      drawShadow(context, sprite, camera);
    }
  }

  return { draw, drawSorted, drawShadows };
}

function drawImageFrame(context, image, frame, x, y) {
  context.drawImage(
    image,
    frame.sx,
    frame.sy,
    frame.sw,
    frame.sh,
    x,
    y,
    frame.sw,
    frame.sh,
  );
}

function getFrameBox(frame) {
  return {
    sx: frame.sx ?? frame.x,
    sy: frame.sy ?? frame.y,
    sw: frame.sw ?? frame.width,
    sh: frame.sh ?? frame.height,
  };
}

function getSortY(sprite) {
  return Number.isFinite(sprite.sortY) ? sprite.sortY : sprite.y;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
