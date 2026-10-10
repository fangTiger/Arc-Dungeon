export function measurePixelText(text, options = {}) {
  const cjkWidth = positiveNumber(options.cjkWidth, 10);
  const latinWidth = positiveNumber(options.latinWidth, 5);
  const spaceWidth = positiveNumber(options.spaceWidth, latinWidth);
  const measureChar = typeof options.measureChar === "function"
    ? options.measureChar
    : (char) => fallbackCharWidth(char, { cjkWidth, latinWidth, spaceWidth });

  return [...String(text)].reduce(
    (width, char) => width + measuredCharWidth(char, measureChar),
    0,
  );
}

export function wrapPixelText(text, options = {}) {
  const maxWidth = positiveNumber(options.maxWidth, 0);
  if (maxWidth <= 0) {
    return [];
  }

  const chars = [...String(text)];
  if (chars.some((char) => measurePixelText(char, options) > maxWidth)) {
    throw new RangeError("最大宽度不能小于单字宽度");
  }
  const lines = [];
  let line = "";

  for (const char of chars) {
    const nextLine = `${line}${char}`;
    if (line && measurePixelText(nextLine.trimEnd(), options) > maxWidth) {
      lines.push(line.trimEnd());
      line = char.trimStart();
    } else {
      line = nextLine;
    }
  }

  if (line.trimEnd()) {
    lines.push(line.trimEnd());
  }

  return lines;
}

function fallbackCharWidth(char, { cjkWidth, latinWidth, spaceWidth }) {
  if (/\s/u.test(char)) {
    return spaceWidth;
  }

  return isWideCharacter(char) ? cjkWidth : latinWidth;
}

function measuredCharWidth(char, measureChar) {
  const width = Number(measureChar(char));
  if (!Number.isFinite(width) || width < 0) {
    throw new RangeError("字宽测量必须返回非负有限数值");
  }
  return width;
}

function isWideCharacter(char) {
  return /[\u3000-\u303f\u3400-\u9fff\ufe30-\ufe4f\uf900-\ufaff\uff01-\uff60\uffe0-\uffe6]/u.test(char);
}

function positiveNumber(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
