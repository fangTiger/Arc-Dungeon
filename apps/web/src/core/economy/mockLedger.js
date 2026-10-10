import {
  ZERO_BALANCE,
  createLedgerInterface,
  ledgerSuccess,
  normalizeAccountId,
  normalizeBalance,
  normalizePositiveInteger,
  normalizeRunId,
} from "./ledger.js";
import {
  MOCK_LEDGER_STORAGE_KEY,
  createLedgerStateController,
  readGlobalLocalStorage,
} from "./mockLedgerStorage.js";
import { createMockLedgerAccountSaveMethods } from "./mockLedgerAccountSave.js";
import {
  invalidInput,
  readAccountBalance,
  readAccountProfile,
} from "./mockLedgerHelpers.js";
import {
  craftSkinInLedgerState,
  exchangeSkinBoxInLedgerState,
  markHudHintSeenInLedgerState,
  openSkinBoxInLedgerState,
  runSkinAssetOperation,
  setEquippedSkinInLedgerState,
} from "./mockLedgerSkin.js";
import {
  buyTicketsInLedgerState,
  claimDailyTicketsInLedgerState,
  consumeRunTicketsInLedgerState,
} from "./mockLedgerTickets.js";
import {
  payTicketInLedgerState,
  recordRunProfileInLedgerState,
  recordRunProofInLedgerState,
  setProfileIdentityInLedgerState,
  settleRunInLedgerState,
} from "./mockLedgerRuns.js";

export { MOCK_LEDGER_STORAGE_KEY };

