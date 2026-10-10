import { translate } from "../i18n/index.js";

export const ROOM_EVENT_TYPES = Object.freeze({
  SACRIFICE: "sacrifice",
  GAMBLE: "gamble",
  BLESSING: "blessing",
});

export const EVENT_TYPES = Object.freeze([
  ROOM_EVENT_TYPES.SACRIFICE,
  ROOM_EVENT_TYPES.GAMBLE,
  ROOM_EVENT_TYPES.BLESSING,
]);

export const ROOM_EVENT_STATUS = Object.freeze({
  RESOLVED: "resolved",
  BLOCKED: "blocked",
  ALREADY_USED: "already-used",
});

const FLOOR_BUFF_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "ember-guard",
    stat: "incomingDamageMultiplier",
    multiplier: 0.94,
  }),
  Object.freeze({
    id: "swift-pulse",
    stat: "movementMultiplier",
    multiplier: 1.06,
  }),
]);

export const FLOOR_BUFFS = getFloorBuffs();

const SACRIFICE_OPTIONS = freezeOptions([
  {
    id: "minor",
    labelKey: "event.sacrifice.option.minor",
    hpRate: 0.2,
    upgradeCount: 1,
    unavailableReasonKey: "event.sacrifice.unavailable",
  },
  {
    id: "major",
    labelKey: "event.sacrifice.option.major",
    hpRate: 0.45,
    upgradeCount: 2,
    unavailableReasonKey: "event.sacrifice.unavailable",
  },
]);

const GAMBLE_OPTIONS = freezeOptions([
  {
    id: "steady",
    labelKey: "event.gamble.option.steady",
    stakeRate: 0.25,
    winRate: 0.6,
    payoutMultiplier: 2,
    unavailableReasonKey: "event.gamble.unavailable",
  },
  {
    id: "reckless",
    labelKey: "event.gamble.option.reckless",
    stakeRate: 0.5,
    winRate: 0.4,
    payoutMultiplier: 3,
    unavailableReasonKey: "event.gamble.unavailable",
  },
]);

const BLESSING_OPTIONS = freezeOptions([
  {
    id: "heal",
    labelKey: "event.blessing.option.heal",
    effect: "heal",
    healRate: 0.16,
    minHeal: 4,
  },
  {
    id: "ward",
    labelKey: "event.blessing.option.ward",
    effect: "ward",
  },
]);

export function createRoomEventTemplate(type, t = translate) {
  if (type === ROOM_EVENT_TYPES.SACRIFICE) {
    return {
      type,
      title: t("event.sacrifice.title"),
      description: t("event.sacrifice.description"),
      options: localizeOptions(SACRIFICE_OPTIONS, t),
    };
  }

  if (type === ROOM_EVENT_TYPES.GAMBLE) {
    return {
      type,
      title: t("event.gamble.title"),
      description: t("event.gamble.description"),
      options: localizeOptions(GAMBLE_OPTIONS, t),
    };
  }

  return {
    type,
    title: t("event.blessing.title"),
    description: t("event.blessing.description"),
    options: localizeOptions(BLESSING_OPTIONS, t),
  };
}

export function getFloorBuffs(t = translate) {
  return Object.freeze(FLOOR_BUFF_DEFINITIONS.map((buff) => Object.freeze({
    ...buff,
    name: t(`floorBuff.${buff.id}.name`),
    description: t(`floorBuff.${buff.id}.description`),
  })));
}

export function freezeEvent(event) {
  return Object.freeze({
    ...event,
    options: Object.freeze(event.options.map((option) => Object.freeze({ ...option }))),
  });
}

function freezeOptions(options) {
  return Object.freeze(options.map((option) => Object.freeze({ ...option })));
}

function localizeOptions(options, t) {
  return freezeOptions(options.map(({ labelKey, unavailableReasonKey, ...option }) => ({
    ...option,
    label: t(labelKey),
    ...(unavailableReasonKey ? { unavailableReason: t(unavailableReasonKey) } : {}),
  })));
}
