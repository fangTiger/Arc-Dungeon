import { createMerchantPanel, createNoticeboardPanel, createTicketPanel, ticketCountFromSnapshot, ticketSelectionLimit } from "./hubEconomyPanels.js";
import { MIN_TICKET_INVESTMENT } from "../../core/economy/tickets.js";
import { refreshEconomySnapshotState } from "../../core/economy/runEconomy.js";
import { translate } from "../../core/i18n/index.js";
import { localizeSkin } from "../../core/economy/skins.js";
import { adjustHubPanelValue, readHubPanelInput, withHubPanelSelection, withInitialHubPanelSelection } from "./hubEconomyPanelInput.js";
export function createHubEconomyFlow({
  enterDungeon,
  getEconomySnapshot,
  exchangeSkinBox,
  openSkinBox,
  claimDailyTickets,
  buyTickets,
  selectedHeroClass,
  selectedHeroIdentity,
  showFeedback,
  t = translate,
}) {
  let economySnapshot = null;
  let activePanel = null;
  let selectedTicketCount = MIN_TICKET_INVESTMENT;
  let selectedActionIndex = 0;
  let pendingAction = null;
  let panelMessage = "";
  let snapshotReadMessage = "";
  let lastMerchantResult = null;
  refreshEconomySnapshot();
  function update(input) {
    if (!activePanel) {
      return false;
    }
    if (input.wasPressed("cancel")) {
      activePanel = null;
      return true;
    }
    const panelInput = readHubPanelInput(input, activePanel, selectedActionIndex);
    selectedActionIndex = panelInput.selectedIndex;
    if (panelInput.type === "move") {
      activePanel = withSelection(activePanel);
      return true;
    }
    if (panelInput.type === "adjust") {
      updateValueRow(panelInput.direction);
      return true;
    }
    if (panelInput.type === "execute") {
      activePanel = withSelection(activePanel);
      executePanelAction(panelInput.action);
      return true;
    }
    return true;
  }
  function openTicketPanel() {
    panelMessage = "";
    lastMerchantResult = null;
    syncSelectedTicketCount();
    refreshEconomySnapshot();
    activePanel = withInitialSelection(buildTicketPanel());
  }
  function openMerchantPanel() {
    panelMessage = "";
    lastMerchantResult = null;
    refreshEconomySnapshot();
    activePanel = withInitialSelection(buildMerchantPanel());
  }
  function startPortalEntry() {
    if (pendingAction || typeof enterDungeon !== "function") {
      return;
    }
    const heldTickets = ticketCountFromSnapshot(economySnapshot);
    if (selectedTicketCount > heldTickets) {
      panelMessage = t("hub.ticket.insufficientEnter");
      activePanel = withSelection(buildTicketPanel());
      showFeedback(t("hub.ticket.insufficient"));
      return;
    }
    pendingAction = "enter";
    activePanel = withSelection(buildTicketPanel());
    showFeedback(t("hub.ticket.enterPending"));
    Promise.resolve(enterDungeon({
      heroClass: selectedHeroClass(),
      heroIdentity: selectedHeroIdentity?.() ?? null,
      ticketCount: selectedTicketCount,
    }))
      .then((result) => {
        pendingAction = null;
        if (!result?.ok) {
          panelMessage = t("hub.ticket.paymentFailed");
          activePanel = withSelection(buildTicketPanel());
          showFeedback(panelMessage);
        } else {
          activePanel = null;
        }
        refreshEconomySnapshot();
      })
      .catch(() => {
        pendingAction = null;
        panelMessage = t("hub.ticket.paymentFailed");
        activePanel = withSelection(buildTicketPanel());
        showFeedback(panelMessage);
        refreshEconomySnapshot();
      });
  }

  function claimDailyTicketAction() {
    runTicketAction("claim", claimDailyTickets, t("hub.ticket.claimPending"), (result) => (
      result?.ok && result.claimed
        ? t("hub.ticket.claimSuccess", { count: result.granted ?? 0 })
        : result?.ok ? t("hub.ticket.claimTomorrow") : t("hub.ticket.claimFailed")
    ), t("hub.ticket.claimFailed"));
  }

  function buyTicketAction() {
    runTicketAction("buy-ticket", () => buyTickets(1), t("hub.ticket.buyPending"), (result) => (
      result?.ok
        ? t("hub.ticket.buySuccess", { count: result.purchased ?? 1 })
        : t("hub.ticket.buyFailed")
    ), t("hub.ticket.buyFailed"));
  }

  function runTicketAction(action, operation, pendingMessage, messageForResult, errorMessage) {
    if (pendingAction || typeof operation !== "function") {
      return;
    }
    pendingAction = action;
    panelMessage = pendingMessage;
    activePanel = withSelection(buildTicketPanel());
    Promise.resolve(operation())
      .then((result) => {
        pendingAction = null;
        panelMessage = messageForResult(result);
        showFeedback(panelMessage);
        refreshEconomySnapshot();
      })
      .catch(() => {
        pendingAction = null;
        panelMessage = errorMessage;
        showFeedback(panelMessage);
        refreshEconomySnapshot();
      });
  }

  function runMerchantAction(action, operation, messageForResult) {
    if (pendingAction || typeof operation !== "function") {
      return;
    }
    pendingAction = action;
    panelMessage = t("hub.merchant.exchangePending");
    activePanel = withSelection(buildMerchantPanel());
    Promise.resolve(operation())
      .then((result) => {
        pendingAction = null;
        lastMerchantResult = result;
        panelMessage = messageForResult(result);
        showFeedback(panelMessage);
        refreshEconomySnapshot();
      })
      .catch(() => {
        pendingAction = null;
        panelMessage = messageForResult(null);
        showFeedback(panelMessage);
        refreshEconomySnapshot();
      });
  }

  function openNoticeboardPanel() {
    panelMessage = "";
    lastMerchantResult = null;
    refreshEconomySnapshot();
    activePanel = withInitialSelection(createNoticeboardPanel(economySnapshot?.profile, t));
  }

  function refreshEconomySnapshot() {
    if (typeof getEconomySnapshot !== "function") {
      return;
    }
    refreshEconomySnapshotState({
      previousSnapshot: economySnapshot,
      readSnapshot: getEconomySnapshot,
    })
      .then((state) => {
        economySnapshot = state.snapshot;
        snapshotReadMessage = state.readFailed ? t("hub.snapshot.readFailed") : "";
        syncSelectedTicketCount();
        rebuildActivePanel();
      });
  }

  return {
    update,
    getSnapshot: () => economySnapshot,
    getPanel: () => activePanel,
    closePanel: () => { activePanel = null; },
    openTicketPanel,
    openMerchantPanel,
    openCraftPanel: openMerchantPanel,
    openNoticeboardPanel,
    refreshEconomySnapshot,
  };

  function showDisabledAction(message) {
    panelMessage = message;
    showFeedback(message);
    rebuildActivePanel();
  }

  function updateValueRow(direction) {
    const action = activePanel.actions[selectedActionIndex];
    const adjusted = adjustHubPanelValue(activePanel, selectedActionIndex, direction);
    if (!adjusted.changed) {
      return;
    }
    if (activePanel.kind === "tickets" && action?.id === "ticket-count") {
      selectedTicketCount = adjusted.value;
      panelMessage = "";
      activePanel = withSelection(buildTicketPanel());
    }
  }

  function executePanelAction(action) {
    if (!action) {
      return;
    }
    if (action.disabled) {
      showDisabledAction(action.disabledReason ?? t("hub.action.unavailable"));
      return;
    }
    if (action.kind === "value") {
      return;
    }
    if (action.id === "claim-daily") {
      claimDailyTicketAction();
    } else if (action.id === "buy-ticket") {
      buyTicketAction();
    } else if (action.id === "enter-dungeon") {
      startPortalEntry();
    } else if (action.id === "exchange-box") {
      runMerchantAction("exchange-box", exchangeSkinBox, (result) => (
        result?.ok ? t("hub.merchant.exchangeSuccess") : t("hub.merchant.exchangeFailed")
      ));
    } else if (action.id === "open-box") {
      runMerchantAction("open-box", openSkinBox, (result) => (
        result?.ok
          ? localizedOpenMessage(result.skin, t)
          : t("hub.merchant.noBox")
      ));
    } else if (action.id === "close") {
      activePanel = null;
    }
  }

  function rebuildActivePanel() {
    if (activePanel?.kind === "tickets") {
      activePanel = withSelection(buildTicketPanel());
    } else if (activePanel?.kind === "merchant") {
      activePanel = withSelection(buildMerchantPanel());
    } else if (activePanel?.kind === "noticeboard") {
      activePanel = withSelection(createNoticeboardPanel(economySnapshot?.profile, t));
    }
  }

  function syncSelectedTicketCount() {
    const max = ticketSelectionLimit(economySnapshot);
    selectedTicketCount = Math.max(MIN_TICKET_INVESTMENT, Math.min(max, selectedTicketCount));
  }

  function buildTicketPanel() {
    return createTicketPanel({
      snapshot: economySnapshot,
      selectedTicketCount,
      pendingAction,
      message: panelMessage || snapshotReadMessage,
      t,
    });
  }

  function buildMerchantPanel() {
    return createMerchantPanel({ snapshot: economySnapshot, pendingAction, message: panelMessage || snapshotReadMessage, lastResult: lastMerchantResult, t });
  }

  function withInitialSelection(panel) {
    const selected = withInitialHubPanelSelection(panel);
    selectedActionIndex = selected.selectedIndex;
    return selected.panel;
  }

  function withSelection(panel) {
    const selected = withHubPanelSelection(panel, selectedActionIndex);
    selectedActionIndex = selected.selectedIndex;
    return selected.panel;
  }
}

function localizedOpenMessage(skin, t) {
  const localizedSkin = localizeSkin(skin, t);
  return t("hub.merchant.openSuccess", {
    name: localizedSkin?.name ?? "-",
    rarity: localizedSkin?.rarityLabel ?? "-",
  });
}
