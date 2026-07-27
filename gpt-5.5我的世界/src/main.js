(function bootMinecraft(global) {
  const { HOTBAR, SAVE_KEY } = global.WebGame.Config;
  const { Storage, World, Player, Input, Renderer, Ui } = global.WebGame;

  const elements = {
    canvas: document.getElementById("gameCanvas"),
    confirmResetButton: document.getElementById("confirmResetButton"),
    dayText: document.getElementById("dayText"),
    healthText: document.getElementById("healthText"),
    hotbar: document.getElementById("hotbar"),
    inventoryText: document.getElementById("inventoryText"),
    messageText: document.getElementById("messageText"),
    mineButton: document.getElementById("mineButton"),
    placeButton: document.getElementById("placeButton"),
    positionText: document.getElementById("positionText"),
    resetButton: document.getElementById("resetButton"),
    resetDialog: document.getElementById("resetDialog"),
    saveButton: document.getElementById("saveButton"),
    seedText: document.getElementById("seedText"),
    selectedText: document.getElementById("selectedText"),
  };

  const savedGame = Storage.load(SAVE_KEY);
  let world = World.normalizeWorld(savedGame?.world);
  let player = Player.createPlayer(savedGame?.player);
  const input = Input.createInput();
  const renderer = Renderer.createRenderer(elements.canvas);
  const ui = Ui.createUi(elements, { selectSlot });
  let lastFrame = performance.now();

  function selectSlot(index) {
    const blockId = HOTBAR[index];
    if (!blockId) return;
    world.selectedBlock = blockId;
    ui.renderHotbar(world);
    ui.renderStats(world, player);
  }

  function performMine() {
    const result = Player.mineFacing(player, world);
    ui.setMessage(result.message);
    ui.renderHotbar(world);
  }

  function performPlace() {
    const result = Player.placeFacing(player, world);
    ui.setMessage(result.message);
    ui.renderHotbar(world);
  }

  function persistWorld() {
    const ok = Storage.save(SAVE_KEY, { player, world });
    ui.setMessage(ok ? "世界已保存" : "保存失败");
  }

  function openResetDialog() {
    if (typeof elements.resetDialog.showModal === "function") {
      elements.resetDialog.showModal();
      return;
    }

    resetWorld();
  }

  function resetWorld() {
    Storage.clear(SAVE_KEY);
    world = World.createWorld();
    player = Player.createPlayer();
    ui.setMessage("世界已重置");
    ui.renderHotbar(world);
    ui.renderStats(world, player);
  }

  function update(deltaSeconds) {
    World.tickWorld(world, deltaSeconds);
    player.moveCooldown = Math.max(0, player.moveCooldown - deltaSeconds);

    if (player.moveCooldown === 0 && input.state.directions.size > 0) {
      const direction = Array.from(input.state.directions).at(-1);
      const movement = {
        down: [0, 1],
        left: [-1, 0],
        right: [1, 0],
        up: [0, -1],
      }[direction];
      const moved = Player.tryMove(player, world, movement[0], movement[1]);
      player.moveCooldown = moved ? 0.09 : 0.16;
    }

    if (input.consumeAction("mine")) performMine();
    if (input.consumeAction("place")) performPlace();
  }

  function frame(now) {
    const deltaSeconds = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    update(deltaSeconds);
    renderer.render(world, player);
    ui.renderStats(world, player);
    requestAnimationFrame(frame);
  }

  elements.mineButton.addEventListener("click", performMine);
  elements.placeButton.addEventListener("click", performPlace);
  elements.saveButton.addEventListener("click", persistWorld);
  elements.resetButton.addEventListener("click", openResetDialog);
  elements.confirmResetButton.addEventListener("click", () => {
    resetWorld();
    elements.resetDialog.close();
  });
  window.addEventListener("resize", renderer.resize);
  Input.bindKeyboard(input, selectSlot);
  Input.bindTouch(input, document);
  Input.bindCanvasPointer(input, elements.canvas, renderer.getTileFromPointer);

  renderer.resize();
  ui.renderHotbar(world);
  ui.renderStats(world, player);
  requestAnimationFrame(frame);
})(window);
