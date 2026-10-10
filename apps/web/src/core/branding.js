export const arcCastleBrand = {
  label: "ARC",
  subtitle: "Guild Lintel",
  mode: "integrated-guild-hub",
  x: 260,
  y: 10,
  environmentMark: {
    kind: "guild-lintel-logo",
    x: 230,
    y: 4,
    logoUnit: 1,
    logoCount: 1,
    color: "#a4c7ff",
    showTextLabel: true,
    surface: "wall-relief",
    detachedPanel: false,
  },
};

export function createArcLogoMark(x, y, unit = 4) {
  // 原创像素拱门形成 A 字轮廓，右上星点代表地牢探索的目标。
  const blocks = [
    [5, 2, 6, 2], [3, 4, 2, 2], [11, 4, 2, 2],
    [1, 6, 2, 7], [13, 6, 2, 7], [3, 9, 10, 2],
    [0, 13, 4, 2], [12, 13, 4, 2],
    [13, 0, 1, 3, "star"], [12, 1, 3, 1, "star"],
  ];
  return {
    kind: "arc-portal-star", x, y, unit,
    width: Math.round(16 * unit), height: Math.round(15 * unit),
    parts: blocks.map(([left, top, width, height, role = "portal"]) => ({
      x: Math.round(x + left * unit), y: Math.round(y + top * unit),
      width: Math.max(1, Math.round(width * unit)), height: Math.max(1, Math.round(height * unit)),
      role, color: role === "star" ? "#f6d77a" : "#a4c7ff",
    })),
  };
}
