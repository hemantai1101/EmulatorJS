(function (root) {
  // Optional scripts a player can add to a running game from the menu (Plugins).
  // Each file lives in plugins/ and is served with the player. See PROJECT.md, "Plugins".
  const KEY = 'ps1-player-plugins-auto';
  const list = [
    {
      id: 'fm-rank-helper',
      name: 'Forbidden Memories rank helper',
      src: 'plugins/fm-rank-helper.js',
      note: 'Shows the duel rank and the best move each turn. Built from the fm-fusion-helper repo.',
      stop: () => root.__fmOverlay?.stop()
    },
    {
      id: 'hm-stamina-bar',
      name: 'Harvest Moon stamina and hearts',
      src: 'plugins/hm-stamina-bar.js',
      v: '20261112-golden-hen',
      note: 'Shows stamina, fatigue, the held tool, the mine floor and item odds, basket contents, the fish pond, tomorrow\'s weather, horse race tips, shop hours, animal love and watering can water for Harvest Moon: Back to Nature (US). On mobile, tap More for details, then Close to shrink the panel. Tap Hearts for the girls\' hearts.',
      stop: () => root.__hmStamina?.stop()
    }
  ];
  function auto() {
    try {
      const ids = JSON.parse(root.localStorage.getItem(KEY));
      return Array.isArray(ids) ? ids : [];
    } catch {
      return [];
    }
  }
  function setAuto(id, on) {
    const ids = auto().filter(x => x !== id);
    if (on) ids.push(id);
    try { root.localStorage.setItem(KEY, JSON.stringify(ids)); } catch {}
  }
  // Loading again restarts the plugin; a plugin is expected to replace its own earlier copy.
  function load(id) {
    const plugin = list.find(p => p.id === id);
    if (!plugin) return Promise.reject(new Error('Unknown plugin: ' + id));
    return new Promise((resolve, reject) => {
      const script = root.document.createElement('script');
      // v changes the URL so browsers fetch a new copy after an update
      script.src = plugin.src + (plugin.v ? '?v=' + plugin.v : '');
      script.dataset.ps1Plugin = id;
      script.onload = () => { script.remove(); resolve(plugin); };
      script.onerror = () => { script.remove(); reject(new Error('Could not load ' + plugin.name + '.')); };
      root.document.head.append(script);
    });
  }
  function unload(id) {
    const plugin = list.find(p => p.id === id);
    if (plugin?.stop) plugin.stop();
  }
  function loadAuto() {
    return Promise.allSettled(auto().filter(id => list.some(p => p.id === id)).map(load));
  }
  root.PS1Plugins = { list, auto, setAuto, load, unload, loadAuto };
})(window);
