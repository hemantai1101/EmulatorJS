const assert = require('node:assert/strict');
require('./touch-controls.js');
const events = [];
const state = [0, 0, 0, 0];
const stick = PS1Touch.create((i, value) => { events.push([i, value]); state[i] = value; });
const expect = value => assert.deepEqual(state, value);
for (let angle = 0; angle < 360; angle += 5) stick.move(angle, 23);
expect([0, 0, 0, 0]);
assert.equal(events.length, 0, 'Tiny drags never send a direction');
stick.move(0, 24); expect([0, 0, 0, 1]);
stick.move(24, 40); expect([0, 0, 0, 1]);
stick.move(29, 40); expect([0, 0, 0, 1]);
stick.move(31, 40); expect([1, 0, 0, 1]);
stick.move(21, 40); expect([1, 0, 0, 1]);
stick.move(14, 40); expect([0, 0, 0, 1]);
stick.move(0, 18); expect([0, 0, 0, 1]);
stick.move(0, 15); expect([0, 0, 0, 0]);
stick.move(0, 20); expect([0, 0, 0, 0]);
const sectors = [[0,0,0,1],[1,0,0,1],[1,0,0,0],[1,0,1,0],[0,0,1,0],[0,1,1,0],[0,1,0,0],[0,1,0,1]];
sectors.forEach((value, i) => { stick.reset(); stick.move(i * 45, 70); expect(value); });
stick.move(359, 70); expect([0,0,0,1]);
stick.move(1, 70); expect([0,0,0,1]);
stick.move(180, 70); expect([0,0,1,0]);
stick.reset(); expect([0,0,0,0]);
stick.move(NaN, 70); expect([0,0,0,0]);
const inputs = [];
const manager = { simulateInput: (...args) => inputs.push(args) };
const zone = {inputValues: [4,5,6,7]};
PS1Touch.handle(manager, zone, {angle:{degree:90}, distance:40});
assert.deepEqual(inputs.pop(), [0,4,1]);
PS1Touch.handle(manager, zone);
assert.deepEqual(inputs.pop(), [0,4,0]);
PS1Touch.handle(manager, zone, {angle:{degree:180}, distance:40});
PS1Touch.reset();
assert.deepEqual(inputs.slice(-2), [[0,6,1],[0,6,0]]);
// Run the hooks extracted from the exact shipped engine with a mock joystick.
const fs = require('node:fs');
const code = fs.readFileSync(__dirname + '/public/data/emulator.min.js','utf8');
const start = code.indexOf('const n=nipplejs.create(');
const end = code.indexOf('})),', start + 100);
assert.ok(start > 0 && end > start);
const block = code.slice(start, end + 3) + ';';
const handlers = {};
let options;
const nipplejs = {create(config) { options = config; return {on(name, callback) {handlers[name] = callback;}}; }};
zone.ps1Touch = true; zone.size = 160;
new Function('nipplejs','t','i','window', block).call({gameManager:manager}, nipplejs, zone, {}, {PS1Touch});
assert.equal(options.size,160);
handlers.end();
const moveStart = code.indexOf('n.on("move",((e,i)=>{', start) + 'n.on("move",((e,i)=>{'.length;
const moveEnd = code.indexOf('const n=i.angle.degree', moveStart);
const moveHook = new Function('t','i','window', code.slice(moveStart, moveEnd));
moveHook.call({gameManager:manager}, zone, {angle:{degree:270},distance:23}, {PS1Touch});
assert.equal(inputs.at(-1)[2], 0);
moveHook.call({gameManager:manager}, zone, {angle:{degree:270},distance:40}, {PS1Touch});
assert.deepEqual(inputs.at(-1), [0,5,1]);
handlers.end();
assert.deepEqual(inputs.at(-1), [0,5,0]);
const analogValues = [0, 0, 0, 0];
const analog = PS1Touch.create((i, value) => { analogValues[i] = value; }, { analog: true });
analog.move(0, 10);
assert.deepEqual(analogValues, [0, 0, 0, 0]);
analog.move(0, 27.5);
assert.deepEqual(analogValues, [8192, 0, 0, 0], 'quarter strength');
analog.move(0, 45);
assert.deepEqual(analogValues, [16384, 0, 0, 0], 'half strength');
analog.move(0, 80);
assert.deepEqual(analogValues, [32767, 0, 0, 0], 'full strength');
analog.move(0, 160);
assert.deepEqual(analogValues, [32767, 0, 0, 0], 'outside drags stay in range');
analog.move(180, 80);
assert.deepEqual(analogValues, [0, 32767, 0, 0], 'opposite direction releases right');
analog.move(90, 80);
assert.deepEqual(analogValues, [0, 0, 0, 32767], 'up uses negative Y');
analog.move(270, 80);
assert.deepEqual(analogValues, [0, 0, 32767, 0], 'down uses positive Y');
analog.move(45, 80);
assert.deepEqual(analogValues, [23170, 0, 0, 23170], 'diagonals keep a circular range');
analog.move(20, 80);
assert.ok(analogValues[0] > 23170 && analogValues[3] > 0 && analogValues[3] < 23170, 'angles are continuous');
for (const [angle, distance] of [[NaN, 50], [0, Infinity], [0, 0], [0, -20]]) {
  analog.move(90, 50);
  analog.move(angle, distance);
  assert.deepEqual(analogValues, [0, 0, 0, 0], 'invalid and centre input releases all axes');
}
const analogZone = { ps1Touch: true, joystickInput: true, size: 160, inputValues: [16, 17, 18, 19] };
moveHook.call({gameManager:manager}, analogZone, {angle:{degree:0},distance:45}, {PS1Touch});
assert.deepEqual(inputs.at(-1), [0,16,16384], 'shipped move hook reaches analog axis');
PS1Touch.reset();
assert.deepEqual(inputs.at(-1), [0,16,0], 'shared reset releases analog axis');

