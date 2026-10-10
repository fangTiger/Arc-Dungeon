const ROLE_TITLES = [
  { role: "Founder", title: "Founding Citizen" },
  { role: "Admin", title: "Council Steward" },
  { role: "Moderator", title: "Gate Warden" },
  { role: "Raid Lead", title: "Raid Herald" },
  { role: "Lore Crafter", title: "Lore Keeper" },
  { role: "Builder", title: "Town Builder" },
];

export const mockDiscordProfile = {
  id: "112233",
  username: "rialo_dev",
  globalName: "ARC Dev",
  roles: ["Founder", "Lore Crafter", "Raid Lead"],
  joinedAt: "2025-02-10T00:00:00.000Z",
  avatarColor: "#7bdff2",
  activity: {
    messages30d: 128,
    voiceMinutes30d: 320,
  },
};

export function normalizeDiscordProfile(profile = {}) {
  const username = sanitizeText(profile.username, "traveler");
  const displayName = sanitizeText(profile.globalName ?? profile.displayName, username);

  return {
    id: String(profile.id ?? "local-preview"),
    username,
    displayName,
    roles: normalizeRoles(profile.roles),
    joinedAt: normalizeDate(profile.joinedAt),
    avatarColor: normalizeColor(profile.avatarColor),
    activity: {
      messages30d: Math.max(0, Number(profile.activity?.messages30d ?? 0)),
      voiceMinutes30d: Math.max(0, Number(profile.activity?.voiceMinutes30d ?? 0)),
    },
  };
}

export function createCharacterIdentityFromDiscordProfile(profile) {
  const normalized = normalizeDiscordProfile(profile);
  const primaryTitle = ROLE_TITLES.find(({ role }) => normalized.roles.includes(role));
  const joinedYear = new Date(normalized.joinedAt).getUTCFullYear();

  return {
    source: "Discord",
    displayName: normalized.displayName,
    title: primaryTitle?.title ?? "ARC Citizen",
    roleBadges: normalized.roles.slice(0, 4),
    profileColor: normalized.avatarColor,
    joinedYear,
    activityLabel: createActivityLabel(normalized.activity),
    identitySeed: `dc-${normalized.id}-${hashIdentity(normalized.id + normalized.username)}`,
  };
}

function normalizeRoles(roles) {
  if (!Array.isArray(roles)) {
    return ["Community"];
  }

  const cleaned = roles
    .map((role) => sanitizeText(role, ""))
    .filter(Boolean);

  return cleaned.length > 0 ? [...new Set(cleaned)] : ["Community"];
}

function normalizeDate(date) {
  const parsed = new Date(date ?? "");
  if (Number.isNaN(parsed.getTime())) {
    return "1970-01-01T00:00:00.000Z";
  }

  return parsed.toISOString();
}

function normalizeColor(color) {
  return /^#[0-9a-f]{6}$/i.test(String(color)) ? color : "#f8e38a";
}

function sanitizeText(value, fallback) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

function createActivityLabel(activity) {
  if (activity.messages30d >= 100 || activity.voiceMinutes30d >= 240) {
    return "本月高活跃";
  }

  if (activity.messages30d >= 20 || activity.voiceMinutes30d >= 60) {
    return "稳定在线";
  }

  return "新近到访";
}

function hashIdentity(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}
