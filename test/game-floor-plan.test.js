import test from "node:test";
import assert from "node:assert/strict";

import {
  difficultyForDepth,
  isBossFloor,
  roomCountForDepth,
} from "../apps/web/src/core/dungeon/progression.js";
import { generateFloorPlan } from "../apps/web/src/core/dungeon/floorPlan.js";

const DIRECTIONS = [
  { name: "north", opposite: "south", dx: 0, dy: -1 },
  { name: "south", opposite: "north", dx: 0, dy: 1 },
  { name: "east", opposite: "west", dx: 1, dy: 0 },
  { name: "west", opposite: "east", dx: -1, dy: 0 },
];

test("层数进度曲线按规格判定 Boss 层、房间数量和难度倍率", () => {
  assert.equal(isBossFloor(0), false);
  assert.equal(isBossFloor(4), false);
  assert.equal(isBossFloor(5), true);
  assert.equal(isBossFloor(10), true);
  assert.equal(roomCountForDepth(1), 7);
  assert.equal(roomCountForDepth(3), 8);
  assert.equal(roomCountForDepth(30), 12);
  assert.equal(roomCountForDepth(99), 12);

  let previous = difficultyForDepth(1);
  assert.ok(previous.enemyHpScale >= 1);
  assert.ok(previous.enemyHpScale <= 1.05);
  assert.ok(previous.enemyDamageScale >= 1);
  assert.ok(previous.enemyDamageScale <= 1.05);
  assert.ok(previous.rewardScale >= 1);
  assert.ok(previous.rewardScale <= 1.05);

  for (let depth = 2; depth <= 60; depth += 1) {
    const current = difficultyForDepth(depth);

    assert.ok(current.enemyHpScale >= previous.enemyHpScale);
    assert.ok(current.enemyDamageScale >= previous.enemyDamageScale);
    assert.ok(current.rewardScale >= previous.rewardScale);
    previous = current;
  }
});

test("同 seed 同 depth 两次生成的地牢平面图完全一致", () => {
  const first = generateFloorPlan({ depth: 7, seed: "repeatable-floor" });
  const second = generateFloorPlan({ depth: 7, seed: "repeatable-floor" });

  assert.deepEqual(second, first);
});

test("不同 seed 会生成不同的地牢平面图", () => {
  const first = generateFloorPlan({ depth: 8, seed: "floor-seed-a" });
  const second = generateFloorPlan({ depth: 8, seed: "floor-seed-b" });

  assert.notDeepEqual(second.rooms, first.rooms);
});

test("房间数等于当前层数曲线给出的数量", () => {
  for (const depth of [1, 2, 3, 9, 10, 18, 30, 45]) {
    const plan = generateFloorPlan({ depth, seed: `count-${depth}` });

    assert.equal(plan.rooms.length, roomCountForDepth(depth));
  }
});

test("所有房间都能从起点通过门连接到达", () => {
  const plan = generateFloorPlan({ depth: 12, seed: "connected-floor" });

  assert.equal(collectReachableRoomIds(plan).size, plan.rooms.length);
});

test("普通层恰好有一个楼梯房且起点和楼梯不是同一间", () => {
  const plan = generateFloorPlan({ depth: 6, seed: "stairs-floor" });
  const stairsRooms = plan.rooms.filter((room) => room.type === "stairs");
  const stairsRoom = plan.rooms.find((room) => room.id === plan.stairsRoomId);

  assert.equal(stairsRooms.length, 1);
  assert.ok(stairsRoom);
  assert.equal(stairsRoom.type, "stairs");
  assert.notEqual(plan.startRoomId, plan.stairsRoomId);
});

test("门的存在与相邻房间严格对称", () => {
  const plan = generateFloorPlan({ depth: 14, seed: "door-symmetry" });

  assertDoorSymmetry(plan);
});

test("Boss 层会把最远出口标记为 boss，普通层没有 bossRoomId", () => {
  for (const depth of [5, 10]) {
    const plan = generateFloorPlan({ depth, seed: `boss-${depth}` });
    const bossRoom = plan.rooms.find((room) => room.id === plan.bossRoomId);

    assert.ok(plan.bossRoomId);
    assert.equal(plan.stairsRoomId, plan.bossRoomId);
    assert.equal(bossRoom.type, "boss");
    assert.equal(plan.rooms.filter((room) => room.type === "boss").length, 1);
  }

  const normalPlan = generateFloorPlan({ depth: 6, seed: "not-boss" });

  assert.equal(normalPlan.bossRoomId, null);
  assert.equal(normalPlan.rooms.some((room) => room.type === "boss"), false);
});

