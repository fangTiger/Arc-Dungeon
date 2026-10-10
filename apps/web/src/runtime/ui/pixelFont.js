export const PIXEL_FONT_SIZE = 10;
export const PIXEL_FONT_STACK = "\"ArkPixelLatin\", \"ArkPixelZhCn\", monospace";

let warnedFontFallback = false;

export async function loadPixelFonts() {
  if (typeof document === "undefined" || !document.fonts) {
    warnFontFallback("无法检测像素字体加载状态，已回退到 monospace。");
    return { ok: false, family: PIXEL_FONT_STACK };
  }

  try {
    const [latinFaces, zhFaces] = await Promise.all([
      document.fonts.load(`${PIXEL_FONT_SIZE}px "ArkPixelLatin"`),
      document.fonts.load(`${PIXEL_FONT_SIZE}px "ArkPixelZhCn"`),
    ]);
    const ok = latinFaces.length > 0 && zhFaces.length > 0;

    if (!ok) {
      warnFontFallback("像素字体未完整加载，已回退到 monospace。");
    }

    return { ok, family: PIXEL_FONT_STACK };
  } catch (error) {
    warnFontFallback(`像素字体加载失败，已回退到 monospace：${getErrorMessage(error)}`);
    return { ok: false, family: PIXEL_FONT_STACK };
  }
}

export function setPixelFont(context, size = PIXEL_FONT_SIZE) {
  if (!Number.isInteger(size) || size <= 0 || size % PIXEL_FONT_SIZE !== 0) {
    throw new RangeError("像素字体字号必须是 10px 的整数倍");
  }

  context.font = `${size}px ${PIXEL_FONT_STACK}`;
  context.textBaseline = "top";
}

function warnFontFallback(message) {
  if (!warnedFontFallback) {
    console.warn(message);
    warnedFontFallback = true;
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
