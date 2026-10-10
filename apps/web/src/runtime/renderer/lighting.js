import { setImageSmoothing } from "./pixelSurface.js";

const WHITE = Object.freeze({ r: 255, g: 255, b: 255 });

export function createLightingLayer({ width, height, camera = null, createCanvas: canvasFactory }) {
  validateSize(width, height);

  const lightmap = (canvasFactory ?? createCanvas)(width, height);
  const context = lightmap.getContext("2d");

  if (!context) {
    throw new Error("无法创建光照贴图上下文");
  }

  setImageSmoothing(context, false);

  function begin(ambientColor) {
    context.save();
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.fillStyle = ambientColor;
    context.fillRect(0, 0, width, height);
    context.restore();
  }

  function addLight({ x, y, radius, color = "#ffffff", intensity = 1 }) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    const lightRadius = Math.round(radius);
    const lightIntensity = clamp(intensity, 0, 1);

    if (lightRadius <= 0 || lightIntensity <= 0) {
      return;
    }

    const screen = worldToScreen(camera, x, y);
    const screenX = Math.round(screen.x);
    const screenY = Math.round(screen.y);
    const rgb = parseHexColor(color) ?? WHITE;
    const gradient = context.createRadialGradient(
      screenX,
      screenY,
      0,
      screenX,
      screenY,
      lightRadius,
    );

    gradient.addColorStop(0, toRgba(rgb, lightIntensity));
    gradient.addColorStop(0.42, toRgba(rgb, lightIntensity * 0.52));
    gradient.addColorStop(1, toRgba(rgb, 0));

    context.save();
    context.globalCompositeOperation = "lighter";
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(screenX, screenY, lightRadius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function composite(targetContext) {
    targetContext.save();
    targetContext.globalAlpha = 1;
    targetContext.globalCompositeOperation = "multiply";
    targetContext.drawImage(lightmap, 0, 0, width, height);
    targetContext.restore();
  }

  return { begin, addLight, composite };
}

function validateSize(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError("光照贴图尺寸必须是正整数");
  }
}

function worldToScreen(camera, x, y) {
  if (camera && typeof camera.worldToScreen === "function") {
    return camera.worldToScreen(x, y);
  }

  return { x, y };
}

function parseHexColor(color) {
  if (typeof color !== "string" || !color.startsWith("#")) {
    return null;
  }

  if (color.length === 4) {
    return {
      r: Number.parseInt(color[1] + color[1], 16),
      g: Number.parseInt(color[2] + color[2], 16),
      b: Number.parseInt(color[3] + color[3], 16),
    };
  }

  if (color.length === 7) {
    return {
      r: Number.parseInt(color.slice(1, 3), 16),
      g: Number.parseInt(color.slice(3, 5), 16),
      b: Number.parseInt(color.slice(5, 7), 16),
    };
  }

  return null;
}

function toRgba({ r, g, b }, alpha) {
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createCanvas(width, height) {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  throw new Error("当前环境不支持 Canvas");
}
