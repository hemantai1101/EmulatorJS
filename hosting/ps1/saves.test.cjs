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
function formattedCard(states = []) {
  const bytes = new Uint8Array(131072);
  bytes.set([77, 67]);
  for (let block = 1; block <= 15; block++) bytes[block * 128] = states[block - 1] ?? 0xa0;
  for (let frame = 0; frame <= 15; frame++) {
    let checksum = 0;
    for (let i = 0; i < 127; i++) checksum ^= bytes[frame * 128 + i];
    bytes[frame * 128 + 127] = checksum;
  }
  return bytes;
}
async function pick(slot, bytes, name = 'card.mcd') {
  window.PS1Saves.pickCard(slot);
  element('#card-file').files = [{ name, size: bytes.length, async arrayBuffer() { return bytes.buffer; } }];
  await element('#card-file').handlers.change();
}
(async () => {
  window.PS1Saves.attach(emulator);
  const slot1 = manager.getSaveFilePath(), slot2 = '/data/saves/PCSX-ReARMed/pcsx-card2.mcd';
  const checkCard = (bytes, expected) => {
    if (bytes) files.set(slot1, bytes); else files.delete(slot1);
    window.PS1Saves.open();
    assert.equal(element('#card1-contents').textContent, expected);
    window.PS1Saves.close();
  };
  const empty = formattedCard();
  const original = empty.slice();
  checkCard(empty, 'Empty · 15 blocks free');
  assert.deepEqual(empty, original, 'checking usage must not change card bytes');
  checkCard(formattedCard([0xa1, 0xa2, 0xa3]), 'Empty · 15 blocks free');
  checkCard(formattedCard([0x51, 0x52, 0x53]), 'Used · 3/15 blocks');
  checkCard(formattedCard(Array(15).fill(0x51)), 'Full · 15/15 blocks');
  checkCard(null, 'No card file yet');
  checkCard(new Uint8Array(131072), 'Cannot read card');
  checkCard(empty.slice(0, 128), 'Cannot read card');
  const corrupt = formattedCard(); corrupt[255] ^= 1;
  checkCard(corrupt, 'Cannot read card');
  const header = formattedCard(); header[127] ^= 1;
  checkCard(header, 'Cannot read card');
  checkCard(formattedCard([0x50]), 'Cannot read card');
  files.set(slot2, formattedCard([0x51]));
  window.PS1Saves.open();
  assert.equal(element('#card2-contents').textContent, 'Used · 1/15 blocks');
  window.PS1Saves.close();
  files.set(slot1, card(1)); files.set(slot2, card(2));
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
  await pick(1, formattedCard([0x51]));
  assert.equal(element('#card1-contents').textContent, 'Used · 1/15 blocks', 'import refreshes usage');
  const readCard = manager.getSaveFile;
  manager.getSaveFile = () => { throw new Error('Unreadable'); };
  window.PS1Saves.open();
  assert.equal(element('#card1-contents').textContent, 'Cannot read card');
  window.PS1Saves.close();
  manager.getSaveFile = readCard;
  emulator.getSettingValue = () => 'disabled';
  window.PS1Saves.attach(emulator);
  assert.equal(element('#card2-contents').textContent, 'Slot off');
  events.exit();
  assert.equal(element('#export-card1').disabled, true);
  assert.equal(element('#card1-contents').textContent, 'Start the game to check');
  assert.equal(element('#card2-contents').textContent, 'Start the game to check');
  console.log('PASS: empty/used/full/missing/unreadable card labels, both card paths, exports, validated imports, cancel, backup before replace, failed persistence rollback, slot isolation and exit cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
