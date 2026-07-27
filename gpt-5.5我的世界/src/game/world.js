(function attachWorld(global) {
  const { BLOCKS, HOTBAR, WORLD_HEIGHT, WORLD_WIDTH } = global.WebGame.Config;

  function createRng(seed) {
    let state = seed >>> 0;
    return function next() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function hash(x, y, seed) {
    let value = x * 374761393 + y * 668265263 + seed * 1442695041;
    value = (value ^ (value >>> 13)) * 1274126177;
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  }

  function smoothNoise(x, y, seed) {
    const scale = 0.09;
    const sx = x * scale;
    const sy = y * scale;
    const x0 = Math.floor(sx);
    const y0 = Math.floor(sy);
    const tx = sx - x0;
    const ty = sy - y0;
    const n00 = hash(x0, y0, seed);
    const n10 = hash(x0 + 1, y0, seed);
    const n01 = hash(x0, y0 + 1, seed);
    const n11 = hash(x0 + 1, y0 + 1, seed);
    const ix0 = n00 + (n10 - n00) * tx;
    const ix1 = n01 + (n11 - n01) * tx;
    return ix0 + (ix1 - ix0) * ty;
  }

  function createDefaultInventory() {
    return HOTBAR.reduce((inventory, blockId) => {
      inventory[blockId] = blockId === "torch" ? 8 : 16;
      return inventory;
    }, {});
  }

  function createWorld(seed = Math.floor(Math.random() * 9000) + 1000) {
    const rng = createRng(seed);
    const tiles = [];

    for (let y = 0; y < WORLD_HEIGHT; y += 1) {
      const row = [];
      for (let x = 0; x < WORLD_WIDTH; x += 1) {
        const elevation = smoothNoise(x, y, seed);
        const detail = hash(x, y, seed + 7);
        let block = "grass";

        if (elevation < 0.2) block = "water";
        else if (elevation < 0.28) block = "sand";
        else if (elevation > 0.72) block = detail > 0.72 ? "ore" : "stone";
        else if (detail > 0.92) block = "dirt";

        row.push(block);
      }
      tiles.push(row);
    }

    plantTrees(tiles, rng);
    clearSpawn(tiles);

    return {
      day: 1,
      inventory: createDefaultInventory(),
      seed,
      selectedBlock: "grass",
      time: 0,
      tiles,
    };
  }

  function plantTrees(tiles, rng) {
    for (let i = 0; i < 80; i += 1) {
      const x = Math.floor(rng() * (WORLD_WIDTH - 4)) + 2;
      const y = Math.floor(rng() * (WORLD_HEIGHT - 4)) + 2;

      if (tiles[y][x] !== "grass") continue;

      tiles[y][x] = "wood";
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (Math.abs(dx) + Math.abs(dy) > 2) continue;
          const tile = tiles[y + dy][x + dx];
          if (tile === "grass" || tile === "dirt") tiles[y + dy][x + dx] = "leaves";
        }
      }
      tiles[y][x] = "wood";
    }
  }

  function clearSpawn(tiles) {
    const centerX = Math.floor(WORLD_WIDTH / 2);
    const centerY = Math.floor(WORLD_HEIGHT / 2);
    for (let y = centerY - 1; y <= centerY + 1; y += 1) {
      for (let x = centerX - 1; x <= centerX + 1; x += 1) {
        tiles[y][x] = "grass";
      }
    }
  }

  function normalizeWorld(data) {
    if (!data || !Array.isArray(data.tiles)) return createWorld();
    const world = createWorld(Number(data.seed) || 1234);
    world.tiles = data.tiles.slice(0, WORLD_HEIGHT).map((row) =>
      row
        .slice(0, WORLD_WIDTH)
        .map((block) => (BLOCKS[block] ? block : "grass")),
    );
    world.inventory = { ...createDefaultInventory(), ...(data.inventory || {}) };
    world.selectedBlock = BLOCKS[data.selectedBlock] ? data.selectedBlock : "grass";
    world.day = Number(data.day) || 1;
    world.time = Number(data.time) || 0;
    return world;
  }

  function getTile(world, x, y) {
    if (x < 0 || y < 0 || x >= WORLD_WIDTH || y >= WORLD_HEIGHT) return "stone";
    return world.tiles[y][x];
  }

  function setTile(world, x, y, blockId) {
    if (x < 0 || y < 0 || x >= WORLD_WIDTH || y >= WORLD_HEIGHT || !BLOCKS[blockId]) return false;
    world.tiles[y][x] = blockId;
    return true;
  }

  function tickWorld(world, deltaSeconds) {
    world.time += deltaSeconds;
    if (world.time >= 120) {
      world.time -= 120;
      world.day += 1;
    }
  }

  global.WebGame = global.WebGame || {};
  global.WebGame.World = {
    createDefaultInventory,
    createWorld,
    getTile,
    normalizeWorld,
    setTile,
    tickWorld,
  };
})(window);
