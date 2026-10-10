export const SUPPORTED_DISCORD_ACTIVITY_TYPES = [
  "message",
  "voice",
  "reaction",
  "thread",
  "quest",
  "check-in",
];

export const DEFAULT_ACTIVITY_SCORE_RULES = {
  weights: {
    message: 1,
    voiceMinute: 0.5,
    reaction: 0.25,
    thread: 2,
    quest: 6,
    checkIn: 4,
  },
  caps: {
    messages: 40,
    voice: 30,
    reactions: 10,
    threads: 10,
    quests: 20,
    checkIns: 8,
    daily: 100,
  },
};

const TYPE_ALIASES = {
  message: "message",
  voice: "voice",
  voice_state: "voice",
  reaction: "reaction",
  thread: "thread",
  quest: "quest",
  checkin: "check-in",
  check_in: "check-in",
  "check-in": "check-in",
};

export const mockDiscordActivityEvents = [
  {
    type: "message",
    userId: "112233",
    timestamp: "2026-08-08T01:00:00.000Z",
    guildId: "rialo",
    channelId: "general",
    messageId: "preview-1",
  },
  {
    type: "voice",
    userId: "112233",
    timestamp: "2026-08-08T02:00:00.000Z",
    guildId: "rialo",
    channelId: "raid-voice",
    voiceMinutes: 24,
  },
  {
    type: "check-in",
    userId: "112233",
    timestamp: "2026-08-08T03:00:00.000Z",
    guildId: "rialo",
    channelId: "quests",
  },
];

export function normalizeDiscordActivityEvent(event = {}) {
  if (!event || typeof event !== "object") {
    return null;
  }

  const type = normalizeActivityType(event.type ?? event.eventType);
  const userId = normalizeId(
    event.userId ?? event.discordUserId ?? event.authorId ?? event.memberId,
  );
  const occurredAt = normalizeTimestamp(
    event.timestamp ?? event.occurredAt ?? event.createdAt,
  );

  if (!type || !userId || !occurredAt) {
    return null;
  }

  const normalized = {
    type,
    userId,
    occurredAt,
    date: occurredAt.slice(0, 10),
    voiceMinutes: normalizeVoiceMinutes(event),
  };

  assignOptionalId(normalized, "guildId", event.guildId);
  assignOptionalId(normalized, "channelId", event.channelId);
  assignOptionalId(normalized, "messageId", event.messageId);
  assignOptionalId(normalized, "threadId", event.threadId);
  assignOptionalId(normalized, "questId", event.questId);

  return normalized;
}

export function normalizeDiscordActivityEvents(events = []) {
  if (!Array.isArray(events)) {
    return [];
  }

  return events
    .map((event) => normalizeDiscordActivityEvent(event))
    .filter(Boolean);
}

export function aggregateDailyDiscordActivity(events = [], options = {}) {
  const buckets = new Map();

  for (const event of normalizeDiscordActivityEvents(events)) {
    const key = `${event.date}\u0000${event.userId}`;
    const bucket = buckets.get(key) ?? createEmptyDailySummary(event);

    bucket.messages += event.type === "message" ? 1 : 0;
    bucket.voiceMinutes = roundScore(bucket.voiceMinutes + event.voiceMinutes);
    bucket.reactions += event.type === "reaction" ? 1 : 0;
    bucket.threads += event.type === "thread" ? 1 : 0;
    bucket.quests += event.type === "quest" ? 1 : 0;
    bucket.checkIns += event.type === "check-in" ? 1 : 0;

    if (event.channelId) {
      bucket.activeChannelSet.add(event.channelId);
    }

    if (!bucket.lastActiveAt || event.occurredAt > bucket.lastActiveAt) {
      bucket.lastActiveAt = event.occurredAt;
    }

    buckets.set(key, bucket);
  }

  const summaries = Array.from(buckets.values()).map((bucket) => {
    const { activeChannelSet, ...summary } = bucket;
    const score = calculateDiscordActivityScore(summary, options.scoreRules);

    return {
      ...summary,
      activeChannels: Array.from(activeChannelSet).sort(),
      score: score.score,
      scoreBreakdown: score.scoreBreakdown,
    };
  });

  applyStreaks(summaries);

  return sortSummaries(summaries);
}

export function calculateDiscordActivityScore(activity = {}, rules = {}) {
  const mergedRules = mergeScoreRules(rules);
  const { weights, caps } = mergedRules;
  const scoreBreakdown = {
    messages: capScore(readCount(activity.messages) * weights.message, caps.messages),
    voice: capScore(readCount(activity.voiceMinutes) * weights.voiceMinute, caps.voice),
    reactions: capScore(readCount(activity.reactions) * weights.reaction, caps.reactions),
    threads: capScore(readCount(activity.threads) * weights.thread, caps.threads),
    quests: capScore(readCount(activity.quests) * weights.quest, caps.quests),
    checkIns: capScore(readCount(activity.checkIns) * weights.checkIn, caps.checkIns),
  };
  const subtotal = Object.values(scoreBreakdown).reduce((total, value) => total + value, 0);

  return {
    score: capScore(subtotal, caps.daily),
    scoreBreakdown,
  };
}

