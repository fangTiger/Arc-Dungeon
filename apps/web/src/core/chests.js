export function openChest(player, chest, openedChests) {
  if (!chest || !chest.reward || openedChests.has(chest.id)) {
    return { player, openedChests, opened: false };
  }

  const nextOpenedChests = new Set(openedChests);
  nextOpenedChests.add(chest.id);

  return {
    opened: true,
    openedChests: nextOpenedChests,
    player: {
      ...player,
      coins: player.coins + chest.reward.coins,
      materials: (player.materials ?? 0) + chest.reward.materials,
    },
  };
}
