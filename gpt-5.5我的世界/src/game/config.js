(function attachConfig(global) {
  const TILE_SIZE = 32;

  const BLOCKS = {
    grass: { id: "grass", name: "草方块", color: "#5da857", solid: false, walkCost: 1 },
    dirt: { id: "dirt", name: "泥土", color: "#8a5a35", solid: true, walkCost: 1 },
    stone: { id: "stone", name: "石头", color: "#858b8c", solid: true, walkCost: 1 },
    sand: { id: "sand", name: "沙子", color: "#d8c278", solid: false, walkCost: 1 },
    water: { id: "water", name: "水", color: "#3d80bf", solid: false, walkCost: 1.8 },
    wood: { id: "wood", name: "木头", color: "#8f5c2f", solid: true, walkCost: 1 },
    leaves: { id: "leaves", name: "树叶", color: "#3f8f46", solid: true, walkCost: 1 },
    ore: { id: "ore", name: "矿石", color: "#7a8a97", solid: true, walkCost: 1 },
    torch: { id: "torch", name: "火把", color: "#edb74d", solid: false, walkCost: 1 },
    brick: { id: "brick", name: "砖块", color: "#a84c3d", solid: true, walkCost: 1 },
  };

  const HOTBAR = ["grass", "dirt", "stone", "sand", "wood", "leaves", "torch", "brick"];

  global.WebGame = global.WebGame || {};
  global.WebGame.Config = {
    BLOCKS,
    HOTBAR,
    SAVE_KEY: "webgame.minecraft.save.v1",
    TILE_SIZE,
    WORLD_HEIGHT: 72,
    WORLD_WIDTH: 96,
  };
})(window);