export function getDiscordActivityForUser(summaries = [], userId) {
  const normalizedUserId = normalizeId(userId);

  if (!normalizedUserId || !Array.isArray(summaries)) {
    return [];
  }

  return sortSummaries(summaries.filter((summary) => summary.userId === normalizedUserId));
}

export function getDiscordActivityForDate(summaries = [], date) {
  const normalizedDate = normalizeDateOnly(date);

  if (!normalizedDate || !Array.isArray(summaries)) {
    return [];
  }

  return sortSummaries(summaries.filter((summary) => summary.date === normalizedDate));
}

export function getDiscordActivityForRange(summaries = [], range = {}) {
  if (!Array.isArray(summaries)) {
    return [];
  }

  const from = normalizeDateOnly(range.from);
  const to = normalizeDateOnly(range.to);
  const userId = normalizeId(range.userId);

  return sortSummaries(
    summaries.filter((summary) => {
      const afterStart = from ? summary.date >= from : true;
      const beforeEnd = to ? summary.date <= to : true;
      const matchesUser = userId ? summary.userId === userId : true;

      return afterStart && beforeEnd && matchesUser;
    }),
  );
}

function normalizeActivityType(type) {
  const normalized = String(type ?? "").trim().toLowerCase();
  return TYPE_ALIASES[normalized] ?? null;
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

function normalizeDateOnly(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return String(value);
  }

  const timestamp = normalizeTimestamp(value);
  return timestamp ? timestamp.slice(0, 10) : null;
}

function normalizeVoiceMinutes(event) {
  const directMinutes = readOptionalNumber(
    event.voiceMinutes ?? event.durationMinutes ?? event.minutes,
  );

  if (directMinutes !== null) {
    return roundScore(Math.max(0, directMinutes));
  }

  const seconds = readOptionalNumber(event.durationSeconds ?? event.voiceSeconds);

  if (seconds !== null) {
    return roundScore(Math.max(0, seconds / 60));
  }

  return 0;
}

function assignOptionalId(target, key, value) {
  const normalized = normalizeId(value);

  if (normalized) {
    target[key] = normalized;
  }
}

function createEmptyDailySummary(event) {
  return {
    userId: event.userId,
    date: event.date,
    messages: 0,
    voiceMinutes: 0,
    reactions: 0,
    threads: 0,
    quests: 0,
    checkIns: 0,
    activeChannelSet: new Set(),
    score: 0,
    scoreBreakdown: createEmptyScoreBreakdown(),
    streak: 0,
    lastActiveAt: event.occurredAt,
  };
}

function createEmptyScoreBreakdown() {
  return {
    messages: 0,
    voice: 0,
    reactions: 0,
    threads: 0,
    quests: 0,
    checkIns: 0,
  };
}

function applyStreaks(summaries) {
  const summariesByUser = new Map();

  for (const summary of summaries) {
    const userSummaries = summariesByUser.get(summary.userId) ?? [];
    userSummaries.push(summary);
    summariesByUser.set(summary.userId, userSummaries);
  }

  for (const userSummaries of summariesByUser.values()) {
    userSummaries.sort((left, right) => left.date.localeCompare(right.date));

    let streak = 0;
    let previousDate = null;

    for (const summary of userSummaries) {
      streak = previousDate && nextUTCDate(previousDate) === summary.date ? streak + 1 : 1;
      summary.streak = streak;
      previousDate = summary.date;
    }
  }
}

function nextUTCDate(date) {
  const nextDate = new Date(`${date}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return nextDate.toISOString().slice(0, 10);
}

function sortSummaries(summaries) {
  return [...summaries].sort((left, right) => {
    const dateOrder = left.date.localeCompare(right.date);

    if (dateOrder !== 0) {
      return dateOrder;
    }

    return left.userId.localeCompare(right.userId);
  });
}

function mergeScoreRules(rules = {}) {
  return {
    weights: {
      ...DEFAULT_ACTIVITY_SCORE_RULES.weights,
      ...rules.weights,
    },
    caps: {
      ...DEFAULT_ACTIVITY_SCORE_RULES.caps,
      ...rules.caps,
    },
  };
}

function readCount(value) {
  return Math.max(0, Number(value) || 0);
}

function readOptionalNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function capScore(value, cap) {
  return roundScore(Math.min(Math.max(0, value), Math.max(0, Number(cap) || 0)));
}

function roundScore(value) {
  return Math.round(value * 100) / 100;
}
