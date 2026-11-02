const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const store = {};
const added = [];
const window = {
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
  document: {
    createElement: () => ({ dataset: {}, remove() { this.removed = true; } }),
    head: { append(script) { added.push(script); setTimeout(() => script.src.includes('missing') ? script.onerror() : script.onload()); } }
  }
};
vm.runInNewContext(fs.readFileSync(__dirname + '/plugins.js', 'utf8'), { window });
const P = window.PS1Plugins;
(async () => {
  for (const plugin of P.list) assert(fs.existsSync(__dirname + '/' + plugin.src), plugin.src + ' must exist');
  assert.deepEqual([...P.auto()], []);
  P.setAuto('fm-rank-helper', true);
  P.setAuto('fm-rank-helper', true);
  assert.deepEqual([...P.auto()], ['fm-rank-helper'], 'auto list keeps one entry per plugin');
  await P.loadAuto();
  assert.equal(added.length, 1);
  assert.equal(added[0].src, 'plugins/fm-rank-helper.js');
  assert(added[0].removed, 'the script tag is removed after it runs');
  let stopped = 0;
  P.list[0].stop = () => { stopped++; };
  P.unload('fm-rank-helper');
  assert.equal(stopped, 1, 'unload calls the plugin stop hook');
  P.setAuto('fm-rank-helper', false);
  assert.deepEqual([...P.auto()], []);
  store['ps1-player-plugins-auto'] = 'not json';
  assert.deepEqual([...P.auto()], [], 'bad stored value is ignored');
  await assert.rejects(P.load('nope'), /Unknown plugin/);
  P.list.push({ id: 'broken', name: 'Broken', src: 'plugins/missing.js' });
  await assert.rejects(P.load('broken'), /Could not load Broken/);
  console.log('PASS: plugins load on request and on game start, and bad input is handled.');
})();
