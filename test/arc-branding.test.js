import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import * as branding from "../apps/web/src/core/branding.js";
import { drawHubBranding } from "../apps/web/src/runtime/scenes/hubBranding.js";
import { drawOnboardingBackground } from "../apps/web/src/runtime/scenes/onboardingBackground.js";

function recordingContext() {
  const context = {
    texts: [], rects: [],
    save() {}, restore() {},
    fillRect(x, y, width, height) { this.rects.push({ x, y, width, height, color: this.fillStyle }); },
    fillText(text, x, y) { this.texts.push({ text, x, y }); },
    measureText: (text) => ({ width: text.length * 10 }),
    createRadialGradient: () => ({ addColorStop() {} }),
  };
  return context;
}

test("ARC 标记采用原创像素拱门和星点，不复用 Rialo 几何", () => {
  assert.equal(typeof branding.createArcLogoMark, "function");
  const mark = branding.createArcLogoMark(0, 0, 1);
  assert.equal(mark.kind, "arc-portal-star");
  const oldGeometry = [
    { x: 3, y: 0, width: 9, height: 3 }, { x: 9, y: 1.5, width: 4, height: 5 },
    { x: 0.5, y: 5, width: 8.5, height: 3 }, { x: 9, y: 5, width: 5, height: 3 },
    { x: 8.7, y: 6.7, width: 3.2, height: 8.5 },
  ];
  assert.notDeepEqual(mark.parts.map(({ x, y, width, height }) => ({ x, y, width, height })),
    oldGeometry);
  assert.ok(mark.parts.some((part) => part.role === "star"));
  assert.ok(mark.parts.every((part) => [part.x, part.y, part.width, part.height].every(Number.isInteger)));
  assert.equal(branding.createRialoLogoMark, undefined);
});

test("主城实际绘制 ARC 标题和全套新标记", () => {
  const context = recordingContext();
  drawHubBranding(context);
  assert.ok(context.texts.some(({ text }) => text === "ARC"));
  assert.ok(context.texts.every(({ text }) => !/rialo/i.test(text)));
  const origin = branding.arcCastleBrand.environmentMark;
  const mark = branding.createArcLogoMark(origin.x, origin.y + 2, origin.logoUnit);
  for (const part of mark.parts) {
    assert.ok(context.rects.some((rect) => rect.x === part.x && rect.y === part.y
      && rect.width === part.width && rect.height === part.height && rect.color === part.color));
  }
});

test("入口与职业选择共用背景只绘制 ARC，图形与文字不重叠", () => {
  for (const unit of [1.5, 2, 3]) {
    const context = recordingContext();
    const rendered = drawOnboardingBackground(context, { width: 320, height: 180, logoUnit: unit });
    const title = context.texts.find(({ text }) => text === "ARC");
    assert.ok(title, "应绘制 ARC 标题");
    assert.ok(context.texts.every(({ text }) => !/rialo/i.test(text)));
    assert.equal(rendered.logoMark.kind, "arc-portal-star");
    assert.ok(rendered.logoRects.every((rect) => rect.x + rect.width < title.x));
  }
});

test("顶栏和 favicon 使用同一 SVG，SVG 几何来自 Canvas 标记", async () => {
  const html = await readFile(new URL("../apps/web/index.html", import.meta.url), "utf8");
  assert.match(html, /rel="icon" href="\.\/assets\/branding\/arc-logo\.svg"/);
  assert.match(html, /<img[^>]*src="\.\/assets\/branding\/arc-logo\.svg"/);
  const svg = await readFile(new URL("../apps/web/assets/branding/arc-logo.svg", import.meta.url), "utf8");
  for (const part of branding.createArcLogoMark(0, 0, 1).parts) {
    assert.ok(svg.includes(`x="${part.x}" y="${part.y}" width="${part.width}" height="${part.height}" fill="${part.color}"`));
  }
});
