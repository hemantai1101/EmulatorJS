(function (root) {
  // Optional scripts a player can add to a running game from the menu (Plugins).
  // Each file lives in plugins/ and is served with the player. See PROJECT.md, "Plugins".
  const KEY = 'ps1-player-plugins-auto';
  const list = [
    {
      id: 'fm-rank-helper',
      name: 'Forbidden Memories rank helper',
      src: 'plugins/fm-rank-helper.js',
      note: 'Shows the duel rank and the best move each turn. Built from the fm-fusion-helper repo.'
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
      script.src = plugin.src;
      script.dataset.ps1Plugin = id;
      script.onload = () => { script.remove(); resolve(plugin); };
      script.onerror = () => { script.remove(); reject(new Error('Could not load ' + plugin.name + '.')); };
      root.document.head.append(script);
    });
  }
  function loadAuto() {
    return Promise.allSettled(auto().filter(id => list.some(p => p.id === id)).map(load));
  }
  root.PS1Plugins = { list, auto, setAuto, load, loadAuto };
})(window);
