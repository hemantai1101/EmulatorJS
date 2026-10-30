const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sandbox = { module: { exports: {} }, Uint8Array, DataView, WeakSet };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'state-cards.js'), 'utf8'), sandbox);
const { prepare, alignSequence, readCard, attach } = sandbox.module.exports;
function seal(data, offset) {
  const view = new DataView(data.buffer);
  for (const [start, length, last, count, check] of [[0, 0x340, 0x378, 15, 0x37c], [0x380, 0x6c, 0x3f8, 4, 0x3fc], [0x400, 0x204, 0x624, 8, 0x604]]) {
    let crc = 0;
    for (const value of data.subarray(offset + start, offset + start + length)) {
      crc ^= value * 256;
      for (let bit = 0; bit < 8; bit++) crc = (crc >= 32768 ? crc * 2 ^ 0x1021 : crc * 2) & 65535;
    }
    view.setUint16(offset + check, crc, true);
    view.setUint16(offset + check + 2, crc, true);
    let a = (crc * 65537) >>> 0, b = a;
    for (let i = 0; i < count; i++) {
      const next = (((b & 1) * 0x80000000) | Math.floor(a / 2)) ^ (a * 4096);
      b = (b * 2 + (a & 1)) >>> 0;
      a = (next ^ (next >>> 20)) >>> 0;
      view.setUint32(offset + last - i * 4, a, true);
    }
  }
}
function card(sequence = 26, identity = 12345) {
  const bytes = new Uint8Array(131072), view = new DataView(bytes.buffer);
  bytes.set([77, 67]);
  bytes[128] = 0x51;
  view.setUint32(132, 8192, true);
  view.setUint16(136, 0xffff, true);
  bytes.set(Buffer.from('BASLUS-01411-YUGIOH'), 138);
  for (const value of bytes.subarray(128, 255)) bytes[255] ^= value;
  bytes.set([83, 67], 8192);
  for (const offset of [8192 + 0x200, 8192 + 0x880]) {
    view.setUint32(offset + 0x334, identity, true);
    view.setUint32(offset + 0x404, sequence, true);
    seal(bytes, offset);
  }
  return bytes;
}
const state = new Uint8Array(0x200000), view = new DataView(state.buffer);
view.setUint32(0x9b3b8, 25, true);
view.setUint32(0x1d0534, 12345, true);
const memoryCard = card(), oldState = state.slice(), oldCard = memoryCard.slice();
assert.equal(readCard(memoryCard, 12345), 26);
let result = alignSequence(state, memoryCard, 0);
assert.equal(result.status, 'aligned');
assert.notEqual(result.state, state);
assert.equal(new DataView(result.state.buffer).getUint32(0x9b3b8, true), 26);
assert.deepEqual(state, oldState);
assert.deepEqual(memoryCard, oldCard);
for (let i = 0; i < state.length; i++) if (i < 0x9b3b8 || i >= 0x9b3bc) assert.equal(result.state[i], state[i]);
assert.equal(alignSequence(result.state, memoryCard, 0).status, 'matched');
assert.equal(alignSequence(state, card(27), 0).status, 'aligned', 'the same old state can follow another native save');
assert.equal(alignSequence(state, card(24), 0).status, 'aligned', 'a restored card can have an earlier counter');
for (const bad of [null, new Uint8Array(131072), card(26, 6789), memoryCard.slice(1)]) {
  assert.equal(alignSequence(state, bad, 0).state, state, 'do not change a state without its own valid profile');
}
for (const address of [128, 255, 8192, 8192 + 0x200 + 0x50, 8192 + 0x200 + 0x404, 8192 + 0x880 + 0x404]) {
  const bad = memoryCard.slice();bad[address] ^= 1;
  assert.equal(readCard(bad, 12345), null, 'reject broken headers, directory checksums, data and duplicated records');
}
assert.equal(prepare(state, memoryCard).state, state, 'unrecognized states never get edited');
for (const size of [0, 7, 16, 256]) assert.equal(prepare(new Uint8Array(size), memoryCard).status, 'unsupported');
let reads = 0, loaded;
const manager = { getSaveFile() { reads++;return memoryCard; }, loadState(value) { loaded = value; return 42; } };
attach({ gameManager: manager });const wrapped = manager.loadState;attach({ gameManager: manager });assert.equal(manager.loadState, wrapped);
assert.equal(manager.loadState(state), 42);assert.equal(loaded, state);assert.equal(reads, 0, 'other game states do not even read the memory card');
console.log('PASS: per-profile card checks, sealed/duplicate records, repeat restores, only counter bytes copied, unchanged originals, unknown-state skip and idempotent load hook.');
