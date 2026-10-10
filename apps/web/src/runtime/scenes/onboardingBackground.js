import { createArcLogoMark, arcCastleBrand } from "../../core/branding.js";
import { createRng, hashSeed } from "../../core/rng.js";
import { setImageSmoothing } from "../renderer/pixelSurface.js";
import { drawVignette } from "../renderer/postfx.js";
import { drawPixelText } from "../ui/pixelUi.js";
import { setPixelFont } from "../ui/pixelFont.js";
import { drawHeroNiche } from "./onboardingHeroNiche.js";

const TILE_SIZE = 16;
const FLOOR_Y = 128;
const DEFAULT_LOGO_UNIT = 2;
const DUST_COUNT = 14;
const DUST_TOP = 36;
const DUST_BOTTOM = 124;
const FLOOR_FRAME_NAMES = Object.freeze(
  Array.from({ length: 8 }, (_, index) => `floor_${index + 1}`),
);
const DECORATION_FRAME_NAMES = Object.freeze(["wall_hole_1", "wall_hole_2", "wall_goo"]);

/**
 * 入场两屏共用的标题舞台。三层按绘制顺序落下，登录页可额外显示门前英雄。
 */
export function drawOnboardingBackground(context, {
  width,
  height,
  tileset,
  elapsedMs = 0,
  logoUnit = DEFAULT_LOGO_UNIT,
  logoShadowMode = "outline",
  nicheLayout,
}) {
  const safeWidth = Math.round(width);
  const safeHeight = Math.round(height);
  const safeElapsedMs = Math.max(0, Number(elapsedMs) || 0);
  const seedLabel = `rialo-onboarding-hall:v2:${safeWidth}x${safeHeight}`;

  context.save();
  setImageSmoothing(context, false);
  const far = drawFarLayer(context, tileset, safeWidth, safeHeight, seedLabel);
  const portalGlowAlpha = calculatePortalGlowAlpha(safeElapsedMs);
  const middle = drawHeroNiche(context, tileset, {
    layer: "structure",
    elapsedMs: safeElapsedMs,
    glowAlpha: portalGlowAlpha,
    layout: nicheLayout,
  });
  const foreground = drawForegroundLayer(context, tileset, safeWidth, safeHeight);
  const dustParticles = createDustParticles(seedLabel, safeElapsedMs);
  drawDustParticles(context, dustParticles);
  const brand = drawArcLintelBrand(context, safeWidth, logoUnit, logoShadowMode);
  applyCentralVignette(context, safeWidth, safeHeight);
  context.restore();

  return {
    seedLabel,
    depthLayers: [
      { id: "far", componentCount: far.componentCount },
      { id: "middle", componentCount: middle.componentCount },
      { id: "foreground", componentCount: foreground.componentCount },
    ],
    decorationPlacements: far.decorations,
    decorationRects: far.decorations,
    fountainFrameNames: middle.fountainFrameNames,
    logoRects: brand.logoRects,
    logoOrigin: brand.logoOrigin,
    logoMark: brand.logoMark,
    logoUnit,
    brandIntegratedWithLintel: true,
    portalRect: middle.portalRect,
    visualRect: middle.visualRect,
    dustParticles,
    portalGlowAlpha,
    motionSignature: createMotionSignature(dustParticles, portalGlowAlpha),
  };
}

function drawFarLayer(context, tileset, width, height, seedLabel) {
  context.fillStyle = "#0b0810";
  context.fillRect(0, 0, width, height);
  let componentCount = 1;

  for (let x = 0; x < width; x += TILE_SIZE) {
    drawFrame(context, tileset, "wall_top_mid", x, 0);
    componentCount += 1;
  }
  for (let y = TILE_SIZE; y < FLOOR_Y; y += TILE_SIZE) {
    for (let x = 0; x < width; x += TILE_SIZE) {
      drawFrame(context, tileset, "wall_mid", x, y);
      componentCount += 1;
    }
  }

  const rng = createRng(hashSeed(seedLabel));
  const sideXs = [0, TILE_SIZE, width - TILE_SIZE * 2, width - TILE_SIZE];
  const decorations = rng.shuffle(sideXs).map((x, index) => {
    const frameName = DECORATION_FRAME_NAMES[rng.int(0, DECORATION_FRAME_NAMES.length)];
    if (frameName === "wall_goo") {
      drawFrame(context, tileset, "wall_goo_base", x, 32);
      componentCount += 1;
    }
    drawFrame(context, tileset, frameName, x, 32);
    componentCount += 1;
    return createPlacement(frameName, x, 32, TILE_SIZE, TILE_SIZE, index);
  });

  return { decorations, componentCount };
}

function drawForegroundLayer(context, tileset, width, height) {
  let componentCount = 0;
  for (let y = FLOOR_Y; y < height; y += TILE_SIZE) {
    for (let x = 0; x < width; x += TILE_SIZE) {
      const tileIndex = Math.floor(x / TILE_SIZE) + Math.floor((y - FLOOR_Y) / TILE_SIZE) * 3;
      const tileWidth = Math.min(TILE_SIZE, width - x);
      const tileHeight = Math.min(TILE_SIZE, height - y);
      drawCroppedFrame(
        context,
        tileset,
        FLOOR_FRAME_NAMES[tileIndex % FLOOR_FRAME_NAMES.length],
        x,
        y,
        tileWidth,
        tileHeight,
      );
      componentCount += 1;
    }
  }
  context.fillStyle = "#171019";
  context.fillRect(80, 128, 160, 4);
  context.fillStyle = "#251a25";
  context.fillRect(64, 144, 192, 4);
  componentCount += 2;
  return { componentCount };
}

