export function createCamera({ x = 0, y = 0 } = {}) {
  return {
    x,
    y,

    setPosition(nextX, nextY) {
      this.x = nextX;
      this.y = nextY;
      return this;
    },

    worldToScreen(worldX, worldY) {
      return {
        x: Math.round(worldX - this.x),
        y: Math.round(worldY - this.y),
      };
    },
  };
}
