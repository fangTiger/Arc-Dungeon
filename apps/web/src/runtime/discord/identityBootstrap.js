import { createPixelHero } from "../../core/identity/heroFactory.js";
import {
  I18N_STORAGE_KEY,
  normalizeLanguage,
} from "../../core/i18n/index.js";
import {
  createPersonaConsolePreview,
  loadPersonaConsolePreview,
} from "../../core/personaConsole.js";
import {
  createGuestIdentity,
  initializeDiscordActivity,
} from "./activityClient.js";

export async function initializeRuntimeIdentity({
  initializeActivity = initializeDiscordActivity,
  loadPersona = loadPersonaConsolePreview,
  language = readInterfaceLanguage(),
} = {}) {
  const interfaceLanguage = normalizeLanguage(language);
  const activityIdentity = await safelyInitializeActivity(initializeActivity);

  if (activityIdentity.kind !== "discord" || !activityIdentity.authenticated) {
    return {
      activityIdentity,
      personaPreview: null,
      heroIdentity: createPixelHero({ language: interfaceLanguage }),
    };
  }

  const personaPreview = await safelyLoadPersona({
    discordId: activityIdentity.discordId,
    language: interfaceLanguage,
    loadPersona,
  });
  const heroIdentity = createPixelHero({
    discordId: activityIdentity.discordId,
    displayName: activityIdentity.displayName,
    avatarUrl: activityIdentity.avatarUrl,
    personaCard: personaPreview.card,
    language: interfaceLanguage,
  });

  return {
    activityIdentity,
    personaPreview,
    heroIdentity,
  };
}

export function createGuestRuntimeIdentity(reason = "non-activity", language = readInterfaceLanguage()) {
  return {
    activityIdentity: createGuestIdentity(reason),
    personaPreview: null,
    heroIdentity: createPixelHero({ language }),
  };
}

async function safelyInitializeActivity(initializeActivity) {
  if (typeof initializeActivity !== "function") {
    return createGuestIdentity("authorization-failed");
  }

  try {
    const identity = await initializeActivity();
    return isRecord(identity)
      ? identity
      : createGuestIdentity("authorization-failed");
  } catch {
    return createGuestIdentity("authorization-failed");
  }
}

async function safelyLoadPersona({ discordId, language, loadPersona }) {
  try {
    const preview = await loadPersona({ discordId, language });
    if (isRecord(preview) && isRecord(preview.card)) {
      return preview;
    }
  } catch {
    // 画像失败不能阻断身份与游戏启动，统一落到本地确定性画像。
  }

  const local = createPersonaConsolePreview({ discordId, language });
  return {
    ...local,
    source: "fallback",
    fallbackReason: "request-failed",
    status: {
      kind: "fallback",
      text: "画像服务不可用，已使用本地规则画像。",
    },
  };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readInterfaceLanguage(storage = globalThis.window?.localStorage) {
  try {
    return normalizeLanguage(storage?.getItem?.(I18N_STORAGE_KEY));
  } catch {
    return normalizeLanguage(null);
  }
}
