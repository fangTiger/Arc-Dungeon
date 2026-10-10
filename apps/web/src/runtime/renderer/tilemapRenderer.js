import { TILE_SIZE } from "./pixelSurface.js";

const FALLBACK_COLORS = {
  floor: "#242130",
  floor_alt: "#2a2636",
  wall_top: "#2c2938",
  wall_face: "#3b3549",
  wall_corner_left: "#2f2a3d",
  wall_corner_right: "#2f2a3d",
  door_closed: "#4b3442",
  door_open: "#17111d",
  portal: "#5c4fb0",
  merchant: "#9b5b34",
  noticeboard: "#704326",
  hero: "#4f7c9b",
  void: "#000000",
};

export function createTilemapRenderer(tileset) {
  let warned = false;

  function drawLayer(context, layer, camera, elapsedMs = 0) {
    if (!layer?.tiles) {
      return;
    }

    const width = getLayerWidth(layer);
    const height = getLayerHeight(layer);
    const originX = Math.round(layer.x ?? 0);
    const originY = Math.round(layer.y ?? 0);

    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const tile = normalizeTile(getTileName(layer, column, row, width), elapsedMs);

        if (!tile) {
          continue;
        }

        const worldX = originX + column * TILE_SIZE;
        const worldY = originY + row * TILE_SIZE;
        const screen = camera.worldToScreen(worldX, worldY);
        drawTile(context, tile, Math.round(screen.x), Math.round(screen.y));
      }
    }
  }

  function drawTile(context, tile, x, y) {
    const frame = getFrame(tileset, tile.name);

    if (!isTilesetReady(tileset) || !frame) {
      warnFallback();
      drawFallbackTile(context, tile.name, x + tile.offsetX, y + tile.offsetY);
      return;
    }

    const frameBox = getFrameBox(frame);
    context.drawImage(
      tileset.image,
      frameBox.sx,
      frameBox.sy,
      frameBox.sw,
      frameBox.sh,
      x + tile.offsetX + frameBox.offsetX,
      y + tile.offsetY + frameBox.offsetY,
      frameBox.sw,
      frameBox.sh,
    );
  }

  function warnFallback() {
    if (!warned) {
      console.warn("图集未就绪，已降级为占位色块渲染。");
      warned = true;
    }
  }

  return { drawLayer };
}

function getLayerWidth(layer) {
  if (Number.isInteger(layer.width)) {
    return layer.width;
  }

  if (Array.isArray(layer.tiles[0])) {
    return layer.tiles[0].length;
  }

  return 0;
}

function getLayerHeight(layer) {
  if (Number.isInteger(layer.height)) {
    return layer.height;
  }

  return Array.isArray(layer.tiles) ? layer.tiles.length : 0;
}

function getTileName(layer, column, row, width) {
  const rowTiles = layer.tiles[row];

  if (Array.isArray(rowTiles)) {
    return rowTiles[column] ?? null;
  }

  return layer.tiles[row * width + column] ?? null;
}

function normalizeTile(tile, elapsedMs = 0) {
  if (!tile) {
    return null;
  }

  if (typeof tile === "string") {
    return { name: tile, offsetX: 0, offsetY: 0 };
  }

  if (Array.isArray(tile.animationFrameNames) && tile.animationFrameNames.length > 0) {
    const fps = Number(tile.animationFps) > 0 ? Number(tile.animationFps) : 4;
    const phase = Number.isInteger(tile.animationPhase) ? tile.animationPhase : 0;
    const index = (Math.floor((elapsedMs / 1000) * fps) + phase) % tile.animationFrameNames.length;

    return {
      name: tile.animationFrameNames[index],
      offsetX: Number(tile.offsetX) || 0,
      offsetY: Number(tile.offsetY) || 0,
    };
  }

  if (typeof tile.name === "string") {
    return {
      name: tile.name,
      offsetX: Number(tile.offsetX) || 0,
      offsetY: Number(tile.offsetY) || 0,
    };
  }

  return null;
}

function isTilesetReady(tileset) {
  if (!tileset?.image || (!tileset.frames && !tileset.tiles)) {
    return false;
  }

  if (typeof tileset.image.complete === "boolean" && !tileset.image.complete) {
    return false;
  }

  if (typeof tileset.image.naturalWidth === "number" && tileset.image.naturalWidth === 0) {
    return false;
  }

  return true;
}

function getFrame(tileset, tileName) {
  return tileset?.frames?.[tileName] ?? tileset?.tiles?.[tileName] ?? null;
}

function getFrameBox(frame) {
  return {
    sx: frame.sx ?? frame.x,
    sy: frame.sy ?? frame.y,
    sw: frame.sw ?? frame.width,
    sh: frame.sh ?? frame.height,
    offsetX: Number(frame.offsetX) || 0,
    offsetY: Number(frame.offsetY) || 0,
  };
}

function drawFallbackTile(context, tileName, x, y) {
  context.fillStyle = FALLBACK_COLORS[tileName] ?? "#ff4fd8";
  context.fillRect(x, y, TILE_SIZE, TILE_SIZE);
}