export function createMockLedger(options = {}) {
  const defaultBalance = normalizeBalance(options.defaultBalance ?? ZERO_BALANCE);
  const controller = createLedgerStateController({
    storage: options.storage ?? readGlobalLocalStorage(),
    initialBalances: options.initialBalances,
    defaultBalance,
    storageKind: options.storage ? "custom" : "localStorage",
  });

  const implementation = {
    ...createMockLedgerAccountSaveMethods({ controller }),
    async getBalance(accountId) {
      const normalizedAccountId = normalizeAccountId(accountId);

      if (!normalizedAccountId) {
        return invalidInput("accountId 必须是非空字符串");
      }

      const state = controller.readState();

      return ledgerSuccess({
        balance: readAccountBalance(state, normalizedAccountId, defaultBalance),
      });
    },

    async payTicket({ accountId, amount, runId } = {}) {
      const normalizedAccountId = normalizeAccountId(accountId);
      const normalizedRunId = normalizeRunId(runId);
      const normalizedAmount = normalizePositiveInteger(amount);

      if (!normalizedAccountId || !normalizedRunId || normalizedAmount === null) {
        return invalidInput("payTicket 需要 accountId、正整数 amount 和 runId");
      }

      const state = controller.readState();
      const result = payTicketInLedgerState({
        state,
        accountId: normalizedAccountId,
        amount: normalizedAmount,
        runId: normalizedRunId,
        defaultBalance,
      });
      if (result.ok && result.applied !== false) {
        controller.writeState(state);
      }
      return result;
    },

    async settleRun({ accountId, runId, rewards } = {}) {
      const normalizedAccountId = normalizeAccountId(accountId);
      const normalizedRunId = normalizeRunId(runId);

      if (!normalizedAccountId || !normalizedRunId) {
        return invalidInput("settleRun 需要 accountId、runId 和合法 rewards");
      }

      const state = controller.readState();
      const result = settleRunInLedgerState({
        state,
        accountId: normalizedAccountId,
        runId: normalizedRunId,
        rewards,
        defaultBalance,
      });
      if (result === null) {
        return invalidInput("settleRun 需要 accountId、runId 和合法 rewards");
      }
      if (result.ok && result.applied !== false) {
        controller.writeState(state);
      }
      return result;
    },

    async recordRunProof({ accountId, runId, proof } = {}) {
      const normalizedAccountId = normalizeAccountId(accountId);
      const normalizedRunId = normalizeRunId(runId);

      if (!normalizedAccountId || !normalizedRunId) {
        return invalidInput("recordRunProof 需要 accountId、runId 和可序列化 proof");
      }

      const state = controller.readState();
      const result = recordRunProofInLedgerState({
        state,
        accountId: normalizedAccountId,
        runId: normalizedRunId,
        proof,
      });
      if (result === null) {
        return invalidInput("recordRunProof 需要 accountId、runId 和可序列化 proof");
      }
      if (result.ok && result.applied !== false) {
        controller.writeState(state);
      }
      return result;
    },

    async getProfile(accountId) {
      const normalizedAccountId = normalizeAccountId(accountId);

      if (!normalizedAccountId) {
        return invalidInput("accountId 必须是非空字符串");
      }

      const state = controller.readState();

      return ledgerSuccess({
        profile: readAccountProfile(state, normalizedAccountId),
      });
    },

    async recordRunProfile({ accountId, runId, summary } = {}) {
      const normalizedAccountId = normalizeAccountId(accountId);
      const normalizedRunId = normalizeRunId(runId);

      if (!normalizedAccountId || !normalizedRunId) {
        return invalidInput("recordRunProfile 需要 accountId、runId 和合法 summary");
      }

      const state = controller.readState();
      const result = recordRunProfileInLedgerState({
        state,
        accountId: normalizedAccountId,
        runId: normalizedRunId,
        summary,
      });
      if (result === null) {
        return invalidInput("recordRunProfile 需要 accountId、runId 和合法 summary");
      }
      if (result.ok && result.applied !== false) {
        controller.writeState(state);
      }
      return result;
    },

    async setProfileIdentity({ accountId, identity } = {}) {
      const normalizedAccountId = normalizeAccountId(accountId);
      if (!normalizedAccountId) {
        return invalidInput("setProfileIdentity 需要 accountId");
      }

      const state = controller.readState();
      const result = setProfileIdentityInLedgerState({
        state,
        accountId: normalizedAccountId,
        identity,
      });
      if (result === null) {
        return invalidInput("setProfileIdentity 需要合法身份");
      }
      controller.writeState(state);

      return result;
    },

    async claimDailyTickets({ accountId, now } = {}) {
      const normalizedAccountId = normalizeAccountId(accountId);
      if (!normalizedAccountId) {
        return invalidInput("claimDailyTickets 需要 accountId");
      }

      const state = controller.readState();
      const result = claimDailyTicketsInLedgerState({
        state,
        accountId: normalizedAccountId,
        now,
      });
      if (result.ok && result.applied) {
        controller.writeState(state);
      }
      return result;
    },

    async buyTickets({ accountId, count = 1 } = {}) {
      const normalizedAccountId = normalizeAccountId(accountId);
      if (!normalizedAccountId) {
        return invalidInput("buyTickets 需要 accountId");
      }

      const state = controller.readState();
      const result = buyTicketsInLedgerState({
        state,
        accountId: normalizedAccountId,
        defaultBalance,
        count,
      });
      if (result.ok) {
        controller.writeState(state);
      }
      return result;
    },

    async consumeRunTickets({ accountId, runId, count = 1 } = {}) {
      const normalizedAccountId = normalizeAccountId(accountId);
      const normalizedRunId = normalizeRunId(runId);

      if (!normalizedAccountId || !normalizedRunId) {
        return invalidInput("consumeRunTickets 需要 accountId 和 runId");
      }

      const state = controller.readState();
      const result = consumeRunTicketsInLedgerState({
        state,
        accountId: normalizedAccountId,
        runId: normalizedRunId,
        count,
      });
      if (result.ok && result.applied !== false) {
        controller.writeState(state);
      }
      return result;
    },

    async exchangeSkinBox(accountIdOrOptions = {}) {
      return runSkinAssetOperation({ accountIdOrOptions, controller, defaultBalance, operationName: "exchangeSkinBox", operation: exchangeSkinBoxInLedgerState });
    },

    async openSkinBox(accountIdOrOptions = {}) {
      return runSkinAssetOperation({ accountIdOrOptions, controller, defaultBalance, operationName: "openSkinBox", operation: openSkinBoxInLedgerState });
    },

    async craftSkin(accountIdOrOptions = {}) {
      return runSkinAssetOperation({ accountIdOrOptions, controller, defaultBalance, operationName: "craftSkin", operation: craftSkinInLedgerState });
    },

    async setEquippedSkin({ accountId, skinId } = {}) {
      return runSkinAssetOperation({
        accountIdOrOptions: { accountId },
        controller,
        defaultBalance,
        operationName: "setEquippedSkin",
        operation: (fields) => setEquippedSkinInLedgerState({ ...fields, skinId }),
      });
    },

    async markHudHintSeen({ accountId } = {}) { return runSkinAssetOperation({ accountIdOrOptions: { accountId }, controller, defaultBalance, operationName: "markHudHintSeen", operation: markHudHintSeenInLedgerState }); },
  };

  return createLedgerInterface(implementation, {
    isPersistent: {
      enumerable: true,
      get: () => controller.isPersistent(),
    },
    persistenceUnavailable: {
      enumerable: true,
      get: () => !controller.isPersistent(),
    },
    storageKind: {
      enumerable: true,
      get: () => controller.storageKind(),
    },
    storageKey: {
      enumerable: true,
      value: MOCK_LEDGER_STORAGE_KEY,
    },
  });
}
