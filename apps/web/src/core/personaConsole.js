import {
  createDiscordPersonaCard,
  extractDiscordPersonaFeatures,
} from "./discordPersona.js";
import { requestPersonaEnhancement } from "./personaRemote.js";
import { normalizeLanguage } from "./i18n/index.js";

export function createPersonaConsolePreview(input = {}) {
  const discordId = normalizeDiscordId(input.discordId ?? input.userId);
  const language = normalizeLanguage(input.language);

  if (!discordId) {
    return {
      discordId: "",
      language,
      status: {
        kind: "idle",
        text: "输入 Discord ID 后读取本地预览样本。",
      },
      card: null,
      features: null,
      source: "local",
      fallbackReason: null,
      usesRemoteApi: false,
      usesLlm: false,
    };
  }

  const now = normalizeTimestamp(input.now) ?? new Date().toISOString();
  const samples = createLocalPersonaSamples(discordId, now);
  const activitySummaries = createLocalActivitySummaries(discordId, now);
  const features = extractDiscordPersonaFeatures({
    userId: discordId,
    samples,
    activitySummaries,
    now,
  });
  const card = createDiscordPersonaCard(features, {
    generatedAt: now,
    language,
  });

  return {
    discordId,
    language,
    status: {
      kind: "ready",
      text: "本地 ARC 档案已生成。",
    },
    card,
    features,
    source: "local",
    fallbackReason: null,
    usesRemoteApi: false,
    usesLlm: false,
  };
}

export async function loadPersonaConsolePreview(input = {}, context = {}) {
  const preview = createPersonaConsolePreview(input);
  return preview.card
    ? requestPersonaEnhancement(preview, context)
    : preview;
}

export function createPersonaConsoleViewModel(preview = {}) {
  const card = preview.card;

  if (!card) {
    return {
      heading: "Discord 灵魂档案",
      discordId: preview.discordId ?? "",
      statusKind: preview.status?.kind ?? "idle",
      statusText: preview.status?.text ?? "输入 Discord ID 后读取本地预览样本。",
      rows: [],
      summary: "",
    };
  }

  return {
    heading: "Discord 灵魂档案",
    discordId: preview.discordId ?? card.userId,
    statusKind: preview.status?.kind ?? "ready",
    statusText: preview.status?.text ?? "本地 ARC 档案已生成。",
    titleLine: card.rialoTitle,
    archetype: card.soulArchetype,
    summary: card.narrativeSummary,
    rows: [
      { label: "灵魂原型", value: card.soulArchetype },
      { label: "称号", value: card.rialoTitle },
      { label: "阵营倾向", value: formatFactionAffinity(card.factionAffinity) },
      { label: "推荐身份", value: (card.recommendedRoles ?? []).join(" / ") },
      { label: "可信度", value: `${Math.round((Number(card.confidence) || 0) * 100)}%` },
      { label: "证据摘要", value: card.evidenceSummary },
    ],
  };
}

function createLocalPersonaSamples(discordId, now) {
  const capturedAt = now;
  const expiresAt = addDays(now, 7);
  const guildId = "rialo-preview";

  return [
    createSample({
      discordId,
      guildId,
      channelId: "strategy",
      messageId: `${discordId}-preview-1`,
      timestamp: subtractHours(now, 3),
      capturedAt,
      expiresAt,
      content: "我来整理一下技术路线，先把接口、规则和测试拆开，今晚推进第一版。",
    }),
    createSample({
      discordId,
      guildId,
      channelId: "lore",
      messageId: `${discordId}-preview-2`,
      timestamp: subtractHours(now, 7),
      capturedAt,
      expiresAt,
      content: "这个剧情线索可以放在旧路遗迹，让主城议会和边境行会都有牵连。",
    }),
    createSample({
      discordId,
      guildId,
      channelId: "party",
      messageId: `${discordId}-preview-3`,
      timestamp: subtractHours(now, 25),
      capturedAt,
      expiresAt,
      content: "大家先集合，我负责把活动计划和资源分工写出来，方便后面继续推进。",
    }),
    createSample({
      discordId,
      guildId,
      channelId: "strategy",
      messageId: `${discordId}-preview-4`,
      timestamp: subtractHours(now, 30),
      capturedAt,
      expiresAt,
      content: "如果要做长期系统，建议先确认规则边界，再决定怎么接到玩法里。",
    }),
  ];
}

function createLocalActivitySummaries(discordId, now) {
  return [0, 1, 2].map((offset) => ({
    userId: discordId,
    date: subtractDays(now, offset).slice(0, 10),
    messages: 6 + offset,
    voiceMinutes: 12 - offset * 2,
    reactions: 2,
    activeChannels: ["strategy", "party"],
    score: 18 + offset,
    streak: 3 - offset,
    lastActiveAt: subtractHours(now, offset * 12),
  }));
}

function createSample({
  discordId,
  guildId,
  channelId,
  messageId,
  timestamp,
  capturedAt,
  expiresAt,
  content,
}) {
  return {
    messageId,
    userId: discordId,
    channelId,
    guildId,
    timestamp,
    capturedAt,
    expiresAt,
    content,
  };
}

function formatFactionAffinity(factions = []) {
  return factions
    .map((entry) => `${entry.faction} ${entry.score}`)
    .join(" / ");
}

function normalizeDiscordId(value) {
  return String(value ?? "").trim();
}

function normalizeTimestamp(value) {
  const date = new Date(value ?? "");

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function addDays(timestamp, days) {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function subtractDays(timestamp, days) {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function subtractHours(timestamp, hours) {
  const date = new Date(timestamp);
  date.setUTCHours(date.getUTCHours() - hours);
  return date.toISOString();
}
