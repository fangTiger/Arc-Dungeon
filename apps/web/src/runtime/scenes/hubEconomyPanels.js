import { SKIN_BOX_TOKEN_COST } from "../../core/economy/constants.js";
import { localizeSkin } from "../../core/economy/skins.js";
import { translate } from "../../core/i18n/index.js";
import {
  EXTRA_TICKET_TOKEN_COST,
  MAX_TICKET_HOLDINGS,
  MAX_TICKET_INVESTMENT,
  MIN_TICKET_INVESTMENT,
  ticketInvestmentModifiers,
} from "../../core/economy/tickets.js";
export function createTicketPanel({
  snapshot,
  selectedTicketCount,
  pendingAction,
  message,
  t = translate,
}) {
  const heldTickets = ticketCountFromSnapshot(snapshot);
  const tokens = snapshot?.balance?.tokens ?? "...";
  const modifiers = ticketInvestmentModifiers(selectedTicketCount);
  const isPending = Boolean(pendingAction);
  const canEnter = heldTickets >= selectedTicketCount && !isPending;
  const canBuy = Number.isFinite(tokens) && tokens >= EXTRA_TICKET_TOKEN_COST && heldTickets < MAX_TICKET_HOLDINGS && !isPending;
  const claimState = dailyClaimState(snapshot, t);
  const buyReason = ticketBuyDisabledReason({ tokens, heldTickets, isPending }, t);
  const enterReason = isPending ? t("common.processing") : t("hub.ticket.insufficient");

  return {
    kind: "tickets",
    title: t("hub.ticket.title"),
    accent: "#d4af64",
    lines: [
      { text: t("hub.ticket.held", { held: heldTickets, max: MAX_TICKET_HOLDINGS }) },
      { text: `Token ${tokens}` },
      { text: message || t(canEnter ? "hub.ticket.risk" : "hub.ticket.denied"), color: canEnter ? "#f7efd0" : "#ffb08a" },
    ],
    actions: [
      {
        id: "claim-daily",
        label: t("hub.ticket.claimDaily"),
        shortcut: "choice1",
        shortcutLabel: "1",
        disabled: !claimState.available || isPending,
        disabledReason: isPending ? t("common.processing") : claimState.reason,
        accent: "#8bdc7a",
      },
      {
        id: "ticket-count",
        kind: "value",
        label: t("hub.ticket.stake", {
          count: selectedTicketCount,
          loot: formatMultiplier(modifiers.lootMultiplier),
          difficulty: formatMultiplier(modifiers.difficultyMultiplier),
        }),
        value: selectedTicketCount,
        min: MIN_TICKET_INVESTMENT,
        max: ticketSelectionLimit(snapshot),
        step: 1,
        accent: "#96cdff",
      },
      {
        id: "buy-ticket",
        label: t("hub.ticket.buy"),
        shortcut: "choice2",
        disabled: !canBuy,
        disabledReason: buyReason,
        accent: "#f0b45d",
      },
      {
        id: "enter-dungeon",
        label: t("hub.ticket.enter"),
        disabled: !canEnter,
        disabledReason: enterReason,
        accent: "#d4af64",
      },
    ],
  };
}

export function createMerchantPanel({
  snapshot,
  pendingAction,
  message,
  lastResult,
  t = translate,
}) {
  const tokens = snapshot?.balance?.tokens ?? "...";
  const boxCount = snapshot?.profile?.skinBoxes ?? 0;
  const isPending = Boolean(pendingAction);
  const canExchange = Number.isFinite(tokens) && tokens >= SKIN_BOX_TOKEN_COST && !isPending;
  const canOpen = boxCount > 0 && !isPending;
  const openedSkin = lastResult?.skin;
  const localizedSkin = openedSkin ? localizeSkin(openedSkin, t) : null;
  const exchangeReason = isPending
    ? t("common.processing")
    : Number.isFinite(tokens)
      ? t("hub.ticket.cost", { cost: SKIN_BOX_TOKEN_COST, tokens })
      : t("common.syncing");
  const openReason = isPending ? t("common.processing") : t("hub.merchant.noBox");

  return {
    kind: "merchant",
    title: t("hub.merchant.title"),
    rarity: openedSkin?.rarity,
    accent: "#ffcf8a",
    lines: [
      { text: t("hub.merchant.tokenProgress", { tokens, cost: SKIN_BOX_TOKEN_COST }) },
      { text: t("hub.merchant.boxCount", { count: boxCount }) },
      localizedSkin
        ? { text: t("hub.merchant.opened", { name: localizedSkin.name, rarity: localizedSkin.rarityLabel }), color: "#ffe3a3" }
        : { text: message || t("hub.merchant.available") },
      { text: t("hub.merchant.onchainFuture"), color: "#ffe3a3" },
      { text: t("hub.merchant.localAsset"), color: "#b7a98f" },
    ],
    actions: [
      {
        id: "exchange-box",
        label: t("hub.merchant.exchange"),
        shortcut: "choice1",
        shortcutLabel: "1",
        disabled: !canExchange,
        disabledReason: exchangeReason,
        accent: "#f0b45d",
      },
      {
        id: "open-box",
        label: t("hub.merchant.open"),
        shortcut: "choice2",
        shortcutLabel: "2",
        disabled: !canOpen,
        disabledReason: openReason,
        accent: "#96cdff",
      },
    ],
  };
}

export function createNoticeboardPanel(profile, t = translate) {
  const skins = profile?.ownedSkins?.length
    ? profile.ownedSkins.map((skin) => localizeSkin(skin, t).name).join(t("common.listSeparator"))
    : t("common.none");

  return {
    kind: "noticeboard",
    title: t("hub.noticeboard.title"),
    accent: "#96cdff",
    lines: [
      { text: t("hub.noticeboard.highestDepth", { depth: profile?.highestDepth ?? 0 }) },
      { text: t("hub.noticeboard.bosses", { count: profile?.totalBossesDefeated ?? 0 }) },
      { text: t("hub.noticeboard.runs", { count: profile?.completedRuns ?? 0 }) },
      { text: t("hub.noticeboard.skins", { skins }) },
    ],
    actions: [
      { id: "close", label: t("hub.noticeboard.close"), accent: "#96cdff" },
    ],
  };
}

export function ticketCountFromSnapshot(snapshot) {
  return Number.isFinite(snapshot?.profile?.tickets) ? snapshot.profile.tickets : 0;
}

export function ticketSelectionLimit(snapshot) {
  return Math.min(MAX_TICKET_INVESTMENT, Math.max(MIN_TICKET_INVESTMENT, ticketCountFromSnapshot(snapshot)));
}

function dailyClaimState(snapshot, t) {
  const profile = snapshot?.profile ?? {};
  const today = new Date().toISOString().slice(0, 10);

  if (profile.tickets >= MAX_TICKET_HOLDINGS) {
    return { available: false, reason: t("hub.ticket.reachedCap") };
  }

  if (profile.lastDailyTicketClaimDate === today) {
    return { available: false, reason: t("hub.ticket.claimTomorrow") };
  }

  return { available: true, reason: "" };
}

function formatMultiplier(value) {
  return Number(value).toFixed(2);
}

function ticketBuyDisabledReason({ tokens, heldTickets, isPending }, t) {
  if (isPending) {
    return t("common.processing");
  }

  if (heldTickets >= MAX_TICKET_HOLDINGS) {
    return t("hub.ticket.capReached");
  }

  if (Number.isFinite(tokens)) {
    return t("hub.ticket.cost", { cost: EXTRA_TICKET_TOKEN_COST, tokens });
  }

  return t("common.syncing");
}
