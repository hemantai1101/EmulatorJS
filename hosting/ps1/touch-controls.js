/* Direction input for the PS1 player's touch stick. */
(function (root) {
  const mouseBindings = new Set();
  function bindMouse(element, press, move, release) {
    let pointer = null, pressed = false, pressedAt = 0, timer;
    function finish(force = false) {
      root.clearTimeout(timer);
      const id = pointer;
      pointer = null;
      try { if (id !== null && element.hasPointerCapture(id)) element.releasePointerCapture(id); } catch (error) { /* The pointer may already be released. */ }
      if (!pressed) return;
      const up = () => { pressed = false; release(); };
      // Keep quick clicks visible to the game's input poll.
      const remaining = 40 - (Date.now() - pressedAt);
      if (force || remaining <= 0) up();
      else timer = root.setTimeout(up, remaining);
    }
    element.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || pointer !== null) return;
      event.preventDefault();
      root.clearTimeout(timer);
      pointer = event.pointerId;
      pressed = true;
      pressedAt = Date.now();
      try { element.setPointerCapture(pointer); } catch (error) { /* A cancelled pointer cannot be captured. */ }
      press(event);
    });
    element.addEventListener('pointermove', event => {
      if (event.pointerId !== pointer) return;
      event.preventDefault();
      if (!(event.buttons & 1)) finish();
      else if (move) move(event);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      element.addEventListener(type, event => {
        if (event.pointerId !== pointer) return;
        event.preventDefault();
        finish(type !== 'pointerup');
      });
    }
    mouseBindings.add({ element, reset: () => finish(true) });
  }
  const attached = new WeakSet();
  function savedPadOffset(state, unpolled = false) {
    if (!(state instanceof Uint8Array)) return null;
    const matches = (offset, text) => [...text].every((letter, i) => state[offset + i] === letter.charCodeAt(0));
    if (!matches(0, 'RASTATE\x01')) return null;
    const view = new DataView(state.buffer, state.byteOffset, state.byteLength);
    let coreStart, coreEnd;
    for (let chunk = 8; chunk + 8 <= state.length;) {
      const size = view.getUint32(chunk + 4, true);
      const end = chunk + 8 + size;
      if (end > state.length) return null;
      if (matches(chunk, 'MEM ') && size === 0x440000) {
        coreStart = chunk + 8;
        coreEnd = end;
        break;
      }
      if (!size) return null;
      chunk = end + (8 - size % 8) % 8;
    }
    if (coreStart === undefined || !matches(coreStart, 'STv4 PCSXra f29871d\x00') ||
        view.getUint32(coreStart + 32, true) !== 0x8b410006) return null;
    // PCSX ReARMed f29871d saves eight 112-byte PadDataS records at the end.
    let found = null;
    for (let offset = coreEnd - 0x20000; offset <= coreEnd - 8 * 112; offset++) {
      if (state[offset + 2] !== 112 || state[offset + 3] !== 0) continue;
      let valid = true;
      for (let port = 0; port < 8 && valid; port++) {
        const pad = offset + port * 112;
        valid = state[pad] <= 7 && state[pad + 1] === 0 && view.getUint16(pad + 2, true) === 112 &&
          view.getUint32(pad + 4, true) <= 1 && view.getUint32(pad + 8, true) <= 7 &&
          state[pad + 32] <= 1 && state[pad + 33] <= 1 && state[pad + 48] <= 1 && state[pad + 50] <= 1;
      }
      if (valid) {
        if (found !== null) return null;
        found = offset;
      }
    }
    if (found === null || state[found + 32] !== 0 || view.getUint32(found + 4, true) !== 0 ||
        !(unpolled ? [0, 4, 7] : [4, 7]).includes(state[found])) return null;
    for (let i = found + 8 * 112; i < coreEnd; i++) if (state[i] !== 0) return null;
    return found;
  }
  const controllers = new Map();
  const modeRequests = new WeakMap();
  let modeJob = null;
  let cancelMode = null;
  function create(send, { analog = false, radius = 80 } = {}) {
    let active = false;
    let sector = null;
    const values = [0, 0, 0, 0];
    function emit(next) {
      next.forEach((value, i) => {
        if (values[i] !== value) send(i, value);
        values[i] = value;
      });
    }
    function reset() {
      active = false;
      sector = null;
      emit([0, 0, 0, 0]);
    }
    return {
      reset,
      move(degrees, distance) {
        if (analog) {
          const deadZone = radius * .125;
          if (!Number.isFinite(degrees) || !Number.isFinite(distance) || distance <= deadZone) {
            reset();
            return;
          }
          const strength = Math.min(1, (distance - deadZone) / (radius - deadZone));
          const angle = degrees * Math.PI / 180;
          const x = Math.round(Math.cos(angle) * strength * 0x7fff);
          const y = Math.round(-Math.sin(angle) * strength * 0x7fff);
          emit([Math.max(0, x), Math.max(0, -x), Math.max(0, y), Math.max(0, -y)]);
          return;
        }
        // Separate start/stop thresholds prevent chatter at the centre edge.
        if (!Number.isFinite(degrees) || !Number.isFinite(distance) || distance < (active ? 16 : 24)) {
          reset();
          return;
        }
        active = true;
        const angle = ((degrees % 360) + 360) % 360;
        const difference = sector === null ? 180 : Math.abs(((angle - sector * 45 + 540) % 360) - 180);
        // Keep the current direction through small slips across a sector edge.
        if (difference > 30) sector = Math.round(angle / 45) % 8;
        const directions = [
          [0, 0, 0, 1], [1, 0, 0, 1], [1, 0, 0, 0], [1, 0, 1, 0],
          [0, 0, 1, 0], [0, 1, 1, 0], [0, 1, 0, 0], [0, 1, 0, 1]
        ];
        emit(directions[sector]);
      }
    };
  }
  root.PS1Touch = {
    create,
    bindMouseButton(emulator, element, input, value) {
      bindMouse(element, () => {
        element.classList.add('ejs_virtualGamepad_button_down');
        emulator.gameManager.simulateInput(0, input, value);
      }, null, () => {
        element.classList.remove('ejs_virtualGamepad_button_down');
        emulator.gameManager.simulateInput(0, input, 0);
      });
    },
    bindMouseDpad(element, update, cancel) {
      const eventForTouch = event => ({ preventDefault: () => event.preventDefault(), targetTouches: [event] });
      const move = event => update(eventForTouch(event));
      bindMouse(element, move, move, () => cancel({ preventDefault() {} }));
    },
    readAnalogMode(state) {
      const offset = savedPadOffset(state, true);
      return offset === null ? null : state[offset + 33] === 1;
    },
    getAnalogMode(emulator) {
      if (!emulator?.started || root.document?.hidden) return null;
      try { return root.PS1Touch.readAnalogMode(emulator.gameManager.getState()); }
      catch (error) { return null; }
    },
    setAnalogMode(emulator, enabled) {
      let request = modeRequests.get(emulator);
      if (!request) { request = {}; modeRequests.set(emulator, request); }
      request.enabled = enabled;
      if (request.job) return request.job;
      request.job = Promise.resolve().then(async () => {
        if (modeJob) await modeJob;
        for (;;) {
          const wanted = request.enabled;
          const current = root.PS1Touch.getAnalogMode(emulator);
          if (current === null || current === wanted) return current;
          await root.PS1Touch.toggleAnalog(emulator);
          if (wanted !== request.enabled) continue;
          return root.PS1Touch.getAnalogMode(emulator);
        }
      }).finally(() => { request.job = null; });
      return request.job;
    },
    prepareState(state, analog = root.document?.body?.dataset.directionMode !== 'dpad') {
      if (!analog) return state;
      const offset = savedPadOffset(state);
      if (offset === null || state[offset + 33] !== 0) return state;
      const copy = new Uint8Array(state);
      copy[offset + 33] = 1;
      copy[offset + 50] = 1;
      return copy;
    },
    attach(emulator) {
      const manager = emulator.gameManager;
      if (attached.has(manager)) return;
      attached.add(manager);
      const load = manager.loadState;
      manager.loadState = function (state) {
        root.PS1Touch.reset();
        const result = load.call(this, root.PS1Touch.prepareState(state));
        if (root.dispatchEvent) root.dispatchEvent(new root.Event('ps1-state-loaded'));
        return result;
      };
      if (typeof emulator.play === 'function') {
        const play = emulator.play;
        emulator.play = function (...args) {
          const result = play.apply(this, args);
          if (root.dispatchEvent) root.dispatchEvent(new root.Event('ps1-game-resumed'));
          return result;
        };
      }
    },
    toggleAnalog(emulator) {
      if (modeJob) return modeJob;
      if (!emulator?.started || emulator.paused || root.document?.hidden) {
        return Promise.reject(new Error('Resume the game, then try again.'));
      }
      root.PS1Touch.reset();
      const manager = emulator.gameManager;
      const option = 'pcsx_rearmed_analog_combo';
      const previous = emulator.getSettingValue(option) || 'l1+r1+select';
      let cancelled = false;
      const cleanup = () => {
        manager.simulateInput(0, 14, 0);
        manager.simulateInput(0, 15, 0);
        manager.functions.setVariable(option, previous);
      };
      cancelMode = () => { cancelled = true; cleanup(); };
      const frames = () => new Promise((resolve, reject) => {
        const start = manager.functions.getFrameNum();
        const deadline = Date.now() + 2000;
        const poll = () => {
          if (cancelled || emulator.paused || root.document?.hidden) {
            reject(new Error('Resume the game, then try again.'));
          } else if (manager.functions.getFrameNum() - start >= 2) {
            resolve();
          } else if (Date.now() >= deadline) {
            reject(new Error('The game did not respond. Try again after resuming.'));
          } else {
            root.setTimeout(poll, 16);
          }
        };
        poll();
      });
      modeJob = (async () => {
        try {
          for (let i = 0; i < 16; i++) manager.simulateInput(0, i, 0);
          manager.functions.setVariable(option, 'l3+r3');
          await frames();
          manager.simulateInput(0, 14, 1);
          manager.simulateInput(0, 15, 1);
          await frames();
        } finally {
          cleanup();
          cancelMode = null;
        }
      })().finally(() => { modeJob = null; });
      return modeJob;
    },
    handle(manager, zone, info) {
      let controller = controllers.get(zone);
      if (!controller) {
        controller = create((i, value) => manager.simulateInput(0, zone.inputValues[i], value), {
          analog: zone.joystickInput === true,
          radius: (zone.size || 100) / 2
        });
        controllers.set(zone, controller);
      }
      if (info && root.document?.body?.dataset.directionMode !== 'dpad') controller.move(info.angle.degree, info.distance);
      else controller.reset();
    },
    reset() {
      controllers.forEach(controller => controller.reset());
      mouseBindings.forEach(binding => {
        binding.reset();
        if (binding.element.isConnected === false) mouseBindings.delete(binding);
      });
      if (cancelMode) cancelMode();
    }
  };
  if (root.addEventListener) {
    root.addEventListener('blur', () => root.PS1Touch.reset());
    root.addEventListener('pagehide', () => root.PS1Touch.reset());
    root.document.addEventListener('visibilitychange', () => {
      if (root.document.hidden) root.PS1Touch.reset();
    });
  }
})(typeof window === 'undefined' ? globalThis : window);
