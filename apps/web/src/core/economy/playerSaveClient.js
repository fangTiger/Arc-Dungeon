const READ_PATH = "/api/player-save/read";
const WRITE_PATH = "/api/player-save/write";
const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;

export function createPlayerSaveClient({
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
} = {}) {
  const requestTimeoutMs = normalizeTimeout(timeoutMs);

  return Object.freeze({
    async read(discordId) {
      const normalizedDiscordId = readString(discordId);
      if (!normalizedDiscordId) {
        return failure("invalid-input");
      }

      const response = await requestJson(READ_PATH, {
        discordId: normalizedDiscordId,
      }, fetchImpl, requestTimeoutMs);
      if (!response.ok) {
        return response;
      }
      if (response.payload.save === null) {
        return { ok: true, found: false, save: null };
      }

      const save = normalizeSave(response.payload.save);
      return save
        ? { ok: true, found: true, save }
        : failure("invalid-response");
    },

    async write(discordId, profile) {
      const normalizedDiscordId = readString(discordId);
      if (!normalizedDiscordId || !isRecord(profile)) {
        return failure("invalid-input");
      }

      const response = await requestJson(WRITE_PATH, {
        discordId: normalizedDiscordId,
        profile,
      }, fetchImpl, requestTimeoutMs);
      if (!response.ok) {
        return response;
      }

      const save = normalizeSave(response.payload.save);
      return save
        ? { ok: true, save }
        : failure("invalid-response");
    },
  });
}

async function requestJson(path, body, fetchImpl, timeoutMs) {
  if (typeof fetchImpl !== "function") {
    return failure("unavailable");
  }

  const controller = typeof AbortController === "function"
    ? new AbortController()
    : null;
  let timeoutId = null;
  const timeoutResult = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      controller?.abort();
      resolve(failure("unavailable"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetchAndParse(path, body, fetchImpl, controller?.signal),
      timeoutResult,
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchAndParse(path, body, fetchImpl, signal) {
  let response;
  try {
    response = await fetchImpl(path, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });
  } catch {
    return failure("unavailable");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    return failure("invalid-response");
  }
  if (!response.ok) {
    return failure(payload?.error?.code === "player_save_not_configured"
      ? "not-configured"
      : "unavailable");
  }
  return isRecord(payload)
    ? { ok: true, payload }
    : failure("invalid-response");
}

function normalizeTimeout(value) {
  const timeoutMs = Number(value);
  return Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_REQUEST_TIMEOUT_MS;
}

function normalizeSave(save) {
  if (!isRecord(save) || !isRecord(save.profile)) {
    return null;
  }
  return {
    profile: save.profile,
    updatedAt: readString(save.updatedAt),
  };
}

function readString(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function failure(reason) {
  return { ok: false, reason };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
