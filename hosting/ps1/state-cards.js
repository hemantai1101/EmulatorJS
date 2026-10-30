(function (root) {
  const filename = 'BASLUS-01411-YUGIOH';
  const sequenceAddress = 0x9b3b8;
  const identityAddress = 0x1d0534;
  const attached = new WeakSet();
  function matches(bytes, offset, text) {
    return [...text].every((letter, index) => bytes[offset + index] === letter.charCodeAt(0));
  }
  function fingerprint(bytes, start, length) {
    let hash = 2166136261;
    for (let i = start; i < start + length; i++) hash = Math.imul(hash ^ bytes[i], 16777619) >>> 0;
    return hash;
  }
  function identify(state) {
    if (!(state instanceof Uint8Array) || !matches(state, 0, 'RASTATE\x01')) return null;
    const view = new DataView(state.buffer, state.byteOffset, state.byteLength);
    let core, ended = false;
    for (let offset = 8; offset + 8 <= state.length;) {
      const length = view.getUint32(offset + 4, true);
      const end = offset + 8 + length;
      if (end > state.length) return null;
      if (matches(state, offset, 'MEM ')) {
        if (core !== undefined || length !== 0x440000) return null;
        core = offset + 8;
      }
      if (matches(state, offset, 'END ')) {
        if (length || end !== state.length) return null;
        ended = true;
        break;
      }
      if (!length) return null;
      offset = end + (8 - length % 8) % 8;
    }
    if (!ended || core === undefined || !matches(state, core, 'STv4 PCSXra f29871d\x00') || view.getUint32(core + 32, true) !== 0x8b410006 || state[core + 36] > 1) return null;
    const ram = core + 37 + 36864;
    if (ram + 0x200000 > state.length || fingerprint(state, ram + 0x10000, 0x10000) !== 0x291cafac || fingerprint(state, ram + 0x60000, 128) !== 0x5b01ef85) return null;
    if (view.getUint16(ram + 0x9b3fa, true) & 0x1000) return null;
    return ram;
  }
  function crc16(bytes, start, length) {
    let crc = 0;
    for (let i = start; i < start + length; i++) {
      crc ^= bytes[i] << 8;
      for (let bit = 0; bit < 8; bit++) crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
    }
    return crc;
  }
  function validRecord(card, offset) {
    const view = new DataView(card.buffer, card.byteOffset, card.byteLength);
    for (const [start, length, last, count, checksum] of [[0, 0x340, 0x378, 15, 0x37c], [0x380, 0x6c, 0x3f8, 4, 0x3fc], [0x400, 0x204, 0x624, 8, 0x604]]) {
      const crc = crc16(card, offset + start, length);
      if (view.getUint16(offset + checksum, true) !== crc || view.getUint16(offset + checksum + 2, true) !== crc) return false;
      let low = (crc | crc << 16) >>> 0, high = low;
      for (let word = 0; word < count; word++) {
        const next = ((high << 31) | (low >>> 1)) ^ (low << 12);
        high = (high + high + (low & 1)) >>> 0;
        low = (next ^ (next >>> 20)) >>> 0;
        if (view.getUint32(offset + last - word * 4, true) !== low) return false;
      }
    }
    return true;
  }
  function readCard(card, identity) {
    if (!(card instanceof Uint8Array) || card.length !== 131072 || !matches(card, 0, 'MC')) return null;
    const view = new DataView(card.buffer, card.byteOffset, card.byteLength);
    let found = null;
    for (let block = 1; block <= 15; block++) {
      const entry = block * 128;
      if (card[entry] !== 0x51 || !matches(card, entry + 10, filename + '\x00')) continue;
      let checksum = 0;
      for (let i = 0; i < 127; i++) checksum ^= card[entry + i];
      if (checksum !== card[entry + 127] || view.getUint32(entry + 4, true) !== 8192 || view.getUint16(entry + 8, true) !== 0xffff) return null;
      const data = block * 8192;
      if (!matches(card, data, 'SC')) return null;
      const first = data + 0x200, second = first + 0x680;
      if (!validRecord(card, first) || !validRecord(card, second)) return null;
      const code = view.getUint32(first + 0x334, true), sequence = view.getUint32(first + 0x404, true);
      if (!code || code !== identity || code !== view.getUint32(second + 0x334, true) || sequence !== view.getUint32(second + 0x404, true) || found !== null) return null;
      found = sequence;
    }
    return found;
  }
  function alignSequence(state, card, ram) {
    const view = new DataView(state.buffer, state.byteOffset, state.byteLength);
    const identity = view.getUint32(ram + identityAddress, true);
    const sequence = readCard(card, identity);
    if (sequence === null) return { state, status: 'missing' };
    const address = ram + sequenceAddress;
    if (view.getUint32(address, true) === sequence) return { state, status: 'matched' };
    const copy = state.slice();
    new DataView(copy.buffer).setUint32(address, sequence, true);
    return { state: copy, status: 'aligned' };
  }
  function prepare(state, card) {
    const ram = identify(state);
    return ram === null ? { state, status: 'unsupported' } : alignSequence(state, card, ram);
  }
  function attach(emulator) {
    const manager = emulator.gameManager;
    if (attached.has(manager)) return;
    attached.add(manager);
    const load = manager.loadState;
    manager.loadState = function (state) {
      let result = { state, status: 'unsupported' };
      if (identify(state) !== null) {
        try { result = prepare(state, manager.getSaveFile()); }
        catch (error) { result = { state, status: 'missing' }; }
      }
      const output = load.call(this, result.state);
      const status = root.document?.querySelector('#card-restore-status');
      if (status) status.textContent = result.status === 'aligned'
        ? 'This game point is ready to save to your current slot 1 card. Your cards, deck and story were kept.'
        : result.status === 'missing' ? 'This game point needs its matching slot 1 card save before in-game saving can work.' : '';
      return output;
    };
  }
  const api = { prepare, attach };
  if (typeof module === 'object' && module.exports) module.exports = { ...api, readCard, alignSequence };
  else root.PS1StateCards = api;
})(typeof window === 'object' ? window : globalThis);
