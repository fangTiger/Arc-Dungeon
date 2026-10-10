import { filterActiveDiscordTextSamples } from "./discordTextIngestion.js";
import { createPersonaPresentation } from "./personaPresentation.js";

const INTEREST_KEYWORDS = {
  technology: ["技术", "接口", "测试", "系统", "规则", "路线", "实现", "代码"],
  lore: ["剧情", "lore", "遗迹", "线索", "主城", "议会", "世界观", "故事"],
  groupPlay: ["组队", "集合", "活动", "大家", "分工", "推进", "计划"],
  trade: ["交易", "市场", "价格", "资源", "金币", "材料"],
  combat: ["战斗", "pvp", "boss", "副本", "伤害", "技能"],
  memes: ["梗", "哈哈", "草", "表情", "meme"],
};

const SOCIAL_KEYWORDS = {
  路线组织者: ["整理", "计划", "分工", "推进", "负责", "先", "步骤"],
  答疑解惑者: ["可以这样", "原因", "因为", "建议", "解释"],
  气氛推动者: ["哈哈", "冲", "太棒", "好耶", "一起"],
  潜行观察者: ["看看", "观察", "先等", "记录"],
};

const SENSITIVE_KEYS = Object.freeze([]);

export function extractDiscordPersonaFeatures(input = {}) {
  const userId = String(input.userId ?? "").trim();
  const activeSamples = filterActiveDiscordTextSamples(input.samples, input.now)
    .filter((sample) => !userId || sample.userId === userId);
  const interestSpectrum = scoreInterestSpectrum(activeSamples);
  const socialRole = chooseSocialRole(activeSamples);
  const expressionStyle = chooseExpressionStyle(activeSamples);
  const activityRhythm = chooseActivityRhythm(activeSamples, input.activitySummaries);
  const sampleCount = activeSamples.length;

  return {
    userId,
    sampleCount,
    interestSpectrum,
    socialRole,
    expressionStyle,
    activityRhythm,
    evidenceSummary: createEvidenceSummary(activeSamples, input.activitySummaries),
    confidence: calculateConfidence(activeSamples, input.activitySummaries),
    sensitiveAttributes: SENSITIVE_KEYS,
  };
}

export function createDiscordPersonaCard(features = {}, options = {}) {
  const generatedAt = normalizeTimestamp(options.generatedAt) ?? new Date().toISOString();
  const presentation = createPersonaPresentation(features, options);
  const card = {
    userId: String(features.userId ?? ""),
    ...presentation,
    evidenceSummary: features.evidenceSummary ?? "样本仍少，画像仅作为社区氛围参考。",
    confidence: roundScore(Number(features.confidence) || 0),
    generatedAt,
    displayOnly: true,
  };

  return card;
}

export function getOrCreateDiscordPersonaCard(input = {}) {
  if (input.existingCard && isPersonaCardFresh(input.existingCard, input.now)) {
    return input.existingCard;
  }

  return createDiscordPersonaCard(
    extractDiscordPersonaFeatures(input),
    { generatedAt: input.now, language: input.language },
  );
}

function scoreInterestSpectrum(samples) {
  const scores = {
    technology: 0,
    lore: 0,
    groupPlay: 0,
    trade: 0,
    combat: 0,
    memes: 0,
  };

  for (const sample of samples) {
    const content = normalizeContent(sample.content);

    for (const [interest, keywords] of Object.entries(INTEREST_KEYWORDS)) {
      scores[interest] += keywords.filter((keyword) => content.includes(keyword.toLowerCase())).length;
    }
  }

  return scores;
}

function chooseSocialRole(samples) {
  const scores = Object.fromEntries(Object.keys(SOCIAL_KEYWORDS).map((role) => [role, 0]));

  for (const sample of samples) {
    const content = normalizeContent(sample.content);

    for (const [role, keywords] of Object.entries(SOCIAL_KEYWORDS)) {
      scores[role] += keywords.filter((keyword) => content.includes(keyword.toLowerCase())).length;
    }
  }

  return chooseMaxKey(scores, "潜行观察者");
}

function chooseExpressionStyle(samples) {
  if (samples.length === 0) {
    return "样本谨慎型";
  }

  const averageLength = samples.reduce((total, sample) => {
    return total + Array.from(String(sample.content ?? "")).length;
  }, 0) / samples.length;
  const questionCount = samples.filter((sample) => String(sample.content ?? "").includes("?") || String(sample.content ?? "").includes("？")).length;

  if (averageLength >= 24) {
    return "长文分析派";
  }

  if (questionCount / samples.length >= 0.35) {
    return "提问探索派";
  }

  return "短句行动派";
}

function chooseActivityRhythm(samples, activitySummaries = []) {
  if (samples.length === 0 && (!Array.isArray(activitySummaries) || activitySummaries.length === 0)) {
    return "样本稀疏型";
  }

  const nightMessages = samples.filter((sample) => {
    const hour = new Date(sample.timestamp).getUTCHours();
    return hour >= 21 || hour <= 2;
  }).length;

  if (samples.length > 0 && nightMessages / samples.length >= 0.6) {
    return "夜间稳定型";
  }

  const activeDays = new Set((activitySummaries ?? []).map((summary) => summary.date)).size;

  if (activeDays >= 3) {
    return "稳定在线型";
  }

  return "事件驱动型";
}

function createEvidenceSummary(samples, activitySummaries = []) {
  const channelCount = new Set(samples.map((sample) => sample.channelId)).size;
  const activeDays = new Set((activitySummaries ?? []).map((summary) => summary.date)).size;
  const activePart = activeDays > 0 ? `，活跃摘要覆盖 ${activeDays} 天` : "";

  return `基于近 30 天 ${samples.length} 条消息、${channelCount} 个频道生成${activePart}。`;
}

function calculateConfidence(samples, activitySummaries = []) {
  const sampleScore = Math.min(samples.length / 8, 0.75);
  const activityScore = Math.min((activitySummaries ?? []).length / 6, 0.25);
  return roundScore(sampleScore + activityScore);
}

function isPersonaCardFresh(card, now) {
  if (!card.expiresAt) {
    return true;
  }

  const checkedAt = normalizeTimestamp(now) ?? new Date().toISOString();
  const expiresAt = normalizeTimestamp(card.expiresAt);
  return expiresAt ? expiresAt > checkedAt : false;
}

function chooseMaxKey(scores, fallback) {
  let selected = fallback;
  let selectedScore = -Infinity;

  for (const [key, value] of Object.entries(scores ?? {})) {
    if (value > selectedScore) {
      selected = key;
      selectedScore = value;
    }
  }

  return selected;
}

function normalizeContent(content) {
  return String(content ?? "").toLowerCase();
}

function normalizeTimestamp(value) {
  const date = new Date(value ?? "");

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function roundScore(value) {
  return Math.round(value * 100) / 100;
}
