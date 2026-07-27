(function attachStorage(global) {
  function load(key) {
    try {
      const raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("Failed to load saved world", error);
      return null;
    }
  }

  function save(key, data) {
    try {
      global.localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.warn("Failed to save world", error);
      return false;
    }
  }

  function clear(key) {
    global.localStorage.removeItem(key);
  }

  global.WebGame = global.WebGame || {};
  global.WebGame.Storage = { clear, load, save };
})(window);
