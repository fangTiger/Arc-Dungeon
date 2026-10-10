export async function synchronizePlayerSaveForIdentity({
  economy,
  runtimeIdentity,
  saveLocalIdentity = () => economy.saveProfileIdentity(runtimeIdentity.heroIdentity),
} = {}) {
  const activityIdentity = runtimeIdentity?.activityIdentity;
  const authenticated = activityIdentity?.kind === "discord"
    && activityIdentity.authenticated === true;
  const discordId = normalizeDiscordId(activityIdentity?.discordId);

  if (!authenticated || !discordId) {
    return { ok: true, source: "local-guest" };
  }

  try {
    // 先切断旧身份写通道，避免账号切换时把新身份写进旧账号。
    await economy.connectPlayerSave(null);
    await saveLocalIdentity();
    return await economy.connectPlayerSave(discordId);
  } catch {
    return {
      ok: false,
      degraded: true,
      reason: "unavailable",
    };
  }
}

function normalizeDiscordId(discordId) {
  const normalized = String(discordId ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}