const vm = require('node:vm');
const listeners = {};
const window = { addEventListener(type, fn) { listeners[type] = fn; }, document: {
  body: { dataset: { directionMode: 'stick' } }, hidden: false,
  addEventListener(type, fn) { listeners[type] = fn; }
} };
vm.runInNewContext(fs.readFileSync(__dirname + '/touch-controls.js', 'utf8'), { window });
for (const event of ['blur', 'pagehide', 'visibilitychange']) {
  window.PS1Touch.handle(manager, analogZone, { angle: { degree: 0 }, distance: 80 });
  window.document.hidden = true;
  listeners[event]();
  assert.deepEqual(inputs.at(-1), [0,16,0], event + ' releases analog input');
}
window.document.body.dataset.directionMode = 'dpad';
const before = inputs.length;
window.PS1Touch.handle(manager, analogZone, { angle: { degree: 0 }, distance: 80 });
assert.equal(inputs.length, before, 'hidden stick cannot send input in arrow mode');

for (const file of ['data/src/emulator.js', 'data/emulator.min.js']) {
  const engine = fs.readFileSync(__dirname + '/public/' + file, 'utf8');
  const body = file.endsWith('.min.js')
    ? engine.match(/startGame\(\)\{try\{(const t=\[\];.*?)this\.Module\.callMain\(t\)/s)[1].replace('if(this.debug&&t.push("-v"),', 'this.debug&&t.push("-v");') + 'this.Module.callMain(t);'
    : engine.match(/startGame\(\) \{\s*try \{([\s\S]*?)this\.Module\.callMain\(args\)/)[1] + 'this.Module.callMain(args);';
  for (const core of ['pcsx_rearmed', 'other']) {
    let args;
    new Function(body).call({ getCore: () => core, fileName: 'test.exe', Module: { callMain(value) { args = value; } } });
    assert.deepEqual(args, core === 'pcsx_rearmed' ? ['--device=1:517', '/test.exe'] : ['/test.exe'], file + ' controller startup');
  }
}
function checkMouseControls() {
  let now = 0, nextTimer = 0;
  const timers = new Map(), hooks = {}, sent = [];
  const window = {
    clearTimeout: id => timers.delete(id),
    setTimeout: (fn, delay) => { timers.set(++nextTimer, { fn, at: now + delay }); return nextTimer; },
    addEventListener: (type, fn) => { hooks[type] = fn; },
    document: { body: { dataset: {} }, addEventListener() {} }
  };
  vm.runInNewContext(fs.readFileSync(__dirname + '/touch-controls.js', 'utf8'), { window, Date: { now: () => now } });
  const touch = window.PS1Touch;
  function element() {
    const handlers = {}, classes = new Set(), captured = new Set();
    return {
      isConnected: true, classes,
      classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
      addEventListener: (type, fn) => { handlers[type] = fn; },
      setPointerCapture: id => captured.add(id), hasPointerCapture: id => captured.has(id),
      releasePointerCapture: id => captured.delete(id),
      fire(type, values = {}) {
        handlers[type]?.({ type, pointerType: 'mouse', button: 0, buttons: 1, pointerId: 1, preventDefault() {}, ...values });
      }
    };
  }
  function tick(ms) {
    now += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); }
  }
  const button = element();
  const emulator = {};
  touch.bindMouseButton(emulator, button, 0, 1);
  emulator.gameManager = { simulateInput: (...args) => sent.push(args) };
  button.fire('pointerdown', { pointerType: 'touch' });
  button.fire('pointerdown', { pointerType: 'pen' });
  button.fire('pointerdown', { button: 2 });
  assert.deepEqual(sent, [], 'touch, pen and secondary buttons do not produce extra mouse input');
  button.fire('pointerdown');
  assert.deepEqual(sent, [[0, 0, 1]], 'left mouse press reaches the game');
  assert(button.classes.has('ejs_virtualGamepad_button_down'));
  button.fire('pointerup', { pointerId: 2 });
  assert.equal(sent.length, 1, 'another pointer cannot release this button');
  tick(100); button.fire('pointerup');
  assert.deepEqual(sent.at(-1), [0, 0, 0], 'a held button releases on mouse up');
  assert(!button.classes.has('ejs_virtualGamepad_button_down'));
  sent.length = 0;
  button.fire('pointerdown'); button.fire('pointerup');
  assert.deepEqual(sent, [[0, 0, 1]], 'a quick click lasts long enough for a core input poll');
  tick(39); assert.equal(sent.length, 1);
  tick(1); assert.deepEqual(sent.at(-1), [0, 0, 0]);
  for (const cancel of ['pointercancel', 'lostpointercapture']) {
    button.fire('pointerdown'); button.fire(cancel);
    assert.deepEqual(sent.at(-1), [0, 0, 0], cancel + ' releases immediately');
  }
  button.fire('pointerdown'); button.fire('pointerup'); hooks.blur();
  assert.deepEqual(sent.at(-1), [0, 0, 0], 'blur clears even a pending short-click release');
  const before = sent.length; tick(100);
  assert.equal(sent.length, before, 'reset leaves no delayed extra release');
  button.fire('pointerdown'); button.fire('pointermove', { buttons: 0 }); tick(40);
  assert.deepEqual(sent.at(-1), [0, 0, 0], 'loss of the left mouse button releases input');
  const dpad = element(), positions = [];
  let releases = 0;
  touch.bindMouseDpad(dpad, event => positions.push([event.targetTouches[0].clientX, event.targetTouches[0].clientY]), () => { releases++; });
  dpad.fire('pointerdown', { clientX: 10, clientY: 20 });
  dpad.fire('pointermove', { clientX: 30, clientY: 40 });
  assert.deepEqual(positions, [[10, 20], [30, 40]], 'mouse coordinates reach the existing arrow geometry');
  dpad.fire('pointercancel'); assert.equal(releases, 1);
  dpad.fire('pointerdown', { clientX: 50, clientY: 60 }); touch.reset();
  assert.equal(releases, 2, 'shared reset releases arrows too');
}
checkMouseControls();
function checkSavedAnalogMode() {
  const state = new Uint8Array(8 + 8 + 0x440000 + 8);
  const view = new DataView(state.buffer);
  const text = (offset, value) => state.set(Buffer.from(value, 'binary'), offset);
  text(0, 'RASTATE\x01'); text(8, 'MEM '); view.setUint32(12, 0x440000, true);
  text(16, 'STv4 PCSXra f29871d\x00'); view.setUint32(48, 0x8b410006, true);
  text(state.length - 8, 'END ');
  const offset = 16 + 0x440000 - 10001;
  for (let port = 0; port < 8; port++) {
    const pad = offset + port * 112;
    state[pad] = port === 0 ? 7 : 4;
    view.setUint16(pad + 2, 112, true);
    view.setUint32(pad + 8, port, true);
  }
  assert.equal(PS1Touch.readAnalogMode(state), false, 'the real digital mode is read');
  state[offset + 33] = 1;
  assert.equal(PS1Touch.readAnalogMode(state), true, 'the real analog mode is read');
  state[offset + 33] = 0;
  assert.equal(PS1Touch.getAnalogMode({ started: true, gameManager: { getState: () => state } }), false);
  assert.equal(PS1Touch.getAnalogMode({ started: false }), null, 'not started is Unknown');
  assert.equal(PS1Touch.getAnalogMode({ started: true, gameManager: { getState() { throw Error('unavailable'); } } }), null, 'failed snapshots are Unknown');
  assert.equal(PS1Touch.readAnalogMode(new Uint8Array()), null, 'unrecognized state is Unknown');
  const original = new Uint8Array(state);
  const enabled = PS1Touch.prepareState(state);
  assert.notEqual(enabled, state, 'digital-mode restore gets a separate input buffer');
  assert.equal(enabled[offset + 33], 1, 'restore enables actual PS1 analog mode');
  assert.equal(enabled[offset + 50], 1, 'restore records the analog-button choice');
  assert.deepEqual(state, original, 'the stored save bytes stay unchanged');
  enabled[offset + 33] = enabled[offset + 50] = 0;
  assert.deepEqual(enabled, state, 'only the two controller flags differ');
  assert.equal(PS1Touch.prepareState(state, false), state, 'arrow selection keeps saved mode');
  state[offset + 33] = 1;
  assert.equal(PS1Touch.prepareState(state), state, 'an enabled controller stays enabled without a copy');
  state[offset + 33] = 0;
  state[offset] = 4;
  assert.equal(PS1Touch.prepareState(state)[offset + 33], 1, 'old standard-controller saves support the selected stick');
  state[offset] = 5;
  assert.equal(PS1Touch.prepareState(state), state, 'other controller types stay unchanged');
  state[offset] = 7;
  for (const [at, value] of [[0, 0], [33, 0], [48, 0], [offset + 2, 111], [offset + 4, 1], [offset + 32, 1], [offset + 112 + 2, 111], [offset + 8 * 112 + 10, 1]]) {
    const old = state[at]; state[at] = value;
    assert.equal(PS1Touch.prepareState(state), state, 'unknown format, multitap and partial controller data stay unchanged');
    state[at] = old;
  }
  for (const value of [null, new Uint8Array(0), state.subarray(0, 100)]) {
    assert.equal(PS1Touch.prepareState(value), value, 'short or missing state is left to the normal loader');
  }
  const duplicate = offset - 112 * 8;
  state.set(state.subarray(offset, offset + 112 * 8), duplicate);
  assert.equal(PS1Touch.prepareState(state), state, 'ambiguous controller blocks stay unchanged');
  state.fill(0, duplicate, offset);
  let loaded, target;
  const emulator = { gameManager: { loadState(value) { loaded = value; target = this; return 12; } } };
  PS1Touch.attach(emulator);
  const wrapped = emulator.gameManager.loadState;
  PS1Touch.attach(emulator);
  assert.equal(emulator.gameManager.loadState, wrapped, 'the restore hook attaches once');
  assert.equal(wrapped.call(emulator.gameManager, state), 12, 'the normal loader return value is kept');
  assert.equal(target, emulator.gameManager, 'the normal loader keeps its receiver');
  assert.equal(loaded[offset + 33], 1, 'the real restore hook passes analog mode to the loader');
  assert.deepEqual(state, original, 'the restore hook preserves the original save');
}
checkSavedAnalogMode();
async function checkModeSelection() {
  const get = PS1Touch.getAnalogMode, toggle = PS1Touch.toggleAnalog;
  let mode = false, pulses = 0, release;
  const emulator = {};
  PS1Touch.getAnalogMode = () => mode;
  PS1Touch.toggleAnalog = async () => { pulses++; await new Promise(resolve => { release = resolve; }); mode = !mode; };
  try {
    const first = PS1Touch.setAnalogMode(emulator, true);
    await Promise.resolve();
    const latest = PS1Touch.setAnalogMode(emulator, false);
    assert.equal(first, latest, 'rapid opposite choices share one serialized job');
    release(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(pulses, 2, 'the final requested choice is applied after an active pulse');
    release(); assert.equal(await first, false);
    assert.equal(await PS1Touch.setAnalogMode(emulator, false), false);
    assert.equal(pulses, 2, 'an already matching mode receives no extra toggle');
    mode = null;
    assert.equal(await PS1Touch.setAnalogMode(emulator, true), null);
    assert.equal(pulses, 2, 'Unknown is never blindly toggled');
  } finally { PS1Touch.getAnalogMode = get; PS1Touch.toggleAnalog = toggle; }
}
async function checkAnalogSwitch() {
  await checkModeSelection();
  const buttons = [];
  const options = [];
  let frame = 0;
  const emulator = {
    started: true, paused: false, getSettingValue: () => 'disabled',
    gameManager: {
      simulateInput: (player, input, value) => buttons.push([input, value]),
      functions: {
        getFrameNum: () => frame++,
        setVariable: (key, value) => options.push([key, value])
      }
    }
  };
  const first = PS1Touch.toggleAnalog(emulator);
  assert.equal(PS1Touch.toggleAnalog(emulator), first, 'repeated taps share one mode pulse');
  await first;
  assert.deepEqual(buttons.filter(([,value]) => value), [[14,1],[15,1]], 'only L3/R3 reach the toggle combo');
  assert.deepEqual(buttons.slice(-2), [[14,0],[15,0]], 'combo is released');
  assert.deepEqual(options, [['pcsx_rearmed_analog_combo','l3+r3'],['pcsx_rearmed_analog_combo','disabled']], 'original core choice is restored');
  const count = buttons.length;
  emulator.paused = true;
  await assert.rejects(PS1Touch.toggleAnalog(emulator), /Resume the game/);
  assert.equal(buttons.length, count, 'a paused game receives no input');
  emulator.paused = false;
  emulator.gameManager.functions.getFrameNum = () => 0;
  const cancelled = PS1Touch.toggleAnalog(emulator);
  PS1Touch.reset();
  assert.deepEqual(buttons.slice(-2), [[14,0],[15,0]], 'background reset releases combo immediately');
  await assert.rejects(cancelled, /Resume the game/);
  let now = 0;
  window.document.hidden = false;
  window.setTimeout = callback => { now += 16; queueMicrotask(callback); };
  vm.runInNewContext(fs.readFileSync(__dirname + '/touch-controls.js', 'utf8'), { window, Date: { now: () => now } });
  await assert.rejects(window.PS1Touch.toggleAnalog(emulator), /did not respond/);
  assert.deepEqual(buttons.slice(-2), [[14,0],[15,0]], 'a stalled game leaves no combo held');
  console.log('Touch checks passed: analog strength/axes/dead zone/clamp, digital fallback, release, mode/background reset, shipped hooks, DualShock startup, single-flight mode switch/cleanup/timeout, guarded saved-controller mode restore without changing stored saves, mouse hold/click/release/cancel/blur and arrow geometry.');
}
checkAnalogSwitch().catch(error => { console.error(error); process.exitCode = 1; });
