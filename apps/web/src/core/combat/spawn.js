export function chooseEnemySpawnPoints({
  walkableTiles,
  forbiddenTiles = [],
  player,
  count,
  minDistance,
  tileSize,
  rng,
}) {
  validateSpawnInput({ walkableTiles, player, count, minDistance, tileSize, rng });
  const forbidden = new Set(forbiddenTiles.map(tileKey));
  const candidates = walkableTiles
    .filter((tile) => !forbidden.has(tileKey(tile)))
    .map((tile) => ({
      tileX: tile.tileX,
      tileY: tile.tileY,
      x: tile.tileX * tileSize + tileSize / 2,
      y: tile.tileY * tileSize + tileSize / 2,
    }))
    .filter((point) => Math.hypot(point.x - player.x, point.y - player.y) >= minDistance);

  if (candidates.length < count) {
    throw new RangeError("合法敌人生成点数量不足");
  }

  return shuffle(candidates, rng).slice(0, count);
}

function validateSpawnInput({ walkableTiles, player, count, minDistance, tileSize, rng }) {
  if (!Array.isArray(walkableTiles)) {
    throw new TypeError("可行走区域必须是 tile 列表");
  }

  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError("敌人数量必须是非负整数");
  }

  if (!Number.isFinite(minDistance) || minDistance < 0) {
    throw new RangeError("最小生成距离必须是非负数");
  }

  if (!Number.isInteger(tileSize) || tileSize <= 0) {
    throw new RangeError("tileSize 必须是正整数");
  }

  if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)) {
    throw new TypeError("玩家位置必须包含有效坐标");
  }

  if (!rng || typeof rng.next !== "function") {
    throw new TypeError("敌人生成点选择必须传入 rng");
  }
}

function shuffle(items, rng) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng.next() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function tileKey({ tileX, tileY }) {
  return `${tileX},${tileY}`;
}
