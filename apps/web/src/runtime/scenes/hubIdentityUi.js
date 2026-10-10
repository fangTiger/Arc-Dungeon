import { setImageSmoothing } from "../renderer/pixelSurface.js";
import { drawGamePanel } from "./gamePanelUi.js";
import { IDENTITY_PANEL_WIDTH } from "./hubIdentityFlow.js";

export function drawHubIdentityPanel(context, viewModel, tileset, options = {}) {
  if (!viewModel || viewModel.mode === "closed") {
    return;
  }

  context.save();
  setImageSmoothing(context, false);

  const rendered = drawIdentityCard(context, viewModel, tileset, options);

  context.restore();
  return rendered;
}

function drawIdentityCard(context, viewModel, tileset, options) {
  const hero = viewModel.heroIdentity;
  if (!hero) {
    return;
  }

  return drawGamePanel(context, {
    kind: "identity",
    title: hero.displayName,
    width: IDENTITY_PANEL_WIDTH,
    accent: "#ffcf8a",
    lines: viewModel.profileLines,
    linesPrewrapped: true,
    actions: viewModel.actions,
    selectedLineIndex: viewModel.selectedLineIndex,
    footerText: viewModel.footerText,
  }, tileset, options);
}
