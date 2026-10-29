const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
for (const [file, start, end] of [
  ['data/src/emulator.js', 'getCoreSettings() {', 'loadSettings() {'],
  ['data/emulator.min.js', 'getCoreSettings(){', 'loadSettings(){']
]) {
  const source = fs.readFileSync(path.join(__dirname, 'public', file), 'utf8');
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert(from >= 0 && to > from);
  let stored = null;
  const context = { window: { localStorage: {} }, localStorage: { getItem() { return stored; } } };
  const method = vm.runInNewContext('({' + source.slice(from, to) + '}).getCoreSettings', context);
  const emulator = { config: { defaultOptions: { pcsx_rearmed_memcard2: 'enabled' } }, getLocalStorageKey() { return 'test'; } };
  assert.match(method.call(emulator), /pcsx_rearmed_memcard2 = "enabled"/, 'a fresh browser must enable slot 2 before the core starts');
  stored = '{"settings":{"pcsx_rearmed_memcard2":"disabled","volume":"0.5"}}';
  assert.match(method.call(emulator), /pcsx_rearmed_memcard2 = "disabled"/, 'keep an explicit Off choice');
  assert.match(method.call(emulator), /volume = 0.5/, 'keep the other stored options');
  stored = '{"settings":{"volume":"0.5"}}';
  assert.match(method.call(emulator), /pcsx_rearmed_memcard2 = "enabled"/, 'add the default to older settings');
  console.log(file + ': PASS — startup card default, explicit Off and older settings.');
}
