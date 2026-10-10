export const INTERNAL_WIDTH = 320;
export const INTERNAL_HEIGHT = 180;
export const TILE_SIZE = 16;

export function createPixelSurface(displayCanvas) {
  const offscreen = createOffscreenCanvas(INTERNAL_WIDTH, INTERNAL_HEIGHT);
  const context = offscreen.getContext("2d");
  const displayContext = displayCanvas.getContext("2d");

  if (!context || !displayContext) {
    throw new Error("无法创建像素渲染画布上下文");
  }

  let scale = 1;

  setImageSmoothing(context, false);
  setImageSmoothing(displayContext, false);
  resize();

  function resize() {
    const { cssWidth, cssHeight } = getAvailableSize(displayCanvas);
    scale = Math.max(
      1,
      Math.floor(Math.min(cssWidth / INTERNAL_WIDTH, cssHeight / INTERNAL_HEIGHT)),
    );

    const displayWidth = INTERNAL_WIDTH * scale;
    const displayHeight = INTERNAL_HEIGHT * scale;

    displayCanvas.width = displayWidth;
    displayCanvas.height = displayHeight;
    displayCanvas.style.width = `${displayWidth}px`;
    displayCanvas.style.height = `${displayHeight}px`;
    setImageSmoothing(context, false);
    setImageSmoothing(displayContext, false);
  }

  function present() {
    setImageSmoothing(displayContext, false);
    displayContext.drawImage(
      offscreen,
      0,
      0,
      INTERNAL_WIDTH,
      INTERNAL_HEIGHT,
      0,
      0,
      INTERNAL_WIDTH * scale,
      INTERNAL_HEIGHT * scale,
    );
  }

  return {
    context,
    width: INTERNAL_WIDTH,
    height: INTERNAL_HEIGHT,
    resize,
    present,
    get scale() {
      return scale;
    },
  };
}

export function setImageSmoothing(context, enabled) {
  context.imageSmoothingEnabled = enabled;
  context.mozImageSmoothingEnabled = enabled;
  context.webkitImageSmoothingEnabled = enabled;
  context.msImageSmoothingEnabled = enabled;
}

function createOffscreenCanvas(width, height) {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  throw new Error("当前环境不支持离屏画布");
}

function getAvailableSize(displayCanvas) {
  const container = displayCanvas.parentElement ?? displayCanvas;
  const bounds = container.getBoundingClientRect();
  const cssWidth = bounds.width || INTERNAL_WIDTH;
  const cssHeight = bounds.height || INTERNAL_HEIGHT;

  return { cssWidth, cssHeight };
}
