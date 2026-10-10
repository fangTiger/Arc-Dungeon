import { DiscordSDK } from "../../../vendor/discord-embedded-app-sdk/index.mjs";

const DEFAULT_TIMEOUT_MS = 5000;
const ACTIVITY_QUERY_KEYS = Object.freeze(["frame_id", "instance_id", "platform"]);

export async function initializeDiscordActivity(options = {}) {
  const location = options.location ?? globalThis.location;

  if (!isDiscordActivityEnvironment(location)) {
    return createGuestIdentity("non-activity");
  }

  const clientId = readDiscordClientId(options);
  if (!clientId) {
    return createGuestIdentity("missing-client-id");
  }

  const timeoutMs = normalizeTimeout(options.timeoutMs);
  const controller = typeof AbortController === "function"
    ? new AbortController()
    : null;

  try {
    return await withTimeout(
      () => authorizeDiscordIdentity({
        ...options,
        clientId,
        signal: controller?.signal,
      }),
      timeoutMs,
      () => controller?.abort(),
    );
  } catch (error) {
    return createGuestIdentity(error instanceof ActivityTimeoutError
      ? "timeout"
      : "authorization-failed");
  }
}

export function isDiscordActivityEnvironment(location = globalThis.location) {
  const search = typeof location?.search === "string" ? location.search : "";
  const params = new URLSearchParams(search);
  const platform = params.get("platform");

  return ACTIVITY_QUERY_KEYS.every((key) => Boolean(params.get(key)))
    && (platform === "desktop" || platform === "mobile");
}

export function createGuestIdentity(reason = "non-activity") {
  return {
    kind: "guest",
    isActivity: false,
    authenticated: false,
    discordId: null,
    displayName: "访客",
    avatarUrl: null,
    reason,
    statusText: guestStatusText(reason),
  };
}

async function authorizeDiscordIdentity({
  clientId,
  sdkFactory = (publicClientId) => new DiscordSDK(publicClientId),
  fetchImpl = globalThis.fetch,
  signal,
} = {}) {
  if (typeof sdkFactory !== "function" || typeof fetchImpl !== "function") {
    throw new Error("Activity 授权依赖不可用");
  }

  const sdk = sdkFactory(clientId);
  await sdk.ready();
  throwIfAborted(signal);

  const authorization = await sdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    prompt: "none",
    scope: ["identify"],
  });
  throwIfAborted(signal);
  const code = readString(authorization?.code);

  if (!code) {
    throw new Error("Discord 未返回授权 code");
  }

  const tokenResponse = await fetchImpl("/api/discord/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ code }),
    signal,
  });
  throwIfAborted(signal);

  if (!tokenResponse?.ok) {
    throw new Error("Discord token 交换失败");
  }

  const tokenPayload = await tokenResponse.json();
  throwIfAborted(signal);
  const accessToken = readString(tokenPayload?.access_token);

  if (!accessToken) {
    throw new Error("Discord token 响应无效");
  }

  const authentication = await sdk.commands.authenticate({
    access_token: accessToken,
  });
  throwIfAborted(signal);
  const user = authentication?.user;
  const discordId = readString(user?.id);
  const username = readString(user?.username);
  const displayName = readString(user?.global_name) ?? username;

  if (!discordId || !displayName) {
    throw new Error("Discord 用户资料无效");
  }

  return {
    kind: "discord",
    isActivity: true,
    authenticated: true,
    discordId,
    displayName,
    avatarUrl: createDiscordAvatarUrl(discordId, user?.avatar),
    reason: null,
    statusText: "已连接 Discord 身份。",
  };
}

export function readDiscordClientId(options = {}) {
  const explicit = readString(options.clientId);
  if (explicit) {
    return explicit;
  }

  const location = options.location ?? globalThis.location;
  const params = new URLSearchParams(typeof location?.search === "string" ? location.search : "");
  for (const key of ["discordClientId", "client_id", "application_id"]) {
    const queryValue = readString(params.get(key));
    if (queryValue) {
      return queryValue;
    }
  }

  const documentRef = options.documentRef ?? globalThis.document;
  const metaValue = documentRef?.querySelector?.('meta[name="discord-client-id"]')?.content;
  return readString(metaValue);
}

function createDiscordAvatarUrl(discordId, avatarHash) {
  const normalizedHash = readString(avatarHash);
  return normalizedHash
    ? `https://cdn.discordapp.com/avatars/${discordId}/${normalizedHash}.png?size=128`
    : null;
}

function withTimeout(operation, timeoutMs, onTimeout) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      reject(new ActivityTimeoutError());
    }, timeoutMs);
  });

  return Promise.race([Promise.resolve().then(operation), timeout])
    .finally(() => clearTimeout(timer));
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new ActivityTimeoutError();
  }
}

function normalizeTimeout(value) {
  return Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : DEFAULT_TIMEOUT_MS;
}

function guestStatusText(reason) {
  if (reason === "timeout") {
    return "Discord 授权超时，当前为访客。";
  }
  if (reason === "authorization-failed") {
    return "Discord 授权失败，当前为访客。";
  }
  if (reason === "missing-client-id") {
    return "Discord Activity 尚未配置，当前为访客。";
  }
  return "当前为访客。";
}

function readString(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

class ActivityTimeoutError extends Error {
  constructor() {
    super("Discord 授权超时");
    this.name = "ActivityTimeoutError";
  }
}
