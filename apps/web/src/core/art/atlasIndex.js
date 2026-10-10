export function parseTileList(text) {
  const index = new Map();

  for (const rawLine of String(text).split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const parts = line.split(/\s+/u);
    if (parts.length !== 5) {
      continue;
    }

    const [name, rawX, rawY, rawWidth, rawHeight] = parts;
    const frame = {
      x: Number(rawX),
      y: Number(rawY),
      width: Number(rawWidth),
      height: Number(rawHeight),
    };

    if (!isValidFrameName(name) || !isValidFrame(frame)) {
      continue;
    }

    index.set(name, frame);
  }

  return index;
}

export function getFrames(index, baseName, frameCount) {
  if (!Number.isInteger(frameCount) || frameCount <= 0) {
    throw new RangeError("动画帧数量必须是正整数");
  }

  return Array.from({ length: frameCount }, (_, frameIndex) => {
    const frameName = `${baseName}_f${frameIndex}`;
    const frame = readFrame(index, frameName);

    if (!frame) {
      throw new Error(`缺少图集帧：${frameName}`);
    }

    return frame;
  });
}

export function createAnimation({ frames, fps }) {
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new RangeError("动画至少需要一帧");
  }

  if (!Number.isFinite(fps) || fps <= 0) {
    throw new RangeError("动画 fps 必须大于 0");
  }

  const frameDurationMs = 1000 / fps;

  return {
    frameAt(elapsedMs) {
      const safeElapsedMs = Math.max(0, Number(elapsedMs) || 0);
      const frameIndex = Math.floor(safeElapsedMs / frameDurationMs) % frames.length;
      return frames[frameIndex];
    },
  };
}

function readFrame(index, frameName) {
  if (index instanceof Map) {
    return index.get(frameName);
  }

  return index?.[frameName] ?? null;
}

function isValidFrameName(name) {
  return typeof name === "string" && name.length > 0;
}

function isValidFrame({ x, y, width, height }) {
  return [x, y, width, height].every(Number.isInteger) && width > 0 && height > 0;
}
