import { createRng, hashSeed } from "../rng.js";
import { translate } from "../i18n/index.js";
import { applyUpgradeChoice, MINOR_UPGRADES } from "./upgrades.js";
import { EVENT_TYPES, ROOM_EVENT_STATUS, ROOM_EVENT_TYPES, createRoomEventTemplate, freezeEvent, getFloorBuffs } from "./roomEventDefinitions.js";
export { ROOM_EVENT_TYPES } from "./roomEventDefinitions.js";

export function createRoomEventRng({ seed, depth, roomId, phase = "resolve" }) {
  return createRng(hashSeed(`${seed}:room-event:${depth}:${roomId}:${phase}`));
}

export function rollRoomEvent({ seed, depth, roomId }, t = translate) {
  const rng = createRoomEventRng({ seed, depth, roomId, phase: "roll" });
  const type = EVENT_TYPES[rng.int(0, EVENT_TYPES.length)];

  return freezeEvent({
    depth,
    roomId,
    ...createRoomEventTemplate(type, t),
  });
}

export function getRoomEventOptionState({ run, player, event, optionId }, t = translate) {
  const option = findOption(event, optionId);

  if (!option) {
    return { disabled: true, disabledReason: t("event.state.unknownOption") };
  }

  if (isRoomEventUsed(run, event)) {
    return { option, disabled: true, disabledReason: t("event.state.alreadyUsed") };
  }

  if (event.type === ROOM_EVENT_TYPES.SACRIFICE) {
    const hpCost = sacrificeHpCost(player, option.hpRate);
    if (!canPaySacrifice(player, hpCost)) {
      return { option, disabled: true, disabledReason: option.unavailableReason, hpCost };
    }
    return { option, disabled: false, hpCost };
  }

  if (event.type === ROOM_EVENT_TYPES.GAMBLE) {
    const stake = gambleStake(run, option.stakeRate);
    if (stake <= 0) {
      return { option, disabled: true, disabledReason: option.unavailableReason, stake };
    }
    return { option, disabled: false, stake };
  }

  return { option, disabled: false };
}

export function resolveRoomEvent({ run, player, event, optionId, rng, t = translate }) {
  const optionState = getRoomEventOptionState({ run, player, event, optionId }, t);

  if (optionState.disabled) {
    return { run, player, outcome: blockedOutcome(event, optionState, t) };
  }

  assertRng(rng);

  if (event.type === ROOM_EVENT_TYPES.SACRIFICE) {
    return resolveSacrifice({ run, player, event, rng, option: optionState.option, hpCost: optionState.hpCost, t });
  }

  if (event.type === ROOM_EVENT_TYPES.GAMBLE) {
    return resolveGamble({ run, player, event, rng, option: optionState.option, stake: optionState.stake, t });
  }

  if (event.type === ROOM_EVENT_TYPES.BLESSING) {
    return resolveBlessing({ run, player, event, rng, option: optionState.option, t });
  }

  throw new RangeError("未知房间事件类型");
}

export function applyRoomEventBuffsToPlayer(player, run) {
  const buffs = activeFloorBuffs(run);
  let nextPlayer = { ...player, roomEventBuffs: buffs.map((buff) => freezeBuff(buff)) };

  for (const buff of buffs) {
    nextPlayer = {
      ...nextPlayer,
      [buff.stat]: roundMultiplier((nextPlayer[buff.stat] ?? 1) * buff.multiplier),
    };
  }

  return nextPlayer;
}

function resolveSacrifice({ run, player, event, rng, option, hpCost, t }) {
  let upgradedRun = run;
  const upgrades = [];

  for (let index = 0; index < option.upgradeCount; index += 1) {
    const upgrade = rollMinorUpgrade(upgradedRun, rng);
    upgradedRun = applyUpgradeChoice(upgradedRun, upgrade.id);
    upgrades.push(publicUpgrade(upgrade, t));
  }

  const nextPlayer = { ...player, hp: Math.max(1, normalizePositiveHp(player.hp) - hpCost) };
  const upgradeNames = upgrades.map((upgrade) => upgrade.name).join(t("common.listSeparator"));
  const outcome = {
    status: ROOM_EVENT_STATUS.RESOLVED,
    type: event.type,
    title: event.title,
    summary: t("event.outcome.sacrifice.summary", { hpCost, upgrades: upgradeNames }),
    message: t("event.outcome.sacrifice.message", { option: option.label, hpCost, upgrades: upgradeNames }),
    hpDelta: -hpCost,
    upgrade: upgrades[0],
    upgrades: Object.freeze(upgrades),
  };

  return { run: markRoomEventUsed(upgradedRun, event, outcome), player: nextPlayer, outcome };
}

function resolveGamble({ run, player, event, rng, option, stake, t }) {
  const tokensBefore = normalizeTokenCount(run?.bag?.tokens);
  const won = rng.next() < option.winRate;
  const payout = won ? stake * option.payoutMultiplier : 0;
  const tokensAfter = Math.max(0, tokensBefore - stake + payout);
  const tokenDelta = tokensAfter - tokensBefore;
  const tokenChange = `${tokensBefore} → ${tokensAfter}`;
  const outcome = {
    status: ROOM_EVENT_STATUS.RESOLVED,
    type: event.type,
    title: event.title,
    summary: t(
      won ? "event.outcome.gamble.win.summary" : "event.outcome.gamble.loss.summary",
      { stake, payout, change: tokenChange },
    ),
    message: t(
      won ? "event.outcome.gamble.win.message" : "event.outcome.gamble.loss.message",
      { option: option.label, change: tokenChange, delta: tokenDelta },
    ),
    tokenDelta,
    stake,
    payout,
    won,
  };
  const nextRun = {
    ...run,
    bag: {
      ...(run.bag ?? {}),
      tokens: tokensAfter,
    },
  };

  return { run: markRoomEventUsed(nextRun, event, outcome), player, outcome };
}

