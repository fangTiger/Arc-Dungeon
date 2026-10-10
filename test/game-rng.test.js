import test from "node:test";
import assert from "node:assert/strict";

import { createRng, hashSeed } from "../apps/web/src/core/rng.js";

test("同 seed 会产出完全相同的随机序列", () => {
  const left = createRng(hashSeed("s1-demo-room"));
  const right = createRng(hashSeed("s1-demo-room"));

  assert.deepEqual(
    Array.from({ length: 8 }, () => left.next()),
    Array.from({ length: 8 }, () => right.next()),
  );
});

test("不同 seed 会产出不同的随机序列", () => {
  const left = createRng(hashSeed("dungeon-a"));
  const right = createRng(hashSeed("dungeon-b"));

  assert.notDeepEqual(
    Array.from({ length: 8 }, () => left.next()),
    Array.from({ length: 8 }, () => right.next()),
  );
});

test("int 会返回指定半开区间内的整数", () => {
  const rng = createRng(12345);

  for (let index = 0; index < 64; index += 1) {
    const value = rng.int(3, 8);

    assert.equal(Number.isInteger(value), true);
    assert.equal(value >= 3, true);
    assert.equal(value < 8, true);
  }
});

test("shuffle 返回新数组且保留原始元素集合", () => {
  const input = ["floor", "wall", "door", "void", "torch"];
  const shuffled = createRng(99).shuffle(input);

  assert.notEqual(shuffled, input);
  assert.deepEqual(input, ["floor", "wall", "door", "void", "torch"]);
  assert.deepEqual([...shuffled].sort(), [...input].sort());
});
