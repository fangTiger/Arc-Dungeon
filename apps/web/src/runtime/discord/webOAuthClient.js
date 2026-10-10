import {
  createGuestIdentity,
  initializeDiscordActivity,
  isDiscordActivityEnvironment,
  readDiscordClientId,
} from "./activityClient.js";
import { initializeRuntimeIdentity } from "./identityBootstrap.js";

const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const PROFILE_URL = "/api/discord/profile";
const OAUTH_STATE_KEY = "arc.discord.oauth.state";
const CALLBACK_KEYS = Object.freeze([
  "code",
  "state",
  "error",
  "error_description",
]);

export async function createDiscordLoginSession(options = {}) {
  const location = options.location ?? globalThis.location;
  const activityAvailable = isDiscordActivityEnvironment(location);
  const clientId = readDiscordClientId({ ...options, location });
  const webOAuthAvailable = !activityAvailable && Boolean(clientId);
  const callbackHandled = !activityAvailable && hasDiscordWebOAuthCallback(location);
  let callbackRuntimeIdentity = null;

  if (callbackHandled) {
    const webIdentity = await completeDiscordWebOAuthCallback({
      ...options,
      location,
    });
    callbackRuntimeIdentity = await initializeRuntimeIdentity({
      initializeActivity: async () => webIdentity,
      loadPersona: options.loadPersona,
    });
  }

  return {
    activityAvailable,
    webOAuthAvailable,
    callbackHandled,
    callbackRuntimeIdentity,
    async authorize() {
      if (activityAvailable) {
        return initializeRuntimeIdentity({
          initializeActivity: options.initializeActivity ?? initializeDiscordActivity,
          loadPersona: options.loadPersona,
        });
      }
      if (!webOAuthAvailable) {
        return createGuestRuntimeResult("missing-client-id");
      }
      return beginDiscordWebOAuth({ ...options, location, clientId });
    },
  };
}

export function hasDiscordWebOAuthCallback(location = globalThis.location) {
  const params = readSearchParams(location);
  return params.has("code") || params.has("error");
}

export function createDiscordAuthorizeUrl({
  clientId,
  location = globalThis.location,
  state = null,
} = {}) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", readRequiredString(clientId, "Discord 客户端 ID"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", createRedirectUri(location));
  url.searchParams.set("scope", "identify");
  if (readString(state)) {
    url.searchParams.set("state", readString(state));
  }
  return url.toString();
}

async function beginDiscordWebOAuth(options) {
  const state = createOAuthState(options);
  if (state) {
    safelyWriteStorage(options.sessionStorage ?? globalThis.sessionStorage, OAUTH_STATE_KEY, state);
  }
  const authorizeUrl = createDiscordAuthorizeUrl({
    clientId: options.clientId,
    location: options.location,
    state,
  });
  const navigate = options.navigate ?? ((url) => options.location.assign(url));
  navigate(authorizeUrl);
  return { redirecting: true, authorizeUrl };
}

async function completeDiscordWebOAuthCallback(options) {
  const params = readSearchParams(options.location);
  const code = readString(params.get("code"));
  const upstreamError = readString(params.get("error"));
  const returnedState = readString(params.get("state"));
  const storage = options.sessionStorage ?? globalThis.sessionStorage;
  const expectedState = safelyReadStorage(storage, OAUTH_STATE_KEY);

  clearDiscordCallbackFromAddress(options.location, options.history ?? globalThis.history);
  safelyRemoveStorage(storage, OAUTH_STATE_KEY);

  if (upstreamError) {
    return createWebGuestIdentity(
      upstreamError === "access_denied" ? "web-access-denied" : "web-callback-error",
      upstreamError === "access_denied"
        ? "已拒绝 Discord 授权，当前为访客。"
        : "Discord 回调失败，当前为访客。",
    );
  }
  if (!code) {
    return createWebGuestIdentity("web-callback-error", "Discord 回调失败，当前为访客。");
  }
  if (expectedState && returnedState !== expectedState) {
    return createWebGuestIdentity("web-state-invalid", "Discord 回调校验失败，当前为访客。");
  }

  try {
    const response = await (options.fetchImpl ?? globalThis.fetch)(PROFILE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ code }),
    });
    if (!response?.ok) {
      throw new Error("用户资料后端返回失败");
    }
    const profile = await response.json();
    return createWebDiscordIdentity(profile);
  } catch {
    return createWebGuestIdentity("web-backend-unavailable", "Discord 登录服务不可用，当前为访客。");
  }
}

function createWebDiscordIdentity(profile) {
  const discordId = readString(profile?.id);
  const username = readString(profile?.username);
  const displayName = readString(profile?.globalName) ?? username;
  if (!discordId || !username || !displayName) {
    throw new Error("Discord 用户资料无效");
  }
  return {
    kind: "discord",
    isActivity: false,
    authenticated: true,
    discordId,
    displayName,
    avatarUrl: readString(profile?.avatarUrl),
    reason: null,
    statusText: "已连接 Discord 身份。",
  };
}

function createWebGuestIdentity(reason, statusText) {
  return {
    ...createGuestIdentity(reason),
    reason,
    statusText,
  };
}

function createGuestRuntimeResult(reason) {
  return {
    activityIdentity: createGuestIdentity(reason),
    personaPreview: null,
    heroIdentity: null,
  };
}

function clearDiscordCallbackFromAddress(location, history) {
  if (!location?.href || typeof history?.replaceState !== "function") {
    return;
  }
  const url = new URL(location.href);
  for (const key of CALLBACK_KEYS) {
    url.searchParams.delete(key);
  }
  history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function createRedirectUri(location) {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function createOAuthState(options) {
  const value = typeof options.createState === "function"
    ? options.createState()
    : globalThis.crypto?.randomUUID?.();
  return readString(value);
}

function readSearchParams(location) {
  return new URLSearchParams(typeof location?.search === "string" ? location.search : "");
}

function safelyReadStorage(storage, key) {
  try {
    return readString(storage?.getItem(key));
  } catch {
    return null;
  }
}

function safelyWriteStorage(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {
    // 浏览器禁用会话存储时仍允许完成 OAuth 跳转。
  }
}

function safelyRemoveStorage(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    // 清理失败不应阻断登录或访客降级。
  }
}

function readRequiredString(value, label) {
  const text = readString(value);
  if (!text) {
    throw new Error(`${label}未配置`);
  }
  return text;
}

function readString(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}
