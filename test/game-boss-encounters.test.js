import test from "node:test";
import assert from "node:assert/strict";

import { createBossForDepth } from "../apps/web/src/core/combat/bosses.js";
import { isBossFloor } from "../apps/web/src/core/dungeon/progression.js";

test("Boss 层改为每 5 层，非 Boss 早期层保持普通层", () => {
  for (const depth of [5, 10, 15, 20]) {
    assert.equal(isBossFloor(depth), true, `第 ${depth} 层应为 Boss 层`);
  }

  for (const depth of [1, 2, 3, 4, 6, 7, 8, 9]) {
    assert.equal(isBossFloor(depth), false, `第 ${depth} 层不应为 Boss 层`);
  }
});

test("Boss 按 5/10/15 层使用指定名字且 20 层后循环", () => {
  assert.equal(createBossForDepth({ seed: "boss-name", depth: 5 }).name, "KingJ");
  assert.equal(createBossForDepth({ seed: "boss-name", depth: 10 }).name, "Eric");
  assert.equal(createBossForDepth({ seed: "boss-name", depth: 15 }).name, "youzi");
  assert.equal(createBossForDepth({ seed: "boss-name", depth: 20 }).name, "KingJ");
  assert.equal(createBossForDepth({ seed: "boss-name", depth: 25 }).name, "Eric");
});

test("Boss 随机属性、技能、难度和 sprite 在同 seed 同层完全复现", () => {
  const first = createBossForDepth({ seed: "repeatable-boss", depth: 15 });
  const second = createBossForDepth({ seed: "repeatable-boss", depth: 15 });
  const other = createBossForDepth({ seed: "other-boss", depth: 15 });

  assert.deepEqual(second, first);
  assert.notDeepEqual(other, first);
});

test("Boss 生命与伤害随层数增长且使用指定大体型怪前缀", () => {
  const early = createBossForDepth({ seed: "scaling-boss", depth: 5 });
  const late = createBossForDepth({ seed: "scaling-boss", depth: 15 });
  const allowedPrefixes = new Set(["big_demon", "big_zombie", "ogre", "necromancer"]);

  assert.equal(late.maxHp >= early.maxHp, true);
  assert.equal(late.damage >= early.damage, true);
  assert.equal(allowedPrefixes.has(early.spritePrefix), true);
  assert.equal(allowedPrefixes.has(late.spritePrefix), true);
  assert.ok(early.skills.length >= 2);
  assert.equal(new Set(early.skills).size, early.skills.length);
});
