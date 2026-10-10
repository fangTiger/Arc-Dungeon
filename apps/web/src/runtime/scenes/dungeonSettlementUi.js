import {
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
} from "../renderer/pixelSurface.js";
import { drawGamePanel } from "./gamePanelUi.js";
import { translate } from "../../core/i18n/index.js";

export function drawSettlementOverlay(context, flow, tileset = null, { t = translate } = {}) {
  if (!flow?.run) {
    return;
  }

  const darkness = Math.min(0.86, 0.28 + flow.timer * 0.18);
  const lines = createSettlementLines(flow, t);

  context.save();
  context.fillStyle = `rgba(0, 0, 0, ${darkness})`;
  context.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

  const rendered = drawGamePanel(context, {
    kind: "settlement",
    title: lines[0],
    width: 248,
    accent: flow.status === "failed" ? "#d65a42" : "#d4af64",
    lines: lines.slice(1).map((text, index) => ({
      text,
      color: index === 0 && flow.status === "failed" ? "#ffb08a" : "#f7efd0",
    })),
    actions: [
      {
        id: "return",
        label: t(flow.inputReady ? "settlement.action.return" : "settlement.action.confirming"),
        disabled: !flow.inputReady,
        disabledReason: t("settlement.action.processing"),
        accent: "#d4af64",
      },
    ],
    selectedIndex: 0,
  }, tileset, { t });
  context.restore();
  return rendered;
}

function createSettlementLines(flow, t) {
  if (flow.status === "settling") {
    return [
      t("settlement.status.settling"),
      t("settlement.depth", { depth: flow.run.depth }),
      t("settlement.bosses", { count: flow.run.stats?.bossesDefeated ?? 0 }),
    ];
  }

  if (flow.status === "failed") {
    return [
      t("settlement.status.failed"),
      flow.errorText || t("settlement.retry"),
      t(flow.inputReady ? "settlement.returnHint" : "settlement.action.confirming"),
    ];
  }

  const settlement = flow.settlement;
  const bagSettlement = settlement.bagSettlement;
  const ratioLine = bagSettlement?.reason === "death"
    ? t("settlement.lossCredit", {
      loss: formatPercent(1 - bagSettlement.retentionRate),
      tokens: settlement.rewards.tokens,
    })
    : t("settlement.fullCredit", { tokens: settlement.rewards.tokens });
  const explorationBonus = bagSettlement
    ? t("settlement.explorationBonus", { multiplier: formatMultiplier(bagSettlement.explorationMultiplier) })
    : t("settlement.exploration", { rate: Math.round(settlement.explorationRate * 100) });

  return [
    t("settlement.status.complete"),
    t("settlement.depth", { depth: settlement.depthReached }),
    t("settlement.bosses", { count: settlement.bossesDefeated }),
    t("settlement.exploration", { rate: Math.round(settlement.explorationRate * 100) }),
    explorationBonus,
    t("settlement.bag", { tokens: bagSettlement?.bagTokens ?? 0 }),
    ratioLine,
    t("settlement.balance", { tokens: settlement.balance.tokens }),
    t(flow.inputReady ? "settlement.returnHint" : "settlement.action.confirming"),
  ];
}

function formatPercent(value) {
  return `${Math.round(Math.max(0, value) * 100)}%`;
}

function formatMultiplier(value) {
  return Number(value).toFixed(2);
}
