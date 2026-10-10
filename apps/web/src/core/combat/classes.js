export const PLAYER_CLASSES = Object.freeze({
  knight: Object.freeze({
    id: "knight",
    label: "剑士",
    attackMode: "meleeArc",
    spritePrefix: "knight_m",
    baseStats: Object.freeze({
      maxHp: 120,
      attack: 13,
      defense: 5,
      critRate: 0.08,
      critMultiplier: 1.5,
    }),
  }),
  wizzard: Object.freeze({
    id: "wizzard",
    label: "法师",
    attackMode: "projectile",
    spritePrefix: "wizzard_m",
    baseStats: Object.freeze({
      maxHp: 96,
      attack: 15,
      defense: 4,
      critRate: 0.25,
      critMultiplier: 1.8,
    }),
  }),
});

export function getPlayerClass(classId = "knight") {
  const playerClass = PLAYER_CLASSES[classId];

  if (!playerClass) {
    throw new Error(`未知职业: ${classId}`);
  }

  return playerClass;
}

export function createPlayerBaseStats(classId = "knight") {
  const playerClass = getPlayerClass(classId);

  return {
    classId: playerClass.id,
    attackMode: playerClass.attackMode,
    spritePrefix: playerClass.spritePrefix,
    ...playerClass.baseStats,
  };
}