function resolveBlessing({ run, player, event, rng, option, t }) {
  const hp = normalizeHp(player.hp);
  const maxHp = Math.max(1, normalizeHp(player.maxHp) || hp || 1);

  if (option.effect === "heal") {
    const healAmount = Math.max(option.minHeal, Math.ceil(maxHp * option.healRate));
    const nextHp = Math.min(maxHp, hp + healAmount);
    const healed = nextHp - hp;
    const outcome = {
      status: ROOM_EVENT_STATUS.RESOLVED,
      type: event.type,
      title: event.title,
      summary: t("event.outcome.heal.summary", { healed }),
      message: t("event.outcome.heal.message", { healed, before: hp, after: nextHp }),
      hpDelta: healed,
    };

    return { run: markRoomEventUsed(run, event, outcome), player: { ...player, hp: nextHp }, outcome };
  }

  if (option.effect !== "ward") {
    throw new RangeError("未知祝福选项效果");
  }

  const buff = { ...rng.pick(getFloorBuffs(t)), depth: eventDepth(run, event) };
  const buffedRun = addFloorBuff(run, buff);
  const outcome = {
    status: ROOM_EVENT_STATUS.RESOLVED,
    type: event.type,
    title: event.title,
    summary: buff.description,
    message: t("event.outcome.ward.message", { name: buff.name, description: buff.description }),
    buff: freezeBuff(buff),
  };

  return { run: markRoomEventUsed(buffedRun, event, outcome), player: applyRoomEventBuffsToPlayer(player, buffedRun), outcome };
}

function blockedOutcome(event, optionState, t) {
  const alreadyUsed = optionState.disabledReason === t("event.state.alreadyUsed");
  return {
    status: alreadyUsed ? ROOM_EVENT_STATUS.ALREADY_USED : ROOM_EVENT_STATUS.BLOCKED,
    type: event?.type,
    title: event?.title ?? t("event.state.silentTitle"),
    summary: optionState.disabledReason,
    message: alreadyUsed ? t("event.state.alreadyUsed") : optionState.disabledReason,
  };
}

function rollMinorUpgrade(run, rng) {
  const owned = new Set(run?.build?.upgradeIds ?? []);
  const candidates = MINOR_UPGRADES.filter((upgrade) => !owned.has(upgrade.id));
  const pool = candidates.length > 0 ? candidates : MINOR_UPGRADES;
  return pool[rng.int(0, pool.length)];
}

function markRoomEventUsed(run, event, outcome) {
  const depth = eventDepth(run, event);
  const roomId = eventRoomId(run, event);
  return {
    ...run,
    roomEventsByDepth: {
      ...(run.roomEventsByDepth ?? {}),
      [depth]: {
        ...(run.roomEventsByDepth?.[depth] ?? {}),
        [roomId]: {
          used: true,
          type: event.type,
          summary: outcome.summary,
        },
      },
    },
  };
}

function addFloorBuff(run, buff) {
  const depth = buff.depth;
  return {
    ...run,
    roomEventBuffsByDepth: {
      ...(run.roomEventBuffsByDepth ?? {}),
      [depth]: [...(run.roomEventBuffsByDepth?.[depth] ?? []), freezeBuff(buff)],
    },
  };
}

function isRoomEventUsed(run, event) {
  return Boolean(run?.roomEventsByDepth?.[eventDepth(run, event)]?.[eventRoomId(run, event)]?.used);
}
function activeFloorBuffs(run) {
  return run?.roomEventBuffsByDepth?.[run.depth] ?? [];
}

function freezeBuff(buff) {
  return Object.freeze({ ...buff });
}

function publicUpgrade(upgrade, t) {
  return Object.freeze({
    id: upgrade.id,
    name: t(`upgrade.${upgrade.id}.name`),
    description: t(`upgrade.${upgrade.id}.description`),
  });
}

function findOption(event, optionId) {
  return event?.options?.find((option) => option.id === optionId) ?? null;
}

function sacrificeHpCost(player, hpRate) {
  return Math.max(1, Math.ceil(normalizePositiveHp(player?.hp) * hpRate));
}

function canPaySacrifice(player, hpCost) {
  return normalizePositiveHp(player?.hp) - hpCost >= 1;
}

function gambleStake(run, stakeRate) {
  return Math.floor(normalizeTokenCount(run?.bag?.tokens) * stakeRate);
}

function eventDepth(run, event) {
  return event?.depth ?? run?.depth ?? 1;
}

function eventRoomId(run, event) {
  return event?.roomId ?? run?.currentRoomId ?? "unknown";
}

function normalizeTokenCount(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizePositiveHp(value) {
  return Math.max(1, normalizeHp(value));
}

function normalizeHp(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function roundMultiplier(value) {
  return Math.round(value * 1000) / 1000;
}

function assertRng(rng) {
  if (!rng || typeof rng.next !== "function" || typeof rng.int !== "function" || typeof rng.pick !== "function") {
    throw new TypeError("房间事件结算必须传入可复现 rng");
  }
}
