import test from "node:test";
import assert from "node:assert/strict";

import {
  CLASS_SKILLS,
  createSkillCooldownState,
  getSkillCooldownProgress,
  getSkillById,
  getSkillsForClass,
  resolveSkillCooldownMs,
  useSkill,
} from "../apps/web/src/core/combat/skills.js";

const EXPECTED_SKILLS = Object.freeze({
  knight: Object.freeze(["圆斩", "冲锋", "盾击", "战吼"]),
  wizzard: Object.freeze(["火球", "冰环", "闪现", "奥术涌动"]),
});

test("两职业各有 4 个唯一技能且冷却为正", () => {
  const allIds = [];

  for (const [classId, expectedNames] of Object.entries(EXPECTED_SKILLS)) {
    const skills = getSkillsForClass(classId);

    assert.equal(skills.length, 4);
    assert.deepEqual(skills.map((skill) => skill.name), expectedNames);

    for (const skill of skills) {
      assert.equal(skill.classId, classId);
      assert.equal(Number.isFinite(skill.cooldownMs), true);
      assert.ok(skill.cooldownMs > 0);
      allIds.push(skill.id);
    }
  }

  assert.equal(new Set(allIds).size, allIds.length);
  assert.equal(Object.keys(CLASS_SKILLS).length, 2);
});

test("技能冷却期内不可再次释放且每个技能独立计时", () => {
  const state = createSkillCooldownState();
  const first = useSkill(state, "knight-circular-slash", {
    now: 1000,
    build: { cooldownMultiplier: 1 },
  });
  const blocked = useSkill(first.state, "knight-circular-slash", {
    now: 6999,
    build: { cooldownMultiplier: 1 },
  });
  const otherSkill = useSkill(first.state, "knight-charge", {
    now: 1200,
    build: { cooldownMultiplier: 1 },
  });

  assert.equal(first.activated, true);
  assert.equal(first.readyAt, 7000);
  assert.equal(blocked.activated, false);
  assert.deepEqual(blocked.state, first.state);
  assert.equal(otherSkill.activated, true);
});

test("cooldownMultiplier 会影响所有职业技能", () => {
  for (const skill of [...getSkillsForClass("knight"), ...getSkillsForClass("wizzard")]) {
    const cooldown = resolveSkillCooldownMs(skill.id, {
      bonuses: { cooldownMultiplier: 0.5 },
    });
    const used = useSkill(createSkillCooldownState(), skill.id, {
      now: 2000,
      build: { bonuses: { cooldownMultiplier: 0.5 } },
    });

    assert.equal(cooldown, Math.round(skill.cooldownMs * 0.5));
    assert.equal(used.readyAt, 2000 + cooldown);
  }
});

test("技能释放只需要冷却状态，不读取经济资源", () => {
  const skill = getSkillById("wizzard-fireball");
  const used = useSkill(createSkillCooldownState(), skill.id, {
    now: 4000,
    build: { cooldownMultiplier: 1 },
  });

  assert.equal(used.activated, true);
  assert.equal(used.skill.id, skill.id);
});

test("技能冷却会随注入的实际时间推进恢复", () => {
  const used = useSkill(createSkillCooldownState(), "knight-charge", {
    now: 1000,
    build: { cooldownMultiplier: 0.5 },
  });

  const early = getSkillCooldownProgress(used.state, "knight-charge", 3000);
  const ready = getSkillCooldownProgress(used.state, "knight-charge", 5000);

  assert.equal(used.readyAt, 5000);
  assert.equal(early.ready, false);
  assert.equal(early.remainingMs, 2000);
  assert.equal(early.progress, 0.5);
  assert.equal(ready.ready, true);
  assert.equal(ready.remainingMs, 0);
  assert.equal(ready.progress, 1);
});
