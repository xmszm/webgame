(function attachInput(global) {
  const KEY_TO_DIRECTION = {
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    KeyA: "left",
    KeyD: "right",
    KeyS: "down",
    KeyW: "up",
  };

  function createInput() {
    const state = {
      actions: new Set(),
      directions: new Set(),
      pointerTile: null,
    };

    function setDirection(direction, enabled) {
      if (enabled) state.directions.add(direction);
      else state.directions.delete(direction);
    }

    function consumeAction(action) {
      const hasAction = state.actions.has(action);
      state.actions.delete(action);
      return hasAction;
    }

    return { consumeAction, setDirection, state };
  }

  function bindKeyboard(input, onSelectSlot) {
    window.addEventListener("keydown", (event) => {
      const direction = KEY_TO_DIRECTION[event.code];
      if (direction) {
        event.preventDefault();
        input.setDirection(direction, true);
      }

      if (event.code === "Space") {
        event.preventDefault();
        input.state.actions.add("mine");
      }

      if (event.code === "Enter") {
        event.preventDefault();
        input.state.actions.add("place");
      }

      if (/^Digit[1-8]$/.test(event.code)) onSelectSlot(Number(event.code.slice(5)) - 1);
    });

    window.addEventListener("keyup", (event) => {
      const direction = KEY_TO_DIRECTION[event.code];
      if (direction) input.setDirection(direction, false);
    });
  }

  function bindTouch(input, root) {
    root.querySelectorAll("[data-touch]").forEach((button) => {
      const direction = button.getAttribute("data-touch");
      const start = (event) => {
        event.preventDefault();
        input.setDirection(direction, true);
      };
      const end = (event) => {
        event.preventDefault();
        input.setDirection(direction, false);
      };

      button.addEventListener("pointerdown", start);
      button.addEventListener("pointerup", end);
      button.addEventListener("pointercancel", end);
      button.addEventListener("pointerleave", end);
    });
  }

  function bindCanvasPointer(input, canvas, getTileFromPointer) {
    canvas.addEventListener("pointermove", (event) => {
      input.state.pointerTile = getTileFromPointer(event);
    });

    canvas.addEventListener("pointerdown", (event) => {
      input.state.pointerTile = getTileFromPointer(event);
      input.state.actions.add(event.button === 2 ? "place" : "mine");
    });

    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  global.WebGame = global.WebGame || {};
  global.WebGame.Input = { bindCanvasPointer, bindKeyboard, bindTouch, createInput };
})(window);
