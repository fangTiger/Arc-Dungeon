import {
  chooseEnemySpawnPoints,
  createEnemy,
  pickEnemyTypeForDepth,
} from "../../core/combat.js";
import {
  collectDoorTiles,
  collectWalkableTiles,
  ENEMY_RADIUS,
  enemyCountForDepth,
} from "./dungeonCombatLogic.js";
import { applyTicketDifficultyToEnemy } from "../../core/run/runRewards.js";

const MIN_SPAWN_DISTANCE = 56;

export function spawnCombatEnemies({ roomMap, run, player, rng }) {
  const depth = run.depth;
  const points = chooseEnemySpawnPoints({
    walkableTiles: collectWalkableTiles(roomMap),
    forbiddenTiles: collectDoorTiles(roomMap),
    player,
    count: enemyCountForDepth(depth),
    minDistance: MIN_SPAWN_DISTANCE,
    tileSize: roomMap.tileSize,
    rng,
  });

  return points.map((point, index) => {
    const type = pickEnemyTypeForDepth(depth, rng).id;
    return applyTicketDifficultyToEnemy(createEnemy(type, {
      id: `${roomMap.id}:enemy:${index}`,
      depth,
      x: point.x,
      y: point.y,
      radius: ENEMY_RADIUS,
      spawnX: point.x,
      spawnY: point.y,
      facingX: index % 2 === 0 ? -1 : 1,
      knockbackX: 0,
      knockbackY: 0,
      patrolPhase: rng.next() * Math.PI * 2,
    }), run);
  });
}
