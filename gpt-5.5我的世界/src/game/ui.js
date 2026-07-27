(function attachUi(global) {
  const { BLOCKS, HOTBAR } = global.WebGame.Config;

  function createUi(elements, handlers) {
    function renderHotbar(world) {
      elements.hotbar.innerHTML = "";
      HOTBAR.forEach((blockId, index) => {
        const block = BLOCKS[blockId];
        const button = document.createElement("button");
        button.type = "button";
        button.className = blockId === world.selectedBlock ? "is-selected" : "";
        button.setAttribute("aria-label", `选择${block.name}`);
        button.dataset.blockId = blockId;
        button.innerHTML = `
          <span class="block-swatch" style="background:${block.color}" aria-hidden="true"></span>
          <span class="block-name">${block.name}</span>
          <span class="block-count">${world.inventory[blockId] || 0}</span>
        `;
        button.addEventListener("click", () => handlers.selectSlot(index));
        elements.hotbar.appendChild(button);
      });
    }

    function renderStats(world, player) {
      const selected = BLOCKS[world.selectedBlock];
      elements.healthText.textContent = `生命 ${player.health}`;
      elements.dayText.textContent = `第 ${world.day} 天`;
      elements.seedText.textContent = `Seed ${world.seed}`;
      elements.positionText.textContent = `${player.x}, ${player.y}`;
      elements.inventoryText.textContent = `${world.inventory[world.selectedBlock] || 0}`;
      elements.selectedText.textContent = selected.name;
    }

    function setMessage(message) {
      elements.messageText.textContent = message;
    }

    return { renderHotbar, renderStats, setMessage };
  }

  global.WebGame = global.WebGame || {};
  global.WebGame.Ui = { createUi };
})(window);
