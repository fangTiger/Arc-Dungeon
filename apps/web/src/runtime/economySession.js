import {
  LOCAL_ACCOUNT_ID,
  NEW_ACCOUNT_INITIAL_BALANCE,
} from "../core/economy/constants.js";
import { createMockLedger } from "../core/economy/mockLedger.js";
import { createPlayerSaveClient } from "../core/economy/playerSaveClient.js";
import { notifyRunSettled } from "../arc/settlement.js";
import {
  buyTicketsForAccount,
  claimDailyTicketsForAccount,
  craftSkinForAccount,
  exchangeSkinBoxForAccount,
  getEconomySnapshot,
  openSkinBoxForAccount,
  requestRunStart,
  settleRunEconomy,
} from "../core/economy/runEconomy.js";

export function createEconomySession({
  accountId = LOCAL_ACCOUNT_ID,
  ledger = createMockLedger({ defaultBalance: NEW_ACCOUNT_INITIAL_BALANCE }),
  saveClient = createPlayerSaveClient(),
  onRunSettled = notifyRunSettled,
} = {}) {
  let snapshot = null;
  let activeDiscordId = null;
  let remoteWriteAllowed = false;
  let serverSaveAvailable = false;

  async function readSnapshot() {
    snapshot = withSaveStatus(await getEconomySnapshot({ ledger, accountId }));
    return snapshot;
  }

  async function connectPlayerSave(discordId) {
    const normalizedDiscordId = normalizeDiscordId(discordId);
    if (!normalizedDiscordId) {
      activeDiscordId = null;
      remoteWriteAllowed = false;
      setServerSaveAvailable(false);
      return { ok: true, source: "local-guest" };
    }

    activeDiscordId = normalizedDiscordId;
    remoteWriteAllowed = false;
    setServerSaveAvailable(false);
    await ensureSnapshot();
    const remote = await runSaveRequest(() => saveClient.read(normalizedDiscordId));
    if (!remote.ok) {
      return degraded(remote.reason);
    }

    remoteWriteAllowed = true;
    if (remote.found) {
      const replaced = await ledger.replaceAccountSave({
        accountId,
        save: remote.save?.profile,
      });
      if (!replaced.ok) {
        remoteWriteAllowed = false;
        return degraded(replaced.reason);
      }
      setServerSaveAvailable(true);
      await readSnapshot();
      return { ok: true, source: "server" };
    }

    const migrated = await persistSnapshot();
    return migrated.ok
      ? { ok: true, source: "local-migration" }
      : degraded(migrated.reason);
  }

  async function startRun({ runId, createRun, ticketCount }) {
    const result = await requestRunStart({ ledger, accountId, runId, createRun, ticketCount });
    await refreshAndPersist();
    return result;
  }

  async function settleRun(run) {
    const result = await settleRunEconomy({ ledger, accountId, run });
    await refreshAndPersist();
    if (result.ok) {
      try { onRunSettled(run, result); }
      catch { /* 战绩面板不可用时，本地游戏仍正常结算。 */ }
    }
    return result;
  }

  async function craftSkin() {
    const result = await craftSkinForAccount({ ledger, accountId });
    await refreshAndPersist();
    return result;
  }

  async function exchangeSkinBox() {
    const result = await exchangeSkinBoxForAccount({ ledger, accountId });
    await refreshAndPersist();
    return result;
  }

  async function openSkinBox() {
    const result = await openSkinBoxForAccount({ ledger, accountId });
    await refreshAndPersist();
    return result;
  }

  async function claimDailyTickets(now = new Date()) {
    const result = await claimDailyTicketsForAccount({ ledger, accountId, now });
    await refreshAndPersist();
    return result;
  }

  async function buyTickets(count = 1) {
    const result = await buyTicketsForAccount({ ledger, accountId, count });
    await refreshAndPersist();
    return result;
  }

  async function saveProfileIdentity(identity) {
    const result = await ledger.setProfileIdentity({ accountId, identity });
    await refreshAndPersist();
    return result;
  }

  async function setEquippedSkin(skinId) {
    const result = await ledger.setEquippedSkin({ accountId, skinId });
    await refreshAndPersist();
    return result;
  }

  async function markHudHintSeen() {
    const result = await ledger.markHudHintSeen({ accountId });
    await refreshAndPersist();
    return result;
  }

  async function refreshAndPersist() {
    await readSnapshot();
    await persistSnapshot();
  }

  async function persistSnapshot() {
    if (!activeDiscordId || !remoteWriteAllowed) {
      return { ok: false, reason: "local-only" };
    }

    await ensureSnapshot();
    const result = await runSaveRequest(() => saveClient.write(activeDiscordId, {
      balance: snapshot.balance,
      profile: snapshot.profile,
    }));
    setServerSaveAvailable(result.ok);
    return result;
  }

  async function ensureSnapshot() {
    if (!snapshot) {
      await readSnapshot();
    }
  }

  function setServerSaveAvailable(value) {
    serverSaveAvailable = value === true;
    if (snapshot) {
      snapshot = withSaveStatus(snapshot);
    }
  }

  function withSaveStatus(value) {
    return {
      ...value,
      serverSaveAvailable,
    };
  }

  return {
    accountId,
    ledger,
    readSnapshot,
    connectPlayerSave,
    startRun,
    settleRun,
    craftSkin,
    exchangeSkinBox,
    openSkinBox,
    claimDailyTickets,
    buyTickets,
    saveProfileIdentity,
    setEquippedSkin,
    markHudHintSeen,
    getSnapshot: () => snapshot,
  };
}

async function runSaveRequest(request) {
  try {
    const result = await request();
    return result?.ok === true || (result?.ok === false && typeof result.reason === "string")
      ? result
      : { ok: false, reason: "invalid-response" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

function normalizeDiscordId(discordId) {
  const normalized = String(discordId ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function degraded(reason) {
  return {
    ok: false,
    degraded: true,
    reason,
  };
}
