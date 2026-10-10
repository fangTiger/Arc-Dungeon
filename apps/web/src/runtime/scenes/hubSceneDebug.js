export function moveToInteraction({ hubMap, player, setNearbyInteraction, clearFeedback }, id) {
  const interaction = hubMap.interactions.find((candidate) => candidate.id === id);
  if (!interaction) {
    return false;
  }

  player.x = interaction.interactX;
  player.y = interaction.interactY;
  setNearbyInteraction(interaction);
  clearFeedback();
  return true;
}
