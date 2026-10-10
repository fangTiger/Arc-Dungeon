export function calculateRunRewards({ depthReached, bossesDefeated, explorationRate } = {}) {
  const depth = normalizeDepth(depthReached);
  const bosses = normalizeCount(bossesDefeated);
  const exploration = clamp01(explorationRate);

  /*
   * 层数项代表普通推进收益：玩家越深入，基础收益越高。
   * Token 用 6/13，使第 27 层的 26 个推进台阶贡献 12 Token。
   */
  const depthSteps = Math.max(0, depth - 1);
  const tokenDepthScore = (depthSteps * 6) / 13;

  /*
   * Boss 项是主要跳变收益：每个 Boss 明显高于若干普通层推进。
   * 两个 Boss 在满探索结算中贡献 8 Token，
   * 配合层数项命中旧 Token 锚点：27 层、2 Boss、100% 探索 => 20 Token。
   */
  const tokenBossScore = bosses * 4;

  /*
   * 探索率项用于奖励把楼层走完整的 run。
   * 乘数最低保留 35%，避免低探索但已击败 Boss 的 run 被压成无意义奖励；
   * 满探索时乘数为 1，不改变文档锚点。
   */
  const explorationMultiplier = 0.35 + exploration * 0.65;

  return {
    tokens: Math.max(0, Math.floor((tokenDepthScore + tokenBossScore) * explorationMultiplier)),
  };
}

export function calculateRunRewardsFromStats(stats = {}) {
  const runStats = stats.stats ?? stats;
  const explorationRate = Number.isFinite(runStats.explorationRate)
    ? runStats.explorationRate
    : explorationRateFromCounts(runStats);

  return calculateRunRewards({
    depthReached: stats.depthReached ?? stats.depth ?? stats.currentDepth ?? runStats.depthReached,
    bossesDefeated: runStats.bossesDefeated,
    explorationRate,
  });
}

function normalizeDepth(value) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
}

function normalizeCount(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function explorationRateFromCounts(stats) {
  if (!Number.isFinite(stats.visitedRoomCount) || !Number.isFinite(stats.totalRoomCount)) {
    return 0;
  }

  if (stats.totalRoomCount <= 0) {
    return 0;
  }

  return stats.visitedRoomCount / stats.totalRoomCount;
}
