const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const stored = new Map(), timers = new Map();
let timerId = 0, holdWrites = false, failNextWrite = false;
let writes = 0, activeWrites = 0, maxActiveWrites = 0;
const pendingCommits = [];
const db = { createObjectStore() {}, transaction() {
  const transaction = { objectStore() { return {
    get(id) { const request = {}; queueMicrotask(() => { request.result = stored.get(id); request.onsuccess(); }); return request; },
    put(save) {
      writes++;
      activeWrites++;
      maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
      const finish = () => {
        activeWrites--;
        if (failNextWrite) {
          failNextWrite = false;
          transaction.error = new Error('Storage is full');
          transaction.onerror();
        } else {
          stored.set(save.id, structuredClone(save));
          transaction.oncomplete();
        }
      };
      if (holdWrites) pendingCommits.push(finish); else queueMicrotask(finish);
    }
  }; } };
  return transaction;
} };
function surface() {
  const handlers = {}, elements = new Map();
  return {
    hidden: false, handlers,
    addEventListener(name, callback) { (handlers[name] ||= []).push(callback); },
    querySelector(id) {
      if (!elements.has(id)) elements.set(id, { hidden: id === '#resume-panel', disabled: true, textContent: '', handlers: {}, addEventListener(name, callback) { this.handlers[name] = callback; } });
      return elements.get(id);
    }
  };
}
let document = surface();
const window = surface();
const context = {
  indexedDB: { open() { const request = {}; queueMicrotask(() => { request.result = db; request.onupgradeneeded(); request.onsuccess(); }); return request; } },
  document, window, Date, Set, Promise,
  setInterval(callback) { timers.set(++timerId, callback); return timerId; },
  setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
  clearInterval(id) { timers.delete(id); }, clearTimeout(id) { timers.delete(id); },
  location: { reload() {} }
};
function emulator() {
  const calls = [], events = {};
  const audio = { state: 'interrupted', resume() { calls.push('audio'); this.state = 'running'; return Promise.resolve(); } };
  const e = {
    calls, events, started: true, paused: false, frame: 0,
    canvas: { addEventListener(name, callback) { events[name] = callback; } },
    Module: { AL: { currentCtx: { audioCtx: audio, sources: [] } }, pauseMainLoop() { calls.push('stop scheduler'); }, resumeMainLoop() { calls.push('start scheduler'); } },
    pause() { this.paused = true; calls.push('pause'); },
    play() { this.paused = false; calls.push('play'); },
    handleResize() {}, on(name, callback) { events[name] = callback; }
  };
  e.gameManager = {
    getState() { calls.push('snapshot'); return new Uint8Array([1,2,3]); },
    loadState(state) { calls.push(['restore', Array.from(state)]); },
    simulateInput(...args) { calls.push(args); },
    toggleMainLoop(value) { calls.push(['loop', value]); },
    functions: { getFrameNum() { return e.frame; } }
  };
  return e;
}
(async () => {
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, 'recovery.js'), 'utf8'), context);
  const game = emulator();
  const controller = await window.PS1Recovery.attach(game, 'test game');
  document.hidden = true;
  document.handlers.visibilitychange[0]();
  window.handlers.pagehide[0]();
  await new Promise(setImmediate);
  assert.equal(game.calls.filter(x => x === 'snapshot').length, 1);
  assert.equal(game.calls.filter(x => x === 'stop scheduler').length, 1);
  assert.equal(stored.size, 1);
  assert.equal(game.paused, true);
  document.hidden = false;
  document.handlers.visibilitychange[0]();
  assert.equal(document.querySelector('#resume-panel').hidden, false);
  document.querySelector('#resume-game').handlers.click();
  assert(game.calls.includes('audio'));
  assert(game.calls.includes('start scheduler'));
  assert.equal(game.paused, false);
  assert.equal(document.querySelector('#resume-panel').hidden, true);
  const saveButton = document.querySelector('#save-now');
  assert.equal(saveButton.disabled, false);
  const previousWrites = writes;
  const previousSnapshots = game.calls.filter(x => x === 'snapshot').length;
  holdWrites = true;
  const autoJob = controller.checkpoint();
  await new Promise(setImmediate);
  assert.equal(saveButton.disabled, true);
  assert.equal(saveButton.textContent, 'Saving…');
  const manualJob = saveButton.handlers.click();
  const repeatedManualJob = saveButton.handlers.click();
  assert.equal(manualJob, autoJob);
  assert.equal(repeatedManualJob, autoJob);
  assert.equal(writes, previousWrites + 1);
  assert.equal(game.calls.filter(x => x === 'snapshot').length, previousSnapshots + 1);
  pendingCommits.shift()();
  assert.equal(await manualJob, true);
  assert.equal(maxActiveWrites, 1);
  assert.equal(saveButton.disabled, false);
  assert.equal(saveButton.textContent, 'Save now');
  assert(document.querySelector('#recovery-status').textContent.startsWith('Saved now at '));
  holdWrites = false;
  const previousSave = stored.values().next().value;
  failNextWrite = true;
  assert.equal(await saveButton.handlers.click(), false);
  assert.equal(stored.values().next().value, previousSave);
  assert.equal(saveButton.disabled, false);
  assert(document.querySelector('#recovery-status').textContent.includes('Could not save'));
  assert.equal(await saveButton.handlers.click(), true);
  game.events.exit();
  assert.equal(saveButton.disabled, true);

  document = surface();
  context.document = document;
  const reloadedGame = emulator();
  await window.PS1Recovery.attach(reloadedGame, 'test game');
  assert.equal(document.querySelector('#resume-panel').hidden, false);
  assert.equal(document.querySelector('#resume-game').textContent, 'Restore last save');
  assert.equal(reloadedGame.paused, true);
  document.querySelector('#resume-game').handlers.click();
  assert.deepEqual(reloadedGame.calls.find(x => Array.isArray(x) && x[0] === 'restore'), ['restore', [1,2,3]]);
  assert.equal(reloadedGame.paused, false);
  const watch = [...timers.values()].at(-1);
  watch();
  assert.equal(document.querySelector('#reload-game').hidden, false);
  assert.equal(document.querySelector('#resume-game').hidden, true);
  assert(document.querySelector('#resume-message').textContent.includes('still stuck'));
  console.log('PASS: manual/auto overlap, repeated taps, one write at a time, failed-write retry, background save, resume, reload restore, and stalled-loop recovery.');
})();
