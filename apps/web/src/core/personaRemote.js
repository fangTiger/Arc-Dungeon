const DEFAULT_TIMEOUT_MS = 5000;
const BLOCKED_FIELDS = Object.freeze(new Set([
  "xp",
  "experience",
  "experiencePoints",
  "xpMultiplier",
  "drop",
  "drops",
  "lootMultiplier",
  "damageModifier",
  "rewardEligibility",
  "priceModifier",
  "punishment",
  "reward",
  "loot",
  "damage",
  "price",
  "rewardQualification",
  "penalty",
  "经验",
  "掉落",
  "伤害",
  "价格",
  "奖励资格",
  "惩罚",
]));

export async function requestPersonaEnhancement(preview, context = {}) {
  const localCard = preview?.card;
  const discordId = readString(preview?.discordId ?? localCard?.userId);

  if (!discordId || !isRecord(localCard)) {
    return preview;
  }

  const fetchImpl = context.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return createFallbackPreview(preview, "missing-fetch");
  }

  try {
    const payload = await fetchPersona({
      discordId,
      features: preview.features,
      language: preview.language,
      fetchImpl,
      timeoutMs: normalizeTimeout(context.timeoutMs),
    });
    const remoteCard = sanitizePersonaCard(payload?.card);

    if (!isRecord(remoteCard)) {
      return createFallbackPreview(preview, "invalid-response");
    }

    if (remoteCard.llmMode !== "enhanced") {
      return createFallbackPreview(
        preview,
        readString(remoteCard.llmReason) ?? "service-fallback",
      );
    }

    if (!readString(remoteCard.narrativeSummary)
      || !readString(remoteCard.npcFirstImpression)) {
      return createFallbackPreview(preview, "incomplete-enhancement");
    }

    return {
      ...preview,
      status: {
        kind: "ready",
        text: "LLM ARC 档案已生成。",
      },
      card: remoteCard,
      source: "llm",
      fallbackReason: null,
      usesRemoteApi: true,
      usesLlm: true,
    };
  } catch (error) {
    return createFallbackPreview(preview, fallbackReasonFor(error));
  }
}

async function fetchPersona({ discordId, features, language, fetchImpl, timeoutMs }) {
  const controller = typeof AbortController === "function"
    ? new AbortController()
    : null;
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller?.abort();
      reject(new PersonaRequestError("timeout"));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      fetchImpl("/api/persona", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ discordId, features, language }),
        signal: controller?.signal,
      }),
      timeout,
    ]);

    if (!response?.ok) {
      throw new PersonaRequestError(`http-${response?.status ?? "error"}`);
    }

    try {
      return await response.json();
    } catch {
      throw new PersonaRequestError("invalid-json");
    }
  } finally {
    clearTimeout(timer);
  }
}

function createFallbackPreview(preview, reason) {
  return {
    ...preview,
    status: {
      kind: "fallback",
      text: "画像服务不可用，已使用本地规则画像。",
    },
    card: sanitizePersonaCard(preview.card),
    source: "fallback",
    fallbackReason: reason,
    usesRemoteApi: true,
    usesLlm: false,
  };
}

function sanitizePersonaCard(card) {
  if (!isRecord(card)) {
    return null;
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(card)) {
    if (!BLOCKED_FIELDS.has(key)) {
      sanitized[key] = sanitizeValue(value);
    }
  }
  return sanitized;
}

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (!isRecord(value)) {
    return value;
  }

  const sanitized = {};
  for (const [key, child] of Object.entries(value)) {
    if (!BLOCKED_FIELDS.has(key)) {
      sanitized[key] = sanitizeValue(child);
    }
  }
  return sanitized;
}

function fallbackReasonFor(error) {
  return error instanceof PersonaRequestError
    ? error.reason
    : "request-failed";
}

function normalizeTimeout(value) {
  return Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : DEFAULT_TIMEOUT_MS;
}

function readString(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

class PersonaRequestError extends Error {
  constructor(reason) {
    super(reason);
    this.name = "PersonaRequestError";
    this.reason = reason;
  }
}
