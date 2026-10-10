const CHANNEL_REGION = {
  dev: "mine",
  general: "town",
  memes: "forest",
  support: "grassland",
  announcements: "town",
};

const REGION_LABEL = {
  town: "主城",
  grassland: "草地",
  forest: "森林",
  mine: "矿洞",
};

export function createWorldModifier(activity) {
  const messageScore = Math.min(activity.messageCount / 200, 1);
  const interactionScore = Math.min(activity.interactionCount / 80, 1);
  const contributionScore = Math.min(activity.factionContribution / 100, 1);
  const activityScore = (messageScore + interactionScore + contributionScore) / 3;
  const activeRegion = CHANNEL_REGION[activity.activeChannel] ?? "grassland";
  const regionLabel = REGION_LABEL[activeRegion];

  const xpMultiplier = roundMultiplier(1 + activityScore * 0.18);
  const lootMultiplier = roundMultiplier(1 + contributionScore * 0.16);
  const spawnPressure = roundMultiplier(1 + interactionScore * 0.22);

  return {
    activeRegion,
    xpMultiplier,
    lootMultiplier,
    spawnPressure,
    announcement: `今日 ${activity.activeChannel} 频道点燃了${regionLabel}，经验 x${xpMultiplier}，掉落 x${lootMultiplier}。`,
  };
}

export function applyRewardModifiers(reward, modifier) {
  return {
    xp: Math.round(reward.xp * modifier.xpMultiplier),
    coins: Math.round(reward.coins * modifier.lootMultiplier),
    materials: Math.floor(reward.materials * modifier.lootMultiplier),
  };
}

function roundMultiplier(value) {
  return Math.round(value * 100) / 100;
}

export const mockDiscordActivity = {
  messageCount: 240,
  interactionCount: 90,
  activeChannel: "dev",
  factionContribution: 80,
};
