import { createBossForDepth, createPoiseState } from "../../core/combat.js";
import { beginUpgradeChoice, markBossDefeated } from "../../core/run/runState.js";

export function shouldSpawnBossRoom(run, room) {
  return room?.type === "boss" && !run.defeatedBossDepths.includes(run.depth);
}

export function spawnBossEnemy({ roomMap, run, rng }) {
  const boss = createBossForDepth({ seed: run.seed, depth: run.depth });
  const x = Math.round((roomMap.width * roomMap.tileSize) / 2);
  const y = Math.round(roomMap.tileSize * 4.15);

  return {
    ...boss,
    id: `${roomMap.id}:boss:${run.depth}`,
    isBoss: true,
    ...createPoiseState({ ...boss, isBoss: true }),
    x,
    y,
    radius: 12,
    spawnX: x,
    spawnY: y,
    facingX: -1,
    knockbackX: 0,
    knockbackY: 0,
    patrolPhase: rng.next() * Math.PI * 2,
    staticFrameName: boss.spritePrefix === "necromancer" ? boss.idleFrameName : null,
  };
}

export function resolveBossClear(run) {
  return beginUpgradeChoice(markBossDefeated(run), "major");
}
