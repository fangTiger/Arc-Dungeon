export function buildNineSliceLayout({ x = 0, y = 0, width, height, tileSize }) {
  assertPositiveInteger(width, "九宫格宽度必须是正整数");
  assertPositiveInteger(height, "九宫格高度必须是正整数");
  assertPositiveInteger(tileSize, "九宫格 tile 尺寸必须是正整数");

  if (width < tileSize * 2 || height < tileSize * 2) {
    throw new RangeError("九宫格尺寸不能小于两倍 tile 尺寸");
  }

  const left = Math.round(x);
  const top = Math.round(y);
  const safeWidth = Math.round(width);
  const safeHeight = Math.round(height);
  const right = left + safeWidth - tileSize;
  const bottom = top + safeHeight - tileSize;
  const innerX = left + tileSize;
  const innerY = top + tileSize;
  const innerWidth = safeWidth - tileSize * 2;
  const innerHeight = safeHeight - tileSize * 2;

  return {
    bounds: { x: left, y: top, width: safeWidth, height: safeHeight },
    corners: {
      topLeft: rect(left, top, tileSize, tileSize),
      topRight: rect(right, top, tileSize, tileSize),
      bottomLeft: rect(left, bottom, tileSize, tileSize),
      bottomRight: rect(right, bottom, tileSize, tileSize),
    },
    edges: {
      top: repeatHorizontal(innerX, top, innerWidth, tileSize),
      right: repeatVertical(right, innerY, innerHeight, tileSize),
      bottom: repeatHorizontal(innerX, bottom, innerWidth, tileSize),
      left: repeatVertical(left, innerY, innerHeight, tileSize),
    },
    fill: rect(innerX, innerY, innerWidth, innerHeight),
  };
}

function repeatHorizontal(x, y, width, tileSize) {
  const parts = [];
  let cursor = 0;

  while (cursor < width) {
    const partWidth = Math.min(tileSize, width - cursor);
    parts.push(rect(x + cursor, y, partWidth, tileSize));
    cursor += partWidth;
  }

  return parts;
}

function repeatVertical(x, y, height, tileSize) {
  const parts = [];
  let cursor = 0;

  while (cursor < height) {
    const partHeight = Math.min(tileSize, height - cursor);
    parts.push(rect(x, y + cursor, tileSize, partHeight));
    cursor += partHeight;
  }

  return parts;
}

function rect(x, y, width, height) {
  return { x, y, width, height };
}

function assertPositiveInteger(value, message) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(message);
  }
}
