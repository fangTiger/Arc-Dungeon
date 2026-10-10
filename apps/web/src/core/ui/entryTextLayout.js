import { wrapPixelText } from "./textLayout.js";

/**
 * 为角色画像的两段长文本生成完整行布局，不限制行数，也不添加省略号。
 */
export function layoutEntryProfileText({
  narrativeSummary,
  npcFirstImpression,
  maxWidth,
  fontSize = 10,
  measureChar,
}) {
  if (!Number.isInteger(fontSize) || fontSize < 10 || fontSize % 10 !== 0) {
    throw new RangeError("像素字体必须使用 10px 或其整数倍");
  }

  const options = {
    maxWidth,
    cjkWidth: fontSize,
    latinWidth: Math.ceil(fontSize / 2),
    spaceWidth: Math.ceil(fontSize / 2),
    measureChar,
  };

  return {
    narrativeSummary: createSection(narrativeSummary, options),
    npcFirstImpression: createSection(npcFirstImpression, options),
  };
}

function createSection(text, options) {
  const normalizedText = String(text ?? "").trim();
  return {
    text: normalizedText,
    lines: wrapPixelText(normalizedText, options),
  };
}
