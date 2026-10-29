const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const elements = new Map(), files = new Map(), downloads = [], events = {};
let confirmed = true, reloads = 0, refreshes = 0, syncError = null;
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    disabled: false, hidden: false, textContent: '', files: [], handlers: {},
    addEventListener(name, callback) { this.handlers[name] = callback; },
    click() { this.handlers.click?.(); }, append() {}, remove() {},
    showModal() { this.open = true; }, close() { this.open = false; }
  });
  return elements.get(id);
}
const document = { querySelector: element, body: { append() {} }, createElement() {
  return { click() { downloads.push(this.download); }, remove() {} };
} };
const window = { confirm() { return confirmed; }, PS1Touch: { reset() {} } };
const context = { window, document, Blob, Uint8Array, Promise, URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
  MutationObserver: class { observe() {} }, setTimeout() {}, location: { reload() { reloads++; } } };
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, 'saves.js'), 'utf8'), context);
const manager = {
  getSaveFilePath() { return '/data/saves/PCSX-ReARMed/test.srm'; },
  getSaveFile() { return files.get(this.getSaveFilePath()); },
  loadSaveFiles() { refreshes++; },
  FS: {
    analyzePath(path) { return { exists: files.has(path) }; },
    readFile(path) { return files.get(path).slice(); },
    writeFile(path, bytes) { files.set(path, bytes.slice()); },
    unlink(path) { files.delete(path); },
    syncfs(populate, callback) { assert.equal(populate, false); callback(syncError); }
  }
};
const emulator = { gameManager: manager, menu: { close() {} }, getSettingValue() { return 'enabled'; }, on(name, callback) { events[name] = callback; } };
function card(marker) { const bytes = new Uint8Array(131072); bytes.set([77, 67]); bytes[65536] = marker; return bytes; }
files.set(manager.getSaveFilePath(), card(1));
files.set('/data/saves/PCSX-ReARMed/pcsx-card2.mcd', card(2));
async function pick(slot, bytes, name = 'card.mcd') {
  window.PS1Saves.pickCard(slot);
  element('#card-file').files = [{ name, size: bytes.length, async arrayBuffer() { return bytes.buffer; } }];
  await element('#card-file').handlers.change();
}
(async () => {
  window.PS1Saves.attach(emulator);
  element('#export-card2').click();
  assert.equal(downloads.pop(), 'pcsx-card2.mcd');
  await pick(1, new Uint8Array(10));
  assert.equal(files.get(manager.getSaveFilePath())[65536], 1, 'reject bad size without changing the card');
  await pick(1, new Uint8Array(131072));
  assert.equal(files.get(manager.getSaveFilePath())[65536], 1, 'reject bad header without changing the card');
  confirmed = false;
  await pick(1, card(3));
  assert.equal(files.get(manager.getSaveFilePath())[65536], 1, 'cancel leaves the card alone');
  confirmed = true;
  await pick(1, card(3));
  assert.equal(files.get(manager.getSaveFilePath())[65536], 3);
  assert.equal(downloads.pop(), 'test.srm', 'download the old card before replacing it');
  assert.equal(refreshes, 1);
  assert.equal(reloads, 0);
  syncError = new Error('Full storage');
  await pick(1, card(4));
  assert.equal(files.get(manager.getSaveFilePath())[65536], 3, 'restore the old card when persistence fails');
  assert.match(element('#card-status').textContent, /Full storage/);
  syncError = null;
  await pick(2, card(5));
  assert.equal(files.get('/data/saves/PCSX-ReARMed/pcsx-card2.mcd')[65536], 5);
  assert.equal(files.get(manager.getSaveFilePath())[65536], 3, 'slot 2 import leaves slot 1 alone');
  assert.equal(reloads, 1);
  assert.equal(downloads.pop(), 'pcsx-card2.mcd');
  events.exit();
  assert.equal(element('#export-card1').disabled, true);
  console.log('PASS: both card paths, exports, validated imports, cancel, backup before replace, failed persistence rollback, slot isolation and exit cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
