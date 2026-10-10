import { translate } from "./i18n/index.js";

const ITEM_METADATA = Object.freeze({
  "rialo-pass": {
    key: "rialo-pass",
    icon: "R",
    pixelIcon: "rialo-pass",
    rarity: "legendary",
    stackable: false,
  },
  coins: {
    key: "coins",
    icon: "G",
    pixelIcon: "coin-pouch",
    rarity: "common",
    stackable: true,
  },
  materials: {
    key: "materials",
    icon: "M",
    pixelIcon: "building-materials",
    rarity: "uncommon",
    stackable: true,
  },
  "slime-gel": {
    key: "slime-gel",
    icon: "S",
    pixelIcon: "slime-gel",
    rarity: "common",
    stackable: true,
  },
  "goblin-crest": {
    key: "goblin-crest",
    icon: "C",
    pixelIcon: "goblin-crest",
    rarity: "rare",
    stackable: true,
  },
});

const EQUIPMENT_METADATA = Object.freeze({
  "iron-sword": {
    itemKey: "iron-sword",
    slot: "weapon",
    icon: "I",
    pixelIcon: "iron-sword",
    rarity: "uncommon",
  },
  "knight-helmet": {
    itemKey: "knight-helmet",
    slot: "helmet",
    icon: "H",
    pixelIcon: "knight-helmet",
    rarity: "uncommon",
  },
  "bronze-chestplate": {
    itemKey: "bronze-chestplate",
    slot: "chestplate",
    icon: "B",
    pixelIcon: "bronze-chestplate",
    rarity: "common",
  },
  "bronze-legplates": {
    itemKey: "bronze-legplates",
    slot: "legplates",
    icon: "L",
    pixelIcon: "bronze-legplates",
    rarity: "common",
  },
});

export const itemDefinitions = createItemDefinitions();
export const equipmentDefinitions = createEquipmentDefinitions();

export function createItemDefinitions(t = translate) {
  return Object.fromEntries(Object.entries(ITEM_METADATA).map(([key, item]) => [key, {
    ...item,
    name: t(`item.${key}.name`),
    description: t(`item.${key}.description`),
  }]));
}

export function createEquipmentDefinitions(t = translate) {
  return Object.fromEntries(Object.entries(EQUIPMENT_METADATA).map(([key, item]) => [key, {
    ...item,
    name: t(`equipment.${key}.name`),
  }]));
}

export function createStarterInventory(t = translate) {
  return {
    capacity: 12,
    slots: [
      createSlot("rialo-pass", 1, t),
      createSlot("coins", 0, t),
      createSlot("materials", 0, t),
      createSlot("slime-gel", 3, t),
      createSlot("goblin-crest", 1, t),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ],
  };
}

export function createStarterEquipment(t = translate) {
  const definitions = createEquipmentDefinitions(t);
  return [
    definitions["iron-sword"],
    definitions["knight-helmet"],
    definitions["bronze-chestplate"],
    definitions["bronze-legplates"],
  ].map((item) => ({ ...item }));
}

export function addStackableItem(inventory, key, amount, t = translate) {
  const definition = getItemDefinition(key, t);
  const next = cloneInventory(inventory);
  const existingIndex = next.slots.findIndex((slot) => slot?.key === key);

  if (existingIndex >= 0) {
    next.slots[existingIndex] = {
      ...next.slots[existingIndex],
      count: next.slots[existingIndex].count + amount,
    };
    return next;
  }

  const emptyIndex = next.slots.findIndex((slot) => slot === null);
  if (emptyIndex < 0) {
    return next;
  }

  next.slots[emptyIndex] = {
    ...definition,
    count: amount,
  };

  return next;
}

export function getInventorySummary(inventory) {
  const items = inventory.slots
    .filter(Boolean)
    .map((slot, index) => ({
      index,
      ...slot,
    }));

  return {
    capacity: inventory.capacity,
    items,
    emptySlots: inventory.capacity - items.length,
  };
}

function createSlot(key, count, t) {
  return {
    ...getItemDefinition(key, t),
    count,
  };
}

function getItemDefinition(key, t = translate) {
  const definition = createItemDefinitions(t)[key];

  if (!definition) {
    throw new Error(`未知物品: ${key}`);
  }

  return definition;
}

function cloneInventory(inventory) {
  return {
    capacity: inventory.capacity,
    slots: inventory.slots.map((slot) => (slot ? { ...slot } : null)),
  };
}
