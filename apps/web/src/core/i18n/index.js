import { EN_MESSAGES } from "./en.js";
import { ZH_CN_MESSAGES } from "./zh-CN.js";

export const DEFAULT_LANGUAGE = "zh-CN";
export const I18N_STORAGE_KEY = "arc.language";
export const SUPPORTED_LANGUAGES = Object.freeze(["zh-CN", "en"]);
export const I18N_CATALOGS = Object.freeze({
  "zh-CN": ZH_CN_MESSAGES,
  en: EN_MESSAGES,
});

export function normalizeLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
}

export function createTranslator(language, onMissingKey = reportMissingKey) {
  const normalizedLanguage = normalizeLanguage(language);
  return (key, parameters = {}) => {
    const value = I18N_CATALOGS[normalizedLanguage]?.[key];
    if (typeof value === "string" && value.length > 0) {
      return formatMessage(value, parameters);
    }

    onMissingKey({ language: normalizedLanguage, key });
    return `⟦missing:${normalizedLanguage}:${key}⟧`;
  };
}

export function createI18n({ storage = false, onMissingKey = reportMissingKey } = {}) {
  let language = readStoredLanguage(storage);

  function t(key, parameters = {}) {
    const value = I18N_CATALOGS[language]?.[key];
    if (typeof value === "string" && value.length > 0) {
      return formatMessage(value, parameters);
    }

    onMissingKey({ language, key });
    return `⟦missing:${language}:${key}⟧`;
  }

  function setLanguage(nextLanguage) {
    if (!SUPPORTED_LANGUAGES.includes(nextLanguage)) {
      throw new RangeError(`不支持的界面语言：${nextLanguage}`);
    }

    language = nextLanguage;
    persistLanguage(storage, language);
    return language;
  }

  function toggleLanguage() {
    return setLanguage(language === "zh-CN" ? "en" : "zh-CN");
  }

  return {
    getLanguage: () => language,
    setLanguage,
    t,
    toggleLanguage,
  };
}

const defaultI18n = createI18n();

export function translate(key, parameters) {
  return defaultI18n.t(key, parameters);
}

function readStoredLanguage(storage) {
  if (!storage || typeof storage.getItem !== "function") {
    return DEFAULT_LANGUAGE;
  }

  try {
    const storedLanguage = storage.getItem(I18N_STORAGE_KEY);
    return normalizeLanguage(storedLanguage);
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function persistLanguage(storage, language) {
  if (!storage || typeof storage.setItem !== "function") {
    return;
  }

  try {
    storage.setItem(I18N_STORAGE_KEY, language);
  } catch {
    // 存储不可用时仍保留当前会话语言，避免切换操作失效。
  }
}

function reportMissingKey({ language, key }) {
  globalThis.console?.warn?.(`[i18n] 缺失词条：${language} / ${key}`);
}

function formatMessage(template, parameters) {
  return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/gu, (placeholder, name) => (
    Object.hasOwn(parameters, name) ? String(parameters[name]) : placeholder
  ));
}
