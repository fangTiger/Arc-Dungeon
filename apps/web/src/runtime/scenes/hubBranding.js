import { createArcLogoMark, arcCastleBrand } from "../../core/branding.js";
import { drawPixelText } from "../ui/pixelUi.js";

export function drawHubBranding(context) {
  const mark = arcCastleBrand.environmentMark;
  const x = Math.round(mark.x);
  const y = Math.round(mark.y);
  const unit = Math.round(mark.logoUnit);
  const logo = createArcLogoMark(x, y + 2, unit);

  context.save();
  drawWallReliefBacking(context, x, y);

  for (const part of logo.parts) {
    const left = Math.round(part.x);
    const top = Math.round(part.y);
    const width = Math.max(1, Math.round(part.width));
    const height = Math.max(1, Math.round(part.height));
    context.fillStyle = "#6e5131";
    context.fillRect(left + 1, top + 1, width, height);
    context.fillStyle = part.color;
    context.fillRect(left, top, width, height);
  }

  if (mark.showTextLabel) {
    drawPixelText(context, arcCastleBrand.label, x + 24, y + 2, { color: "#120d0d" });
    drawPixelText(context, arcCastleBrand.label, x + 23, y + 1, { color: "#f7efd0" });
  }

  context.restore();
}

function drawWallReliefBacking(context, x, y) {
  context.fillStyle = "#5b4b45";
  context.fillRect(x - 7, y - 2, 74, 1);
  context.fillStyle = "#2a201d";
  context.fillRect(x - 7, y + 11, 74, 1);
  context.fillStyle = "#171019";
  context.fillRect(x - 7, y + 12, 74, 1);

  context.fillStyle = "#3f2f29";
  for (const offset of [9, 25, 41, 57]) {
    context.fillRect(x - 7 + offset, y - 1, 1, 12);
  }
}
