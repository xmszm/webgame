(function attachPlayer(global) {
  const { BLOCKS, WORLD_HEIGHT, WORLD_WIDTH } = global.WebGame.Config;
  const { getTile, setTile } = global.WebGame.World;

  function createPlayer(savedPlayer) {
    return {
      direction: savedPlayer?.direction || "down",
      health: Number(savedPlayer?.health) || 100,
      moveCooldown: 0,
      x: Number.isFinite(savedPlayer?.x) ? savedPlayer.x : Math.floor(WORLD_WIDTH / 2),
      y: Number.isFinite(savedPlayer?.y) ? savedPlayer.y : Math.floor(WORLD_HEIGHT / 2),
    };
  }

  function getFacingTile(player) {
    const offset = {
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
      up: [0, -1],
    }[player.direction];

    return { x: player.x + offset[0], y: player.y + offset[1] };
  }

  function tryMove(player, world, dx, dy) {
    if (dx === 0 && dy === 0) return false;
    player.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";

    const nextX = player.x + Math.sign(dx);
    const nextY = player.y + Math.sign(dy);
    const target = getTile(world, nextX, nextY);
    if (BLOCKS[target]?.solid) return false;

    player.x = Math.max(0, Math.min(WORLD_WIDTH - 1, nextX));
    player.y = Math.max(0, Math.min(WORLD_HEIGHT - 1, nextY));
    return true;
  }

  function mineFacing(player, world) {
    const target = getFacingTile(player);
    if (!isInsideWorld(target.x, target.y)) return { ok: false, message: "已到达世界边界" };
    const blockId = getTile(world, target.x, target.y);
    if (blockId === "water") return { ok: false, message: "水不能被收进背包" };

    if (!setTile(world, target.x, target.y, "grass")) return { ok: false, message: "挖掘失败" };
    world.inventory[blockId] = (world.inventory[blockId] || 0) + 1;
    return { ok: true, message: `获得 ${BLOCKS[blockId].name}` };
  }

  function placeFacing(player, world) {
    const blockId = world.selectedBlock;
    const amount = world.inventory[blockId] || 0;
    if (amount <= 0) return { ok: false, message: "背包数量不足" };

    const target = getFacingTile(player);
    if (!isInsideWorld(target.x, target.y)) return { ok: false, message: "已到达世界边界" };
    const current = getTile(world, target.x, target.y);
    if (current !== "grass" && current !== "water" && current !== "sand") {
      return { ok: false, message: "目标位置已有方块" };
    }

    if (!setTile(world, target.x, target.y, blockId)) return { ok: false, message: "放置失败" };
    world.inventory[blockId] = amount - 1;
    return { ok: true, message: `放置 ${BLOCKS[blockId].name}` };
  }

  function isInsideWorld(x, y) {
    return x >= 0 && y >= 0 && x < WORLD_WIDTH && y < WORLD_HEIGHT;
  }

  global.WebGame = global.WebGame || {};
  global.WebGame.Player = { createPlayer, getFacingTile, mineFacing, placeFacing, tryMove };
})(window);
