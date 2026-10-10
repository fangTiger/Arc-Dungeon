/*
 * Rialo 账本接口按真实链上语义预留，而不是按本地函数语义设计：
 * 1. 所有方法都返回 Promise，调用方必须把它当作等待链上确认的异步操作。
 * 2. 所有方法都返回 `{ ok: true, ... }` 或 `{ ok: false, reason, ... }`，
 *    链上交易被拒、余额不足、重复提交冲突都不会通过异常传给游戏流程。
 * 3. 所有写入方法都以 `runId` 作为幂等操作 id，便于未来交易重试、RPC 重放、
 *    Reactive Transaction 自动发奖时只结算一次。
 * 4. `recordRunProof` 是文档第九章「链上证明」的挂载点；本地实现只保存 JSON，
 *    真链接入时应替换为证明提交交易或证明索引服务调用。
 * 5. profile 与盲盒方法是本地经济闭环的持久化入口，真链接入时可映射为
 *    链上资产索引或玩家档案索引服务。
 * 6. 门票方法把每日领取、额外购买和 run 投入视为可替换的资产交易入口。
 *
 * 真链接入时需要替换的只有 ledger 实现层：
 * - `getBalance` 改为读链上 Token 余额。
 * - `payTicket` 是旧 Token 门票费兼容入口，v2 默认不再使用。
 * - `claimDailyTickets`、`buyTickets` 与 `consumeRunTickets` 改为提交门票资产交易。
 * - `settleRun` 改为提交或等待自动发奖交易，同一 `runId` 只生效一次。
 * - `recordRunProof` 改为写入链上证明或证明可验证索引。
 * - `exchangeSkinBox` 与 `openSkinBox` 改为提交链上盲盒资产交易。
 * - `craftSkin` 是旧 runtime 兼容入口，真链接入后应由盲盒接口替代。
 * 调用方不应依赖 localStorage、同步返回值或本地状态结构。
 */

export const RIALO_STORAGE_PREFIX = "arc:";

export const LEDGER_METHOD_NAMES = Object.freeze([
  "getBalance",
  "payTicket",
  "settleRun",
  "recordRunProof",
  "replaceAccountSave",
  "getProfile",
  "recordRunProfile",
  "setProfileIdentity",
  "setEquippedSkin",
  "markHudHintSeen",
  "claimDailyTickets",
  "buyTickets",
  "consumeRunTickets",
  "exchangeSkinBox",
  "openSkinBox",
  "craftSkin",
]);

export const LEDGER_FAILURE_REASONS = Object.freeze({
  INSUFFICIENT_BALANCE: "insufficient-balance",
  INVALID_INPUT: "invalid-input",
  OPERATION_CONFLICT: "operation-conflict",
  STORAGE_UNAVAILABLE: "storage-unavailable",
  LEDGER_ERROR: "ledger-error",
  INVALID_LEDGER_RESULT: "invalid-ledger-result",
});

export const ZERO_BALANCE = Object.freeze({
  tokens: 0,
});

/**
 * @typedef {object} LedgerBalance
 * @property {number} tokens Token 余额。
 *
 * @typedef {object} LedgerSuccess
 * @property {true} ok 操作成功。写入操作可通过 `applied` 表达是否首次生效。
 *
 * @typedef {object} LedgerFailure
 * @property {false} ok 操作失败。
 * @property {string} reason 结构化失败原因，调用方按原因分支处理。
 *
 * @typedef {LedgerSuccess | LedgerFailure} LedgerResult
 */

export function createLedgerInterface(implementation, metadataDescriptors = {}) {
  const missing = LEDGER_METHOD_NAMES.filter((methodName) => {
    return typeof implementation?.[methodName] !== "function";
  });

  if (missing.length > 0) {
    throw new TypeError(`账本实现缺少方法: ${missing.join(", ")}`);
  }

  const ledger = {};

  for (const methodName of LEDGER_METHOD_NAMES) {
    ledger[methodName] = async (...args) => {
      try {
        const result = await implementation[methodName](...args);
        return normalizeLedgerResult(result);
      } catch (error) {
        return ledgerFailure(LEDGER_FAILURE_REASONS.LEDGER_ERROR, {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    };
  }

  for (const [name, descriptor] of Object.entries(metadataDescriptors)) {
    Object.defineProperty(ledger, name, descriptor);
  }

  return Object.freeze(ledger);
}

export function ledgerSuccess(fields = {}) {
  const { ok: _ok, reason: _reason, ...rest } = fields;

  return {
    ok: true,
    ...rest,
  };
}

export function ledgerFailure(reason, fields = {}) {
  const { ok: _ok, reason: _reason, ...rest } = fields;

  return {
    ok: false,
    reason,
    ...rest,
  };
}

export function normalizeBalance(balance) {
  const source = isRecord(balance) ? balance : {};

  return {
    tokens: normalizeNonNegativeInteger(source.tokens) + normalizeLegacyTokenField(source),
  };
}

export function normalizeRewards(rewards) {
  return normalizeBalance(rewards);
}

export function normalizeAccountId(accountId) {
  if (typeof accountId !== "string") {
    return null;
  }

  const normalized = accountId.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeRunId(runId) {
  if (typeof runId !== "string") {
    return null;
  }

  const normalized = runId.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizePositiveInteger(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : null;
}

export function sameBalance(left, right) {
  const normalizedLeft = normalizeBalance(left);
  const normalizedRight = normalizeBalance(right);

  return (
    normalizedLeft.tokens === normalizedRight.tokens
  );
}

export function sameRewards(left, right) {
  return sameBalance(normalizeRewards(left), normalizeRewards(right));
}

function normalizeNonNegativeInteger(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function normalizeLegacyTokenField(source) {
  /*
   * 旧存档曾包含 shards 字段。读取时按 1:1 并入 Token，
   * 返回结构不再包含旧字段，避免老玩家资产丢失。
   */
  return normalizeNonNegativeInteger(source.shards);
}

function normalizeLedgerResult(result) {
  if (!isRecord(result) || typeof result.ok !== "boolean") {
    return ledgerFailure(LEDGER_FAILURE_REASONS.INVALID_LEDGER_RESULT);
  }

  if (result.ok) {
    const { ok: _ok, reason: _reason, ...rest } = result;
    return ledgerSuccess(rest);
  }

  const reason =
    typeof result.reason === "string" && result.reason.length > 0
      ? result.reason
      : LEDGER_FAILURE_REASONS.LEDGER_ERROR;
  const { ok: _ok, reason: _reason, ...rest } = result;

  return ledgerFailure(reason, rest);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
