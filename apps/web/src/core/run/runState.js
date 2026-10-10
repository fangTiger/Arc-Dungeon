import { generateFloorPlan } from "../dungeon/floorPlan.js";
import { isBossFloor } from "../dungeon/progression.js";
import { hashSeed } from "../rng.js";
import { createRunBag } from "./runBag.js";
import {
  applyUpgradeChoice,
  createEmptyBuild,
  rollUpgradeChoices,
  UPGRADE_TRIGGERS,
} from "./upgrades.js";

export function createRun({ seed, heroClass, heroIdentity = null }) {
  const depth = 1;
  const floorPlan = generateFloorPlan({ depth, seed: deriveFloorSeed(seed, depth) });

  const run = {
    seed,
    heroClass,
    heroIdentity,
    depth,
    floorPlan,
    currentRoomId: floorPlan.startRoomId,
    visitedRoomIdsByDepth: {
      [depth]: [floorPlan.startRoomId],
    },
    clearedCombatRoomIdsByDepth: {
      [depth]: [],
    },
    defeatedBossDepths: [],
    bag: createRunBag(),
    build: createEmptyBuild(),
    stats: {
      bossesDefeated: 0,
      visitedRoomCount: 1,
      totalRoomCount: floorPlan.rooms.length,
    },
  };

  return beginUpgradeChoice(run, UPGRADE_TRIGGERS.EMBARK);
}

export function enterRoom(run, roomId) {
  assertRoomExists(run.floorPlan, roomId);

  const visitedRooms = run.visitedRoomIdsByDepth[run.depth] ?? [];
  const isFirstVisit = !visitedRooms.includes(roomId);
  const nextVisitedRooms = isFirstVisit ? [...visitedRooms, roomId] : visitedRooms;

  return {
    ...run,
    currentRoomId: roomId,
    visitedRoomIdsByDepth: {
      ...run.visitedRoomIdsByDepth,
      [run.depth]: nextVisitedRooms,
    },
    stats: {
      ...run.stats,
      visitedRoomCount: run.stats.visitedRoomCount + (isFirstVisit ? 1 : 0),
    },
  };
}

export function descend(run) {
  const depth = run.depth + 1;
  const floorPlan = generateFloorPlan({ depth, seed: deriveFloorSeed(run.seed, depth) });

  return {
    ...run,
    depth,
    floorPlan,
    currentRoomId: floorPlan.startRoomId,
    visitedRoomIdsByDepth: {
      ...run.visitedRoomIdsByDepth,
      [depth]: [floorPlan.startRoomId],
    },
    clearedCombatRoomIdsByDepth: {
      ...run.clearedCombatRoomIdsByDepth,
      [depth]: [],
    },
    stats: {
      ...run.stats,
      visitedRoomCount: run.stats.visitedRoomCount + 1,
      totalRoomCount: run.stats.totalRoomCount + floorPlan.rooms.length,
    },
  };
}

export function explorationRate(run) {
  if (run.stats.totalRoomCount <= 0) {
    return 0;
  }

  return clamp01(run.stats.visitedRoomCount / run.stats.totalRoomCount);
}

export function isRunOver(run) {
  const hp = run?.player?.hp ?? run?.hp;

  return Number.isFinite(hp) && hp <= 0;
}

export function markBossDefeated(run) {
  if (!isBossFloor(run.depth) || run.defeatedBossDepths.includes(run.depth)) {
    return { ...run };
  }

  return {
    ...run,
    defeatedBossDepths: [...run.defeatedBossDepths, run.depth],
    stats: {
      ...run.stats,
      bossesDefeated: run.stats.bossesDefeated + 1,
    },
  };
}

export function canDescendFromCurrentRoom(run) {
  const room = currentRoom(run);

  if (room.type !== "boss") {
    return room.type === "stairs";
  }

  return run.defeatedBossDepths.includes(run.depth);
}

export function beginUpgradeChoice(run, trigger) {
  const build = run.build ?? createEmptyBuild();

  if (build.pendingChoice) {
    return run;
  }

  const choiceIndex = build.completedChoiceKeys.length;
  const key = `${run.depth}:${trigger}:${choiceIndex}`;
  if (build.completedChoiceKeys.includes(key)) {
    return run;
  }

  return {
    ...run,
    build: {
      ...build,
      pendingChoice: {
        key,
        trigger,
        depth: run.depth,
        choiceIndex,
        selectedIndex: 0,
        choices: rollUpgradeChoices({
          seed: run.seed,
          depth: run.depth,
          trigger,
          choiceIndex,
          ownedUpgradeIds: build.upgradeIds,
        }),
      },
    },
  };
}

export function movePendingUpgradeSelection(run, direction) {
  const pendingChoice = run.build?.pendingChoice;

  if (!pendingChoice) {
    return run;
  }

  const count = pendingChoice.choices.length;
  const offset = direction < 0 ? -1 : 1;
  const selectedIndex = (pendingChoice.selectedIndex + offset + count) % count;

  return {
    ...run,
    build: {
      ...run.build,
      pendingChoice: {
        ...pendingChoice,
        selectedIndex,
      },
    },
  };
}

export function choosePendingUpgrade(run, upgradeId) {
  const pendingChoice = run.build?.pendingChoice;

  if (!pendingChoice) {
    return run;
  }

  if (!pendingChoice.choices.some((choice) => choice.id === upgradeId)) {
    throw new RangeError("选择的强化不在当前三选一中");
  }

  const upgraded = applyUpgradeChoice(run, upgradeId);

  return {
    ...upgraded,
    build: {
      ...upgraded.build,
      pendingChoice: null,
      completedChoiceKeys: [...upgraded.build.completedChoiceKeys, pendingChoice.key],
    },
  };
}

export function cancelPendingUpgradeChoice(run) {
  const pendingChoice = run.build?.pendingChoice;

  if (!pendingChoice) {
    return run;
  }

  return {
    ...run,
    build: {
      ...run.build,
      pendingChoice: null,
    },
  };
}

function deriveFloorSeed(seed, depth) {
  return hashSeed(`${seed}:floor:${depth}`);
}

function currentRoom(run) {
  const room = run.floorPlan.rooms.find((candidate) => candidate.id === run.currentRoomId);

  if (!room) {
    throw new RangeError("当前房间不存在于楼层平面图");
  }

  return room;
}

function assertRoomExists(floorPlan, roomId) {
  if (!floorPlan.rooms.some((room) => room.id === roomId)) {
    throw new RangeError("不能进入当前层不存在的房间");
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
