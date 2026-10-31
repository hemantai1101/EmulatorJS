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
    createElement() { return {}; },
    addEventListener(name, callback) { (handlers[name] ||= []).push(callback); },
    querySelector(id) {
      if (!elements.has(id)) elements.set(id, { hidden: id === '#resume-panel', disabled: true, textContent: '', handlers: {}, value: '', children: [], replaceChildren() { this.children = []; }, append(child) { this.children.push(child); }, addEventListener(name, callback) { this.handlers[name] = callback; } });
      return elements.get(id);
    }
  };
}
let clockNow = Date.now();
class TestDate extends Date { static now() { return clockNow; } }
let document = surface();
const window = surface();
const downloads = [];
window.PS1Saves = { download(state, name) { downloads.push({ state: Array.from(state), name }); }, close() {} };
const context = {
  indexedDB: { open() { const request = {}; queueMicrotask(() => { request.result = db; request.onupgradeneeded(); request.onsuccess(); }); return request; } },
  document, window, Date: TestDate, Set, Promise,
  setInterval(callback, delay) { assert.equal(delay, 300000); timers.set(++timerId, callback); return timerId; },
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
  assert.equal(document.querySelector('#save-now-label').textContent, 'Saving state…');
  assert.equal(document.querySelector('#local-saves').disabled, true);
  assert.equal(document.querySelector('#restore-local').disabled, true);
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
  assert.equal(document.querySelector('#save-now-label').textContent, 'Save state now');
  assert(document.querySelector('#recovery-status').textContent.startsWith('State saved at '));
  holdWrites = false;
  const previousSave = stored.values().next().value;
  failNextWrite = true;
  assert.equal(await saveButton.handlers.click(), false);
  assert.equal(stored.values().next().value, previousSave);
  assert.equal(saveButton.disabled, false);
  assert(document.querySelector('#recovery-status').textContent.includes('Could not save'));
  assert.equal(await saveButton.handlers.click(), true);
  const beforeLeave = writes;
  document.hidden = true;
  document.handlers.visibilitychange[0]();
  await new Promise(setImmediate);
  assert.equal(writes, beforeLeave, 'quick backgrounding must not fill history');
  document.hidden = false;
  document.handlers.visibilitychange[0]();
  document.querySelector('#resume-game').handlers.click();
  const interval = [...timers.values()][0];
  interval();
  await new Promise(setImmediate);
  assert.equal(writes, beforeLeave, 'auto-save waits five minutes');
  clockNow += 300000;
  interval();
  await new Promise(setImmediate);
  assert.equal(writes, beforeLeave + 1, 'auto-save runs after five minutes');
  const picker = document.querySelector('#local-saves');
  assert.equal(picker.value, '0', 'auto-save follows the latest point by default');
  picker.value = '1';
  const chosenStamp = picker.children[1].textContent;
  clockNow += 300000;
  interval();
  await new Promise(setImmediate);
  assert.equal(picker.value, '2', 'auto-save keeps a chosen older point');
  assert.equal(picker.children[Number(picker.value)].textContent, chosenStamp);
  assert.equal(await saveButton.handlers.click(), true);
  assert.equal(picker.value, '0', 'Save now selects the point it just made');
  clockNow += 300000;
  interval();
  await new Promise(setImmediate);
  assert.equal(picker.value, '0', 'later auto-saves keep following latest');
  picker.value = '1';
  holdWrites = true;
  const pinnedAutoJob = controller.checkpoint();
  await new Promise(setImmediate);
  const pinnedManualJob = saveButton.handlers.click();
  assert.equal(pinnedManualJob, pinnedAutoJob);
  pendingCommits.shift()();
  await pinnedManualJob;
  assert.equal(picker.value, '0', 'Save now selects latest even when joining an auto-save');
  holdWrites = false;
  for (let i = 0; i < 10; i++) await controller.checkpoint();
  picker.value = '9';
  await controller.checkpoint();
  assert.equal(picker.value, '0', 'a chosen point that ages out falls back to latest');
  for (let point = 0; point < 12; point++) {
    clockNow += 1000;
    game.gameManager.getState = () => new Uint8Array([point]);
    assert.equal(await saveButton.handlers.click(), true);
  }
  const history = stored.values().next().value;
  assert.equal(history.history.length, 9);
  assert.deepEqual(Array.from(history.state), [11]);
  assert.deepEqual(Array.from(history.history.at(-1).state), [2]);
  assert.equal(document.querySelector('#local-saves').children.length, 10);
  document.querySelector('#local-saves').value = '9';
  const beforeExport = writes;
  document.querySelector('#export-local').handlers.click();
  assert.deepEqual(downloads.at(-1).state, [2]);
  assert(downloads.at(-1).name.endsWith('.state'));
  assert.equal(writes, beforeExport, 'exporting an old point must not write or capture a new save');
  document.querySelector('#restore-local').handlers.click();
  assert.deepEqual(game.calls.filter(x => Array.isArray(x) && x[0] === 'restore').at(-1), ['restore', [2]]);
  assert.equal(stored.values().next().value, history, 'loading must not write a save');
  failNextWrite = true;
  assert.equal(await saveButton.handlers.click(), false);
  assert.equal(stored.values().next().value, history, 'a full-store failure must keep all ten saves');
  assert.equal(document.querySelector('#local-saves').children.length, 10);
  assert.equal(picker.value, '9', 'a failed manual save keeps the chosen point');
  const otherId = 'pcsx_rearmed-4.2.3:other game';
  stored.set(otherId, { id: otherId, state: new Uint8Array([99]), savedAt: 1 });
  game.events.exit();
  assert.equal(saveButton.disabled, true);

  document = surface();
  context.document = document;
  const reloadedGame = emulator();
  await window.PS1Recovery.attach(reloadedGame, 'test game');
  assert.equal(document.querySelector('#resume-panel').hidden, false);
  assert.equal(document.querySelector('#resume-game').textContent, 'Restore selected state');
  assert.equal(reloadedGame.paused, true);
  const beforeRestore = writes;
  for (const callback of timers.values()) callback();
  await new Promise(setImmediate);
  assert.equal(writes, beforeRestore, 'no auto-save before choosing restore or start fresh');
  document.querySelector('#resume-save').value = '8';
  document.querySelector('#resume-game').handlers.click();
  assert.deepEqual(reloadedGame.calls.find(x => Array.isArray(x) && x[0] === 'restore'), ['restore', [3]]);
  assert.equal(reloadedGame.paused, false);
  const watch = [...timers.values()].at(-1);
  watch();
  assert.equal(document.querySelector('#reload-game').hidden, false);
  assert.equal(document.querySelector('#resume-game').hidden, true);
  assert(document.querySelector('#resume-message').textContent.includes('still stuck'));
  reloadedGame.events.exit();
  document = surface();
  context.document = document;
  const legacyGame = emulator();
  await window.PS1Recovery.attach(legacyGame, 'other game');
  assert.equal(document.querySelector('#local-saves').children.length, 1);
  document.querySelector('#resume-game').handlers.click();
  assert.deepEqual(legacyGame.calls.find(x => Array.isArray(x) && x[0] === 'restore'), ['restore', [99]]);
  assert.equal(await document.querySelector('#save-now').handlers.click(), true);
  assert.deepEqual(Array.from(stored.get(otherId).history[0].state), [99]);
  assert.equal(stored.get(history.id), history, 'another game must keep its own history');
  legacyGame.events.exit();
  console.log('PASS: ten-save retention, older selection, five-minute interval, quick backgrounding, legacy save kept, per-game isolation; manual/auto overlap, repeated taps, one write at a time, failed-write retry, background save, resume, reload restore, and stalled-loop recovery.');
})();
