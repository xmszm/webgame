(function attachRenderer(global) {
  const { BLOCKS, TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } = global.WebGame.Config;
  const { getFacingTile } = global.WebGame.Player;

  function createRenderer(canvas) {
    const context = canvas.getContext("2d");
    const camera = { x: 0, y: 0 };

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = Math.floor(rect.width * ratio);
      canvas.height = Math.floor(rect.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function render(world, player) {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const viewTilesX = Math.ceil(width / TILE_SIZE) + 2;
      const viewTilesY = Math.ceil(height / TILE_SIZE) + 2;

      camera.x = clamp(player.x - Math.floor(viewTilesX / 2), 0, Math.max(0, WORLD_WIDTH - viewTilesX));
      camera.y = clamp(player.y - Math.floor(viewTilesY / 2), 0, Math.max(0, WORLD_HEIGHT - viewTilesY));

      drawSky(context, width, height, world.time);

      const startX = Math.floor(camera.x);
      const startY = Math.floor(camera.y);
      for (let y = startY; y < Math.min(WORLD_HEIGHT, startY + viewTilesY); y += 1) {
        for (let x = startX; x < Math.min(WORLD_WIDTH, startX + viewTilesX); x += 1) {
          drawTile(context, world.tiles[y][x], (x - camera.x) * TILE_SIZE, (y - camera.y) * TILE_SIZE, x, y);
        }
      }

      drawFacingTarget(context, player, camera);
      drawPlayer(context, player, camera, world.time);
      drawVignette(context, width, height, world.time);
    }

    function getTileFromPointer(event) {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((event.clientX - rect.left) / TILE_SIZE + camera.x);
      const y = Math.floor((event.clientY - rect.top) / TILE_SIZE + camera.y);
      return { x, y };
    }

    return { getTileFromPointer, render, resize };
  }

  function drawSky(context, width, height, time) {
    const night = Math.max(0, Math.sin((time / 120) * Math.PI * 2 - Math.PI / 2));
    context.fillStyle = blend("#88bde8", "#101722", night * 0.82);
    context.fillRect(0, 0, width, height);
  }

  function drawTile(context, blockId, x, y, gridX, gridY) {
    const block = BLOCKS[blockId] || BLOCKS.grass;
    context.fillStyle = block.color;
    context.fillRect(Math.floor(x), Math.floor(y), TILE_SIZE, TILE_SIZE);

    context.fillStyle = patternColor(blockId, gridX, gridY);
    for (let i = 0; i < 4; i += 1) {
      const px = Math.floor(x + ((gridX * 11 + gridY * 7 + i * 13) % 25));
      const py = Math.floor(y + ((gridX * 5 + gridY * 17 + i * 9) % 25));
      context.fillRect(px, py, 4, 4);
    }

    context.strokeStyle = "rgb(0 0 0 / 0.18)";
    context.strokeRect(Math.floor(x) + 0.5, Math.floor(y) + 0.5, TILE_SIZE, TILE_SIZE);
  }

  function patternColor(blockId, gridX, gridY) {
    if (blockId === "water") return (gridX + gridY) % 2 ? "#7db8e8" : "#245d98";
    if (blockId === "ore") return "#e3d384";
    if (blockId === "torch") return "#fff0a3";
    if (blockId === "leaves") return "#66b45d";
    if (blockId === "wood") return "#5f351f";
    return "rgb(255 255 255 / 0.16)";
  }

  function drawFacingTarget(context, player, camera) {
    const target = getFacingTile(player);
    context.strokeStyle = "#f0e38a";
    context.lineWidth = 3;
    context.strokeRect(
      Math.floor((target.x - camera.x) * TILE_SIZE) + 3,
      Math.floor((target.y - camera.y) * TILE_SIZE) + 3,
      TILE_SIZE - 6,
      TILE_SIZE - 6,
    );
    context.lineWidth = 1;
  }

  function drawPlayer(context, player, camera, time) {
    const x = Math.floor((player.x - camera.x) * TILE_SIZE);
    const y = Math.floor((player.y - camera.y) * TILE_SIZE);
    const bob = Math.sin(time * 8) * 1.5;

    context.fillStyle = "#2c7bd0";
    context.fillRect(x + 9, y + 13 + bob, 14, 14);
    context.fillStyle = "#e1b184";
    context.fillRect(x + 10, y + 5 + bob, 12, 10);
    context.fillStyle = "#2b2825";
    context.fillRect(x + 10, y + 4 + bob, 12, 4);
    context.fillStyle = "#17324d";
    context.fillRect(x + 8, y + 27 + bob, 6, 4);
    context.fillRect(x + 18, y + 27 + bob, 6, 4);
  }

  function drawVignette(context, width, height, time) {
    const night = Math.max(0, Math.sin((time / 120) * Math.PI * 2 - Math.PI / 2));
    if (night <= 0.02) return;
    context.fillStyle = `rgb(0 0 0 / ${night * 0.28})`;
    context.fillRect(0, 0, width, height);
  }

  function blend(from, to, amount) {
    const a = hexToRgb(from);
    const b = hexToRgb(to);
    const r = Math.round(a.r + (b.r - a.r) * amount);
    const g = Math.round(a.g + (b.g - a.g) * amount);
    const blue = Math.round(a.b + (b.b - a.b) * amount);
    return `rgb(${r} ${g} ${blue})`;
  }

  function hexToRgb(hex) {
    const value = Number.parseInt(hex.slice(1), 16);
    return { b: value & 255, g: (value >> 8) & 255, r: (value >> 16) & 255 };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  global.WebGame = global.WebGame || {};
  global.WebGame.Renderer = { createRenderer };
})(window);
