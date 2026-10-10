import test from "node:test";
import assert from "node:assert/strict";

import {
  ATTACK_DODGE_CANCEL_MS,
  DASH_SLASH_DAMAGE_MULTIPLIER,
  DASH_SLASH_WINDOW_MS,
  SKILL_FOLLOW_UP_DAMAGE_MULTIPLIER,
  SKILL_FOLLOW_UP_WINDOW_MS,
  canPerformActionDuringRecovery,
  canDodgeCancelAttack,
  createComboState,
  reduceComboState,
  resolveComboAttack,
} from "../apps/web/src/core/combat/combo.js";

test("冲刺取消在攻击开始 150ms 后开放", () => {
  const attacking = reduceComboState(createComboState(), { type: "attackStarted" }, 1000);

  assert.equal(ATTACK_DODGE_CANCEL_MS, 150);
  assert.equal(canDodgeCancelAttack(attacking, 1149), false);
  assert.equal(canDodgeCancelAttack(attacking, 1150), true);
});

test("冲刺斩在冲刺中或结束后 250ms 内触发 1.6 倍伤害", () => {
  const dodging = reduceComboState(
    createComboState(),
    { type: "dodgeStarted", durationMs: 260 },
    2000,
  );
  const duringDash = resolveComboAttack(dodging, { baseDamage: 10, now: 2100 });
  const edge = resolveComboAttack(dodging, { baseDamage: 10, now: 2510 });
  const expired = resolveComboAttack(dodging, { baseDamage: 10, now: 2511 });

  assert.equal(DASH_SLASH_WINDOW_MS, 250);
  assert.equal(DASH_SLASH_DAMAGE_MULTIPLIER, 1.6);
  assert.equal(duringDash.isDashSlash, true);
  assert.equal(duringDash.damage, 16);
  assert.equal(edge.isDashSlash, true);
  assert.equal(edge.damage, 16);
  assert.equal(expired.isDashSlash, false);
  assert.equal(expired.damage, 10);
});

test("技能命中后 600ms 内普攻获得 1.35 倍接续伤害", () => {
  const afterSkillHit = reduceComboState(createComboState(), { type: "skillHit" }, 3000);
  const inside = resolveComboAttack(afterSkillHit, { baseDamage: 20, now: 3600 });
  const outside = resolveComboAttack(afterSkillHit, { baseDamage: 20, now: 3601 });

  assert.equal(SKILL_FOLLOW_UP_WINDOW_MS, 600);
  assert.equal(SKILL_FOLLOW_UP_DAMAGE_MULTIPLIER, 1.35);
  assert.equal(inside.hasSkillFollowUp, true);
  assert.equal(inside.damage, 27);
  assert.equal(outside.hasSkillFollowUp, false);
  assert.equal(outside.damage, 20);
});

test("连招状态转换只由状态、事件和注入时间决定", () => {
  const state = reduceComboState(createComboState(), { type: "skillHit" }, 5000);
  const event = { type: "dodgeStarted", durationMs: 260 };

  assert.deepEqual(
    reduceComboState(state, event, 5200),
    reduceComboState(state, event, 5200),
  );
});

test("攻击后摇只允许开放后的冲刺取消或冲刺斩攻击", () => {
  const attacking = reduceComboState(createComboState(), { type: "attackStarted" }, 1000);
  const dodging = reduceComboState(attacking, { type: "dodgeStarted", durationMs: 260 }, 1150);

  assert.equal(
    canPerformActionDuringRecovery(attacking, {
      action: "skill",
      attackRecoveryUntil: 1400,
      now: 1090,
    }),
    false,
  );
  assert.equal(
    canPerformActionDuringRecovery(attacking, {
      action: "dodge",
      attackRecoveryUntil: 1400,
      now: 1149,
    }),
    false,
  );
  assert.equal(
    canPerformActionDuringRecovery(attacking, {
      action: "dodge",
      attackRecoveryUntil: 1400,
      now: 1150,
    }),
    true,
  );
  assert.equal(
    canPerformActionDuringRecovery(dodging, {
      action: "attack",
      attackRecoveryUntil: 1400,
      now: 1200,
    }),
    true,
  );
});

test("冲刺斩触发后会消费本次冲刺窗口", () => {
  const dodging = reduceComboState(
    createComboState(),
    { type: "dodgeStarted", durationMs: 260 },
    2000,
  );
  const consumed = reduceComboState(dodging, { type: "dashSlashConsumed" }, 2100);
  const nextDodge = reduceComboState(consumed, { type: "dodgeStarted", durationMs: 260 }, 2600);

  assert.equal(resolveComboAttack(dodging, { baseDamage: 10, now: 2100 }).isDashSlash, true);
  assert.equal(resolveComboAttack(consumed, { baseDamage: 10, now: 2200 }).isDashSlash, false);
  assert.equal(resolveComboAttack(nextDodge, { baseDamage: 10, now: 2620 }).isDashSlash, true);
});