test("depth 1 到 30 的批量生成都满足结构约束", () => {
  for (let depth = 1; depth <= 30; depth += 1) {
    const plan = generateFloorPlan({ depth, seed: `bulk-${depth}` });

    assertFloorPlanStructure(plan);
  }
});

test("depth 1 到 30 的每层平面图至少有 3 个死端房", () => {
  for (let depth = 1; depth <= 30; depth += 1) {
    const plan = generateFloorPlan({ depth, seed: `shape-${depth}` });

    assert.equal(countDeadEndRooms(plan) >= 3, true);
  }
});

test("depth 10 的特殊房覆盖率至少 90% 同时包含宝箱房和事件房", () => {
  let coveredPlanCount = 0;
  const sampleCount = 50;

  for (let index = 0; index < sampleCount; index += 1) {
    const plan = generateFloorPlan({ depth: 10, seed: `special-coverage-${index}` });
    const roomTypes = new Set(plan.rooms.map((room) => room.type));

    if (roomTypes.has("treasure") && roomTypes.has("event")) {
      coveredPlanCount += 1;
    }
  }

  assert.equal(coveredPlanCount / sampleCount >= 0.9, true);
});

function assertFloorPlanStructure(plan) {
  assert.equal(plan.depth >= 1, true);
  assert.deepEqual(plan.grid, { width: 9, height: 8 });
  assert.equal(plan.rooms.length, roomCountForDepth(plan.depth));
  assert.equal(new Set(plan.rooms.map((room) => room.id)).size, plan.rooms.length);
  assert.equal(collectReachableRoomIds(plan).size, plan.rooms.length);

  const startRoom = plan.rooms.find((room) => room.id === plan.startRoomId);
  const stairsRoom = plan.rooms.find((room) => room.id === plan.stairsRoomId);

  assert.ok(startRoom);
  assert.ok(stairsRoom);
  assert.equal(startRoom.type, "start");
  assert.notEqual(plan.startRoomId, plan.stairsRoomId);

  if (isBossFloor(plan.depth)) {
    const bossRoom = plan.rooms.find((room) => room.id === plan.bossRoomId);

    assert.ok(bossRoom);
    assert.equal(plan.stairsRoomId, plan.bossRoomId);
    assert.equal(bossRoom.type, "boss");
    assert.equal(plan.rooms.filter((room) => room.type === "boss").length, 1);
    assert.equal(plan.rooms.filter((room) => room.type === "stairs").length, 0);
  } else {
    assert.equal(plan.bossRoomId, null);
    assert.equal(plan.rooms.filter((room) => room.type === "stairs").length, 1);
    assert.equal(stairsRoom.type, "stairs");
  }

  assertDoorSymmetry(plan);
}

function countDeadEndRooms(plan) {
  return plan.rooms.filter(
    (room) => DIRECTIONS.filter((direction) => room.doors[direction.name]).length === 1,
  ).length;
}

function assertDoorSymmetry(plan) {
  const byCoordinate = new Map(plan.rooms.map((room) => [toKey(room.gx, room.gy), room]));

  for (const room of plan.rooms) {
    assert.equal(room.gx >= 0 && room.gx < plan.grid.width, true);
    assert.equal(room.gy >= 0 && room.gy < plan.grid.height, true);

    for (const direction of DIRECTIONS) {
      const neighbor = byCoordinate.get(toKey(room.gx + direction.dx, room.gy + direction.dy));
      const hasDoor = room.doors[direction.name];

      assert.equal(typeof hasDoor, "boolean");
      assert.equal(hasDoor, Boolean(neighbor));

      if (neighbor) {
        assert.equal(neighbor.doors[direction.opposite], true);
      }
    }
  }
}

function collectReachableRoomIds(plan) {
  const byId = new Map(plan.rooms.map((room) => [room.id, room]));
  const byCoordinate = new Map(plan.rooms.map((room) => [toKey(room.gx, room.gy), room]));
  const visited = new Set([plan.startRoomId]);
  const queue = [plan.startRoomId];

  while (queue.length > 0) {
    const room = byId.get(queue.shift());

    for (const direction of DIRECTIONS) {
      if (!room.doors[direction.name]) {
        continue;
      }

      const neighbor = byCoordinate.get(toKey(room.gx + direction.dx, room.gy + direction.dy));

      if (neighbor && !visited.has(neighbor.id)) {
        visited.add(neighbor.id);
        queue.push(neighbor.id);
      }
    }
  }

  return visited;
}

function toKey(gx, gy) {
  return `${gx},${gy}`;
}
