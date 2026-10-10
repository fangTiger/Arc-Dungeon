import test from "node:test";
import assert from "node:assert/strict";

import { buildDungeonRoomMap } from "../apps/web/src/core/dungeon/roomMap.js";
import { createRng, hashSeed } from "../apps/web/src/core/rng.js";
import { createRun, enterRoom } from "../apps/web/src/core/run/runState.js";
import { createEmptyBuild } from "../apps/web/src/core/run/upgrades.js";
import {
  ROOM_EVENT_TYPES,
  getRoomEventOptionState,
  rollRoomEvent,
  resolveRoomEvent,
} from "../apps/web/src/core/run/roomEvents.js";

const EVENT_TYPES = Object.freeze(Object.values(ROOM_EVENT_TYPES));

test("同 seed、层数和房间 id 掷出的事件完全一致", () => {
  const first = rollRoomEvent({ seed: "stable-event", depth: 7, roomId: "2,4" });
  const repeated = rollRoomEvent({ seed: "stable-event", depth: 7, roomId: "2,4" });

  assert.deepEqual(repeated, first);
  assert.ok(first.title.length > 0);
  assert.ok(first.description.length > 0);
  assert.ok(first.options.length > 0);
  assert.ok(first.options.every((option) => option.label.length > 0));
});

test("足够多 seed 下三类事件都能掷到", () => {
  const seen = new Set();

  for (let index = 0; index < 160; index += 1) {
    seen.add(rollRoomEvent({ seed: `type-seed-${index}`, depth: 3, roomId: "1,0" }).type);
  }

  assert.deepEqual([...seen].sort(), [...EVENT_TYPES].sort());
});

test("任意事件结算都不写 profile 快照", () => {
  for (const type of EVENT_TYPES) {
    const { event, run } = createRolledRun(type, { tokens: 12 });
    const profile = {
      discordId: "1001",
      tokenBalance: 777,
      skinBoxes: 2,
      ledger: { settledRuns: 4 },
      hero: { classId: "knight", title: "档案哨兵" },
    };
    const beforeProfile = structuredClone(profile);
    const result = resolveRoomEvent({
      run: { ...run, profile },
      player: createPlayer({ hp: 34 }),
      event,
      optionId: event.options[0].id,
      rng: createEventRng(run, event),
    });

    assert.deepEqual(profile, beforeProfile);
    assert.deepEqual(result.run.profile, beforeProfile);
  }
});

test("献祭选项在生命不足时禁用，且任意生命值下不会致死", () => {
  const { event, run } = createRolledRun(ROOM_EVENT_TYPES.SACRIFICE);
  const blocked = getRoomEventOptionState({
    run,
    player: createPlayer({ hp: 1 }),
    event,
    optionId: event.options[0].id,
  });

  assert.equal(blocked.disabled, true);
  assert.match(blocked.disabledReason, /生命不足/);

  for (let hp = 1; hp <= 48; hp += 1) {
    const result = resolveRoomEvent({
      run: { ...run, roomEventsByDepth: {} },
      player: createPlayer({ hp }),
      event,
      optionId: event.options[0].id,
      rng: createEventRng(run, event),
    });

    assert.ok(result.player.hp > 0, `hp=${hp} 时献祭后生命仍必须大于 0`);
  }
});

test("赌博只改本局背包 Token，不改账户余额字段", () => {
  const { event, run } = createRolledRun(ROOM_EVENT_TYPES.GAMBLE, { tokens: 20 });
  const account = { tokenBalance: 999, pendingTokenBalance: 1001 };
  const beforeAccount = structuredClone(account);
  const result = resolveRoomEvent({
    run: { ...run, account },
    player: createPlayer({ hp: 30 }),
    event,
    optionId: event.options[0].id,
    rng: createEventRng(run, event),
  });

  assert.deepEqual(account, beforeAccount);
  assert.deepEqual(result.run.account, beforeAccount);
  assert.notEqual(result.run.bag.tokens, run.bag.tokens);
  assert.equal(result.outcome.tokenDelta, result.run.bag.tokens - run.bag.tokens);
});

test("结算 outcome 包含玩家可见文案与数值变化", () => {
  for (const type of EVENT_TYPES) {
    const { event, run } = createRolledRun(type, { tokens: 18 });
    const result = resolveRoomEvent({
      run,
      player: createPlayer({ hp: 26 }),
      event,
      optionId: event.options[0].id,
      rng: createEventRng(run, event),
    });

    assert.equal(typeof result.outcome.message, "string");
    assert.ok(result.outcome.message.length > 0);
    assert.equal(typeof result.outcome.summary, "string");
    assert.ok(
      Number.isFinite(result.outcome.hpDelta)
        || Number.isFinite(result.outcome.tokenDelta)
        || result.outcome.upgrade
        || result.outcome.buff,
    );
  }
});

test("同一事件房在同一局内只能结算一次", () => {
  const { event, run } = createRolledRun(ROOM_EVENT_TYPES.BLESSING);
  const first = resolveRoomEvent({
    run,
    player: createPlayer({ hp: 18 }),
    event,
    optionId: event.options[0].id,
    rng: createEventRng(run, event),
  });
  const repeated = resolveRoomEvent({
    run: first.run,
    player: first.player,
    event,
    optionId: event.options[0].id,
    rng: createEventRng(run, event),
  });

  assert.equal(repeated.outcome.status, "already-used");
  assert.match(repeated.outcome.message, /已经沉寂/);
  assert.deepEqual(repeated.run, first.run);
  assert.deepEqual(repeated.player, first.player);
});

test("已结算事件房在房间交互上显示沉寂状态", () => {
  const run = createRunWithEventRoom();
  const freshMap = buildDungeonRoomMap({ run });
  const usedRun = {
    ...run,
    roomEventsByDepth: {
      [run.depth]: {
        [run.currentRoomId]: { used: true, type: ROOM_EVENT_TYPES.BLESSING },
      },
    },
  };
  const usedMap = buildDungeonRoomMap({ run: usedRun });

  assert.equal(freshMap.content.feedback.includes("S5"), false);
  assert.equal(usedMap.content.label, "沉寂祭坛");
  assert.equal(usedMap.content.feedback, "祭坛已经沉寂");
  assert.equal(usedMap.content.frameName, "flask_red");
});

function createRolledRun(type, { tokens = 0 } = {}) {
  for (let index = 0; index < 240; index += 1) {
    const seed = `room-event-${type}-${index}`;
    const depth = 4;
    const roomId = "3,1";
    const event = rollRoomEvent({ seed, depth, roomId });

    if (event.type === type) {
      return {
        event,
        run: {
          seed,
          depth,
          currentRoomId: roomId,
          bag: { tokens },
          build: createEmptyBuild(),
          roomEventsByDepth: {},
        },
      };
    }
  }

  throw new Error(`测试未能掷出事件类型：${type}`);
}

function createRunWithEventRoom() {
  for (let index = 0; index < 80; index += 1) {
    const run = createRun({ seed: `event-room-map-${index}`, heroClass: "knight" });
    const room = run.floorPlan.rooms.find((candidate) => candidate.type === "event");
    if (room) {
      return enterRoom(run, room.id);
    }
  }

  throw new Error("测试未能生成事件房");
}

function createPlayer(overrides = {}) {
  return {
    classId: "knight",
    hp: 40,
    maxHp: 48,
    incomingDamageMultiplier: 1,
    movementMultiplier: 1,
    ...overrides,
  };
}

function createEventRng(run, event) {
  return createRng(hashSeed(`${run.seed}:room-event:${run.depth}:${event.roomId}:resolve`));
}
