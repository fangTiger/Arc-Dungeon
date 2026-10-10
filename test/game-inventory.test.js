import test from "node:test";
import assert from "node:assert/strict";

import {
  addStackableItem,
  createStarterEquipment,
  createStarterInventory,
  getInventorySummary,
  itemDefinitions,
} from "../apps/web/src/core/inventory.js";

test("初始物品栏包含固定槽位和可见起始物品", () => {
  const inventory = createStarterInventory();
  const summary = getInventorySummary(inventory);

  assert.equal(summary.capacity, 12);
  assert.ok(summary.items.length >= 5);
  assert.equal(summary.items[0].key, "rialo-pass");
  assert.equal(summary.items[0].name, "ARC 通行证");
});

test("堆叠物品会优先合并到已有槽位", () => {
  const inventory = createStarterInventory();
  const updated = addStackableItem(inventory, "materials", 4);
  const materialSlot = getInventorySummary(updated).items.find(
    (item) => item.key === "materials",
  );

  assert.equal(materialSlot.count, 4);
  assert.equal(getInventorySummary(updated).emptySlots, 7);
});

test("起始装备摘要匹配当前纸娃娃外观", () => {
  const equipment = createStarterEquipment();

  assert.deepEqual(
    equipment.map((slot) => [slot.slot, slot.itemKey]),
    [
      ["weapon", "iron-sword"],
      ["helmet", "knight-helmet"],
      ["chestplate", "bronze-chestplate"],
      ["legplates", "bronze-legplates"],
    ],
  );
});

test("物品定义提供像素图标类型而不是只用字母占位", () => {
  const iconKinds = Object.values(itemDefinitions).map((item) => item.pixelIcon);

  assert.ok(iconKinds.every(Boolean));
  assert.ok(iconKinds.includes("rialo-pass"));
  assert.ok(iconKinds.includes("coin-pouch"));
  assert.ok(iconKinds.includes("building-materials"));
});