function createDustParticles(seedLabel, elapsedMs) {
  const rng = createRng(hashSeed(`${seedLabel}:dust`));
  return Array.from({ length: DUST_COUNT }, (_, index) => {
    const x = rng.int(84, 237);
    const baseY = rng.int(DUST_TOP, DUST_BOTTOM);
    const speed = rng.int(1, 4);
    const travel = Math.floor(elapsedMs / 90) * speed;
    const y = DUST_TOP + positiveModulo(baseY - DUST_TOP - travel, DUST_BOTTOM - DUST_TOP);
    return Object.freeze({ x, y, size: rng.int(1, 3), order: index });
  });
}

function drawDustParticles(context, particles) {
  const previousAlpha = Number.isFinite(context.globalAlpha) ? context.globalAlpha : 1;
  context.globalAlpha = 0.42;
  context.fillStyle = "#ffe7a3";
  for (const particle of particles) {
    context.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  context.globalAlpha = previousAlpha;
}

function drawArcLintelBrand(context, width, logoUnit, shadowMode) {
  const enlarged = logoUnit >= 3;
  const size = enlarged ? 30 : 20;
  setPixelFont(context, size);
  const textWidth = Math.ceil(context.measureText(arcCastleBrand.label).width);
  const brandLeft = Math.round((width - logoUnit * 19 - textWidth) / 2);
  const logoOrigin = Object.freeze({ x: brandLeft, y: 3 });
  const logoMark = createArcLogoMark(logoOrigin.x, logoOrigin.y, logoUnit);
  const logoRects = logoMark.parts.map(normalizeLogoRect);

  for (const rect of logoRects) {
    const shadowRect = shadowMode === "offset"
      ? { ...rect, x: rect.x + 1, y: rect.y + 1 }
      : {
          x: rect.x - 1,
          y: rect.y - 1,
          width: rect.width + 2,
          height: rect.height + 2,
        };
    context.fillStyle = "#4b2f38";
    context.fillRect(shadowRect.x, shadowRect.y, shadowRect.width, shadowRect.height);
    context.fillStyle = rect.color;
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
  const textX = Math.round(brandLeft + logoUnit * 19);
  drawPixelText(context, arcCastleBrand.label, textX + 1, 8, { size, color: "#6f3f35" });
  drawPixelText(context, arcCastleBrand.label, textX, 7, { size, color: "#fff0b3" });
  return { logoOrigin, logoMark, logoRects };
}

function normalizeLogoRect(rect) {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
    color: rect.color,
  };
}

function calculatePortalGlowAlpha(elapsedMs) {
  return Number((0.2 + (Math.sin(elapsedMs / 520) + 1) * 0.07).toFixed(3));
}

function createMotionSignature(particles, glowAlpha) {
  return `${glowAlpha}:${particles.map(({ x, y }) => `${x},${y}`).join("|")}`;
}

function applyCentralVignette(context, width, height) {
  if (typeof context.createRadialGradient !== "function") return;
  drawVignette(context, { width, height, centerX: Math.round(width / 2), centerY: 94, intensity: 0.42 });
}

function createPlacement(frameName, x, y, width, height, order = 0) {
  return Object.freeze({
    frameName, x: Math.round(x), y: Math.round(y),
    width: Math.round(width), height: Math.round(height), order,
  });
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function drawCroppedFrame(context, tileset, frameName, x, y, width, height) {
  const frame = tileset?.frames?.[frameName] ?? tileset?.tiles?.[frameName] ?? null;
  const target = [Math.round(x), Math.round(y), Math.round(width), Math.round(height)];
  if (!tileset?.image || !frame || typeof context.drawImage !== "function") {
    context.fillStyle = "#332936";
    context.fillRect(...target);
    return;
  }
  context.drawImage(
    tileset.image,
    Math.round(frame.sx ?? frame.x),
    Math.round(frame.sy ?? frame.y),
    Math.min(Math.round(frame.sw ?? frame.width), target[2]),
    Math.min(Math.round(frame.sh ?? frame.height), target[3]),
    ...target,
  );
}

function drawFrame(context, tileset, frameName, x, y, width, height) {
  const frame = tileset?.frames?.[frameName] ?? tileset?.tiles?.[frameName] ?? null;
  const target = [
    Math.round(x), Math.round(y),
    Math.round(width ?? frame?.width ?? frame?.sw ?? TILE_SIZE),
    Math.round(height ?? frame?.height ?? frame?.sh ?? TILE_SIZE),
  ];
  if (!tileset?.image || !frame || typeof context.drawImage !== "function") {
    context.fillStyle = "#332936";
    context.fillRect(...target);
    return;
  }
  context.drawImage(
    tileset.image,
    Math.round(frame.sx ?? frame.x), Math.round(frame.sy ?? frame.y),
    Math.round(frame.sw ?? frame.width), Math.round(frame.sh ?? frame.height),
    ...target,
  );
}
