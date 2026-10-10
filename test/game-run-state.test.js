import test from "node:test";
import assert from "node:assert/strict";

import { generateFloorPlan } from "../apps/web/src/core/dungeon/floorPlan.js";
import {
  cancelPendingUpgradeChoice,
  createRun,
  descend,
  enterRoom,
  explorationRate,
  isRunOver,
  markBossDefeated,
} from "../apps/web/src/core/run/runState.js";

test("descend 后层数加一并回到新层起点房", () => {
  const run = createRun({ seed: "run-descend", heroClass: "knight" });
  const next = descend(run);

  assert.equal(next.depth, run.depth + 1);
  assert.equal(next.currentRoomId, next.floorPlan.startRoomId);
  assert.deepEqual(next.visitedRoomIdsByDepth[next.depth], [next.floorPlan.startRoomId]);
  assert.equal(run.depth, 1);
});

test("createRun 开始新挑战时本局背包为空", () => {
  const run = createRun({ seed: "run-bag-reset", heroClass: "knight" });
  const next = createRun({ seed: "run-bag-reset", heroClass: "knight" });

  assert.deepEqual(run.bag, { tokens: 0 });
  assert.deepEqual(next.bag, { tokens: 0 });
});

test("同一个 run seed 下第 N 层平面图可复现", () => {
  const first = descend(descend(createRun({ seed: "stable-run", heroClass: "mage" })));
  const second = descend(descend(createRun({ seed: "stable-run", heroClass: "mage" })));
  const other = descend(descend(createRun({ seed: "other-run", heroClass: "mage" })));

  assert.deepEqual(second.floorPlan, first.floorPlan);
  assert.notDeepEqual(other.floorPlan.rooms, first.floorPlan.rooms);
});

test("descend 使用确定性的派生 seed 生成新层平面图", () => {
  const run = createRun({ seed: "derived-floor", heroClass: "knight" });
  const next = descend(run);
  const reproduced = generateFloorPlan({ depth: next.depth, seed: next.floorPlan.seed });

  assert.deepEqual(next.floorPlan, reproduced);
});

test("enterRoom 会累计已访问房间且重复进入不重复计数", () => {
  const run = createRun({ seed: "visit-run", heroClass: "knight" });
  const targetRoom = run.floorPlan.rooms.find((room) => room.id !== run.currentRoomId);

  const entered = enterRoom(run, targetRoom.id);
  const repeated = enterRoom(entered, targetRoom.id);

  assert.equal(entered.currentRoomId, targetRoom.id);
  assert.equal(entered.stats.visitedRoomCount, run.stats.visitedRoomCount + 1);
  assert.equal(repeated.stats.visitedRoomCount, entered.stats.visitedRoomCount);
  assert.deepEqual(
    repeated.visitedRoomIdsByDepth[repeated.depth].filter((id) => id === targetRoom.id),
    [targetRoom.id],
  );
});

test("explorationRate 在未访问和全访问边界下正确", () => {
  const run = createRun({ seed: "rate-run", heroClass: "mage" });
  const unvisited = {
    ...run,
    visitedRoomIdsByDepth: { [run.depth]: [] },
    stats: { ...run.stats, visitedRoomCount: 0 },
  };
  const fullyVisited = run.floorPlan.rooms.reduce(
    (current, room) => enterRoom(current, room.id),
    run,
  );

  assert.equal(explorationRate(unvisited), 0);
  assert.equal(explorationRate(fullyVisited), 1);
});

test("markBossDefeated 标记当前 Boss 层并避免重复统计", () => {
  let run = createRun({ seed: "boss-run", heroClass: "knight" });

  while (run.depth < 10) {
    run = descend(run);
  }

  const marked = markBossDefeated(run);
  const repeated = markBossDefeated(marked);

  assert.equal(marked.stats.bossesDefeated, run.stats.bossesDefeated + 1);
  assert.equal(repeated.stats.bossesDefeated, marked.stats.bossesDefeated);
  assert.deepEqual(repeated.defeatedBossDepths, [10]);
});

test("isRunOver 在玩家生命归零时结束 run", () => {
  assert.equal(isRunOver({ player: { hp: 0 } }), true);
  assert.equal(isRunOver({ player: { hp: -4 } }), true);
  assert.equal(isRunOver({ player: { hp: 1 } }), false);
});

test("cancelPendingUpgradeChoice 只关闭当前强化面板", () => {
  const run = createRun({ seed: "cancel-upgrade", heroClass: "knight" });
  const cancelled = cancelPendingUpgradeChoice(run);

  assert.ok(run.build.pendingChoice);
  assert.equal(cancelled.build.pendingChoice, null);
  assert.deepEqual(cancelled.build.upgradeIds, run.build.upgradeIds);
  assert.deepEqual(cancelled.build.completedChoiceKeys, run.build.completedChoiceKeys);
});
