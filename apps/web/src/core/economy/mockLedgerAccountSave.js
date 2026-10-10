import {
  ledgerSuccess,
  normalizeAccountId,
  normalizeBalance,
} from "./ledger.js";
import { normalizeEconomyProfile } from "./profile.js";

export function createMockLedgerAccountSaveMethods({ controller }) {
  return {
    async replaceAccountSave({ accountId, save } = {}) {
      const normalizedAccountId = normalizeAccountId(accountId);
      if (!normalizedAccountId || !isRecord(save)) {
        return invalidInput();
      }

      const state = controller.readState();
      const balance = normalizeBalance(save.balance);
      const profile = normalizeEconomyProfile(save.profile);
      state.accounts[normalizedAccountId] = balance;
      state.profiles[normalizedAccountId] = profile;
      controller.writeState(state);

      return ledgerSuccess({
        applied: true,
        balance,
        profile,
      });
    },
  };
}

function invalidInput() {
  return {
    ok: false,
    reason: "invalid-input",
    message: "replaceAccountSave 需要 accountId 与合法账户档案",
  };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
