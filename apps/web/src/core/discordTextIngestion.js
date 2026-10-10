export const MAX_DISCORD_TEXT_CONTENT_CHARS = 200;

export const DEFAULT_DISCORD_TEXT_INGESTION_POLICY = {
  maxLookbackDays: 30,
  maxMessages: 200,
  cacheTtlDays: 14,
  maxContentChars: MAX_DISCORD_TEXT_CONTENT_CHARS,
};

export function createDiscordTextCollectionPlan(options = {}) {
  const now = normalizeTimestamp(options.now) ?? new Date().toISOString();
  const to = normalizeTimestamp(options.to) ?? now;
  const maxLookbackDays = readPositiveInteger(
    options.maxLookbackDays,
    DEFAULT_DISCORD_TEXT_INGESTION_POLICY.maxLookbackDays,
  );
  const requestedFrom = normalizeTimestamp(options.from) ?? subtractDays(to, maxLookbackDays);
  const earliestFrom = subtractDays(to, maxLookbackDays);
  const from = requestedFrom < earliestFrom ? earliestFrom : requestedFrom;

  return {
    userId: normalizeRequiredId(options.userId, "缺少 Discord userId"),
    guildId: normalizeRequiredId(options.guildId, "缺少 Discord guildId"),
    channelIds: normalizeChannelIds(options.channelIds),
    from,
    to,
    capturedAt: now,
    maxLookbackDays,
    maxMessages: readPositiveInteger(
      options.maxMessages,
      DEFAULT_DISCORD_TEXT_INGESTION_POLICY.maxMessages,
    ),
    cacheTtlDays: readPositiveInteger(
      options.cacheTtlDays,
      DEFAULT_DISCORD_TEXT_INGESTION_POLICY.cacheTtlDays,
    ),
    maxContentChars: readContentLimit(options.maxContentChars),
  };
}

export function normalizeDiscordTextSample(message = {}, plan = {}) {
  const userId = normalizeId(message.author?.id ?? message.authorId ?? message.userId);
  const channelId = normalizeId(message.channel_id ?? message.channelId);
  const guildId = normalizeId(message.guild_id ?? message.guildId ?? plan.guildId);
  const timestamp = normalizeTimestamp(message.timestamp ?? message.createdAt);
  const messageId = normalizeId(message.id ?? message.messageId);

  if (!messageId || !userId || !channelId || !guildId || !timestamp) {
    return null;
  }

  if (plan.userId && userId !== String(plan.userId)) {
    return null;
  }

  if (plan.guildId && guildId !== String(plan.guildId)) {
    return null;
  }

  if (Array.isArray(plan.channelIds) && !plan.channelIds.includes(channelId)) {
    return null;
  }

  if (plan.from && timestamp < plan.from) {
    return null;
  }

  if (plan.to && timestamp > plan.to) {
    return null;
  }

  const capturedAt = normalizeTimestamp(plan.capturedAt) ?? new Date().toISOString();
  const cacheTtlDays = readPositiveInteger(
    plan.cacheTtlDays,
    DEFAULT_DISCORD_TEXT_INGESTION_POLICY.cacheTtlDays,
  );

  return {
    messageId,
    userId,
    channelId,
    guildId,
    timestamp,
    capturedAt,
    expiresAt: addDays(capturedAt, cacheTtlDays),
    content: clipText(message.content, plan.maxContentChars),
  };
}

export function normalizeDiscordTextSamples(messages = [], plan = {}) {
  if (!Array.isArray(messages)) {
    return [];
  }

  const maxMessages = readPositiveInteger(
    plan.maxMessages,
    DEFAULT_DISCORD_TEXT_INGESTION_POLICY.maxMessages,
  );

  return messages
    .map((message) => normalizeDiscordTextSample(message, plan))
    .filter(Boolean)
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, maxMessages);
}

export function filterActiveDiscordTextSamples(samples = [], now = new Date().toISOString()) {
  const checkedAt = normalizeTimestamp(now) ?? new Date().toISOString();

  if (!Array.isArray(samples)) {
    return [];
  }

  return samples.filter((sample) => {
    const expiresAt = normalizeTimestamp(sample.expiresAt);
    return expiresAt ? expiresAt > checkedAt : false;
  });
}

function normalizeChannelIds(channelIds) {
  if (!Array.isArray(channelIds)) {
    throw new Error("Discord 文本采集必须提供频道白名单");
  }

  const normalized = [...new Set(channelIds.map(normalizeId).filter(Boolean))];

  if (normalized.length === 0) {
    throw new Error("Discord 文本采集必须提供频道白名单");
  }

  return normalized;
}

function normalizeRequiredId(value, message) {
  const normalized = normalizeId(value);

  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function normalizeId(value) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTimestamp(value) {
  const date = new Date(value ?? "");

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function readPositiveInteger(value, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }

  return Math.floor(number);
}

function clipText(content, maxContentChars) {
  const text = String(content ?? "").trim();
  const limit = readContentLimit(maxContentChars);

  return Array.from(text).slice(0, limit).join("");
}

function readContentLimit(value) {
  return Math.min(
    readPositiveInteger(value, DEFAULT_DISCORD_TEXT_INGESTION_POLICY.maxContentChars),
    MAX_DISCORD_TEXT_CONTENT_CHARS,
  );
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
