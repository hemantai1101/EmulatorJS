(function () {
  const SAVE_INTERVAL = 5 * 60 * 1000;
  const SAVE_LIMIT = 10;
  const database = new Promise((resolve, reject) => {
    const request = indexedDB.open('ps1-player-recovery', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('states', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Save storage is busy.'));
  });
  database.catch(() => {});

  async function readSave(id) {
    const db = await database;
    return new Promise((resolve, reject) => {
      const request = db.transaction('states').objectStore('states').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  // Writes the auto list and, when given, the named list in one transaction
  async function writeSave(id, saves, named) {
    const db = await database;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('states', 'readwrite');
      const store = transaction.objectStore('states');
      if (saves) {
        if (saves.length) store.put({ ...saves[0], id, history: saves.slice(1) });
        else store.delete(id);
      }
      if (named) store.put({ id: 'named:' + id, named });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
  function fileName(text) {
    return text.replace(/[^a-z0-9 _-]/gi, '_');
  }

  window.PS1Recovery = {
    async attach(emulator, gameName) {
      const panel = document.querySelector('#resume-panel');
      const message = document.querySelector('#resume-message');
      const resume = document.querySelector('#resume-game');
      const centerPlay = document.querySelector('#center-play');
      const reload = document.querySelector('#reload-game');
      const restore = document.querySelector('#restore-local');
      const saveNow = document.querySelector('#save-now');
      const saveLabel = document.querySelector('#save-now-label');
      const savePicker = document.querySelector('#local-saves');
      const exportSave = document.querySelector('#export-local');
      const status = document.querySelector('#recovery-status');
      const autoToggle = document.querySelector('#auto-save');
      const keepNamed = document.querySelector('#name-local');
      const saveNamed = document.querySelector('#save-named');
      const namedPicker = document.querySelector('#named-saves');
      const loadNamed = document.querySelector('#load-named');
      const renameNamed = document.querySelector('#rename-named');
      const exportNamed = document.querySelector('#export-named');
      const deleteNamed = document.querySelector('#delete-named');
      const id = 'pcsx_rearmed-4.2.3:' + gameName;
      let saves = [], named = [];
      let queue = Promise.resolve(), namedBusy = false;
      function enqueue(job) {
        const result = queue.then(job);
        queue = result.catch(() => {});
        return result;
      }
      let lastSave, backgrounded = false, schedulerPaused = false;
      let ready = false, pendingSave = null, manualRequested = false;
      let active = true, failedRecovery = false;
      let timer, watchdog, restoreOnResume = false;
      let resuming = false;
      const originalPlay = emulator.play;
      const originalPause = emulator.pause;
      const play = function (...args) {
        if (!resuming && active && (backgrounded || schedulerPaused)) {
          if (!failedRecovery) resumeEngine();
          return;
        }
        const result = originalPlay.apply(this, args);
        updateResumeButton();
        return result;
      };
      const pause = function (...args) {
        const result = originalPause.apply(this, args);
        updateResumeButton();
        return result;
      };
      emulator.play = play;
      emulator.pause = pause;
      function updateResumeButton() {
        resume.hidden = !active || !ready || failedRecovery || !panel.hidden;
        const label = emulator.paused ? 'Resume game' : 'Pause game';
        resume.dataset.paused = String(!!emulator.paused);
        resume.setAttribute('aria-label', label);
        resume.title = label;
        if (centerPlay) centerPlay.hidden = resume.hidden || !emulator.paused;
      }

      function releaseButtons() {
        for (let input = 0; input < 16; input++) emulator.gameManager.simulateInput(0, input, 0);
      }
      function pauseEngine() {
        releaseButtons();
        emulator.pause();
        if (!schedulerPaused && emulator.Module.pauseMainLoop) {
          emulator.Module.pauseMainLoop();
          schedulerPaused = true;
        }
      }
      function showPanel(text, failed = false) {
        failedRecovery = failed;
        message.textContent = text;
        reload.hidden = !failed;
        panel.hidden = false;
        updateSaveButton();
      }
      function updateSaveList(selected) {
        savePicker.replaceChildren();
        if (!saves.length) {
          const option = document.createElement('option');
          option.textContent = 'No states yet';
          savePicker.append(option);
        }
        saves.forEach((save, index) => {
          const option = document.createElement('option');
          option.value = String(index);
          option.textContent = new Date(save.savedAt).toLocaleString() + (index === 0 ? ' (latest)' : '');
          savePicker.append(option);
        });
        const index = selected ? saves.indexOf(selected) : 0;
        savePicker.value = String(Math.max(0, index));
      }
      function updateNamedList(selected) {
        if (!namedPicker) return;
        namedPicker.replaceChildren();
        if (!named.length) {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = 'No named states yet';
          namedPicker.append(option);
        }
        named.forEach((save, index) => {
          const option = document.createElement('option');
          option.value = String(index);
          option.textContent = save.name + ' · ' + new Date(save.savedAt).toLocaleString();
          namedPicker.append(option);
        });
        const index = selected ? named.indexOf(selected) : 0;
        namedPicker.value = named.length ? String(Math.max(0, index)) : '';
      }
      function askName(current) {
        const answer = window.prompt('Name this state', current);
        if (answer === null || answer === undefined) return null;
        const name = String(answer).trim().slice(0, 60);
        if (!name) {
          status.textContent = 'A named state needs a name.';
          return null;
        }
        return name;
      }

      function updateSaveButton() {
        updateResumeButton();
        saveNow.disabled = !!pendingSave || !active || !ready || failedRecovery || !panel.hidden;
        saveLabel.textContent = saveNow.title = pendingSave ? 'Saving state…' : 'Save state now';
        const busy = !!pendingSave || namedBusy;
        exportSave.disabled = !active || !saves.length || busy;
        restore.disabled = savePicker.disabled = !active || !saves.length || busy;
        if (keepNamed) keepNamed.disabled = !active || !saves.length || busy;
        if (saveNamed) saveNamed.disabled = busy || !active || !ready || failedRecovery || !panel.hidden;
        if (namedPicker) {
          namedPicker.disabled = !active || !named.length || busy;
          for (const button of [loadNamed, renameNamed, exportNamed, deleteNamed]) button.disabled = namedPicker.disabled;
        }
      }
      function checkpoint(allowPaused = false, manual = false) {
        if (!active || !ready || failedRecovery || (emulator.paused && !allowPaused) || !panel.hidden) return Promise.resolve(false);
        if (pendingSave) {
          manualRequested = manualRequested || manual;
          return pendingSave;
        }
        let save;
        manualRequested = manual;
        saveNow.disabled = true;
        saveLabel.textContent = saveNow.title = 'Saving state…';
        try {
          save = { id, state: emulator.gameManager.getState(), savedAt: Date.now() };
        } catch (error) {
          status.textContent = 'Could not save a state on this device. Use Save State to download a backup.';
          manualRequested = false;
          updateSaveButton();
          return Promise.resolve(false);
        }
        let nextSaves;
        pendingSave = enqueue(() => {
          nextSaves = [save, ...saves].slice(0, SAVE_LIMIT);
          return writeSave(id, nextSaves);
        }).then(() => {
          const selected = !manualRequested && Number(savePicker.value) > 0
            ? saves[Number(savePicker.value)] : null;
          saves = nextSaves;
          lastSave = save;
          updateSaveList(selected);
          status.textContent = (manualRequested ? 'State saved at ' : 'State auto-saved at ') + new Date(save.savedAt).toLocaleTimeString() + '. ' + saves.length + ' of 10 states kept here.';
          return true;
        }).catch(() => {
          status.textContent = 'Could not save a state on this device. Use Save State to download a backup.';
          return false;
        }).finally(() => {
          pendingSave = null;
          manualRequested = false;
          updateSaveButton();
        });
        updateSaveButton();
        return pendingSave;
      }
      saveNow.addEventListener('click', () => checkpoint(true, true));
      exportSave.addEventListener('click', () => {
        if (!active || pendingSave) return;
        const selected = saves[Number(savePicker.value)];
        if (!selected) return;
        try {
          const stamp = new Date(selected.savedAt).toISOString().replace(/[:.]/g, '-');
          window.PS1Saves.download(selected.state, fileName(gameName) + '-' + stamp + '.state');
          status.textContent = 'Exported state from ' + new Date(selected.savedAt).toLocaleString() + '.';
        } catch (error) {
          status.textContent = 'Could not export this state. Try again.';
        }
      });
      function namedJob(work, failure) {
        namedBusy = true;
        updateSaveButton();
        return enqueue(work).catch(() => {
          status.textContent = failure;
          return false;
        }).finally(() => {
          namedBusy = false;
          updateSaveButton();
        });
      }
      function selectedNamed() {
        return namedPicker && named[Number(namedPicker.value)];
      }
      keepNamed?.addEventListener('click', () => {
        if (!active || pendingSave || namedBusy) return;
        const picked = saves[Number(savePicker.value)];
        if (!picked) return;
        const name = askName(new Date(picked.savedAt).toLocaleString());
        if (!name) return;
        return namedJob(async () => {
          const entry = { name, state: picked.state, savedAt: picked.savedAt };
          const nextNamed = [entry, ...named];
          const nextSaves = saves.filter(save => save !== picked);
          await writeSave(id, nextSaves, nextNamed);
          saves = nextSaves;
          named = nextNamed;
          if (lastSave === picked) lastSave = saves[0];
          updateSaveList();
          updateNamedList(entry);
          status.textContent = 'Moved to named state "' + name + '". ' + saves.length + ' of 10 auto states kept here.';
          return true;
        }, 'Could not name this state. Your states were not changed.');
      });
      saveNamed?.addEventListener('click', () => {
        if (!active || !ready || failedRecovery || !panel.hidden || pendingSave || namedBusy) return;
        let state;
        try { state = emulator.gameManager.getState(); }
        catch (error) {
          status.textContent = 'Could not save a state on this device. Use Save State to download a backup.';
          return;
        }
        const savedAt = Date.now();
        const name = askName(new Date(savedAt).toLocaleString());
        if (!name) return;
        return namedJob(async () => {
          const entry = { name, state, savedAt };
          const nextNamed = [entry, ...named];
          await writeSave(id, null, nextNamed);
          named = nextNamed;
          updateNamedList(entry);
          status.textContent = 'Saved named state "' + name + '".';
          return true;
        }, 'Could not save a named state on this device.');
      });
      loadNamed?.addEventListener('click', () => {
        if (pendingSave || namedBusy || !active) return;
        const picked = selectedNamed();
        if (!picked) return;
        lastSave = picked;
        try {
          pauseEngine();
          restoreOnResume = true;
          resumeEngine();
          window.PS1Saves?.close();
        } catch (error) {
          showPanel('Safari could not resume. Reload, pick the same CHD, and restore your last state.', true);
        }
      });
      renameNamed?.addEventListener('click', () => {
        if (!active || pendingSave || namedBusy) return;
        const picked = selectedNamed();
        if (!picked) return;
        const name = askName(picked.name);
        if (!name || name === picked.name) return;
        return namedJob(async () => {
          const entry = { ...picked, name };
          const nextNamed = named.map(save => save === picked ? entry : save);
          await writeSave(id, null, nextNamed);
          named = nextNamed;
          updateNamedList(entry);
          status.textContent = 'Renamed to "' + name + '".';
          return true;
        }, 'Could not rename this state.');
      });
      exportNamed?.addEventListener('click', () => {
        if (!active || pendingSave || namedBusy) return;
        const picked = selectedNamed();
        if (!picked) return;
        try {
          window.PS1Saves.download(picked.state, fileName(gameName) + '-' + fileName(picked.name) + '.state');
          status.textContent = 'Downloaded "' + picked.name + '".';
        } catch (error) {
          status.textContent = 'Could not download this state. Try again.';
        }
      });
      deleteNamed?.addEventListener('click', () => {
        if (!active || pendingSave || namedBusy) return;
        const picked = selectedNamed();
        if (!picked) return;
        if (!window.confirm('Delete "' + picked.name + '"? This cannot be undone. Download it first to keep a copy.')) return;
        return namedJob(async () => {
          const nextNamed = named.filter(save => save !== picked);
          await writeSave(id, null, nextNamed);
          named = nextNamed;
          updateNamedList();
          status.textContent = 'Deleted "' + picked.name + '".';
          return true;
        }, 'Could not delete this state.');
      });
      function autoEnabled() {
        try { return localStorage.getItem('ps1-auto-save') !== 'off'; } catch (error) { return true; }
      }
      if (autoToggle) {
        autoToggle.checked = autoEnabled();
        autoToggle.addEventListener('change', () => {
          try { localStorage.setItem('ps1-auto-save', autoToggle.checked ? 'on' : 'off'); } catch (error) { /* Applies until reload. */ }
          status.textContent = autoToggle.checked ? 'Auto-save is on.' : 'Auto-save is off. Use Save state now to keep your progress.';
        });
      }
      function autoCheckpoint() {
        if (autoToggle ? !autoToggle.checked : !autoEnabled()) return Promise.resolve(false);
        if (saves.length && Date.now() - saves[0].savedAt < SAVE_INTERVAL) return Promise.resolve(false);
        return checkpoint(true);
      }
      function hideGame() {
        if (!active || !emulator.started) return;
        clearTimeout(watchdog);
        if (!backgrounded) autoCheckpoint();
        backgrounded = true;
        try { pauseEngine(); } catch (error) { failedRecovery = true; }
      }
      function showGame() {
        if (!active || !backgrounded || document.hidden) return;
        if (failedRecovery) {
          showPanel('Safari could not resume. Reload, pick the same CHD, and restore your last state.', true);
        } else {
          if (!emulator.paused) backgrounded = false;
          updateSaveButton();
        }
      }
      function resumeEngine() {
        if (!active) return;
        resuming = true;
        try {
          const audio = new Set();
          const context = emulator.Module.AL && emulator.Module.AL.currentCtx;
          if (context && context.audioCtx) audio.add(context.audioCtx);
          if (context && context.sources) context.sources.forEach(source => {
            if (source && source.gain) audio.add(source.gain.context);
          });
          audio.forEach(context => {
            if (context.state !== 'closed') context.resume().catch(() => {});
          });
          if (restoreOnResume && lastSave) emulator.gameManager.loadState(lastSave.state);
          restoreOnResume = false;
          emulator.play();
          if (schedulerPaused) {
            emulator.Module.resumeMainLoop();
            schedulerPaused = false;
          }
          emulator.gameManager.toggleMainLoop(1);
          emulator.handleResize();
          panel.hidden = true;
          backgrounded = false;
          ready = true;
          failedRecovery = false;
          updateSaveButton();
          const frame = emulator.gameManager.functions.getFrameNum();
          clearTimeout(watchdog);
          watchdog = setTimeout(() => {
            if (!active || document.hidden || emulator.paused) return;
            let stuck = true;
            try { stuck = emulator.gameManager.functions.getFrameNum() === frame; } catch (error) { /* Reload an aborted core. */ }
            if (stuck) {
              try { pauseEngine(); } catch (error) { /* Keep the reload button usable. */ }
              showPanel('Safari is still stuck. Reload, pick the same CHD, and restore your last state.', true);
            }
          }, 2000);
        } catch (error) {
          showPanel('Safari could not resume. Reload, pick the same CHD, and restore your last state.', true);
        } finally {
          resuming = false;
        }
      }
      resume.addEventListener('click', () => {
        if (!active || !ready || failedRecovery) return;
        if (emulator.paused) {
          resumeEngine();
        } else {
          releaseButtons();
          emulator.pause();
        }
      });
      centerPlay?.addEventListener('click', () => {
        if (active && ready && !failedRecovery && emulator.paused) resumeEngine();
      });
      document.addEventListener('keydown', event => {
        if (event.code !== 'Space' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
        if (!active || !ready || failedRecovery || !panel.hidden || !emulator.paused) return;
        if (event.target?.closest?.('input, select, textarea, button, [contenteditable]')) return;
        if (emulator.isPopupOpen?.()) return;
        event.preventDefault();
        resumeEngine();
      });
      reload.addEventListener('click', () => location.reload());
      restore.addEventListener('click', () => {
        if (pendingSave || !active) return;
        lastSave = saves[Number(savePicker.value)];
        if (!lastSave) return;
        try {
          pauseEngine();
          restoreOnResume = true;
          resumeEngine();
          window.PS1Saves?.close();
        } catch (error) {
          showPanel('Safari could not resume. Reload, pick the same CHD, and restore your last state.', true);
        }
      });
      document.addEventListener('visibilitychange', () => document.hidden ? hideGame() : showGame());
      window.addEventListener('pagehide', hideGame);
      window.addEventListener('pageshow', showGame);
      emulator.canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        if (!active) return;
        clearTimeout(watchdog);
        try { pauseEngine(); } catch (error) { /* Keep the reload button usable. */ }
        showPanel('Safari stopped the game screen. Reload, pick the same CHD, and restore your last state.', true);
      });
      try {
        try {
          const storedNamed = await readSave('named:' + id);
          named = storedNamed && Array.isArray(storedNamed.named) ? storedNamed.named : [];
        } catch (error) { named = []; }
        updateNamedList();
        const stored = await readSave(id);
        if (stored) {
          lastSave = { id: stored.id, state: stored.state, savedAt: stored.savedAt };
          saves = [lastSave, ...(stored.history || [])];
          updateSaveList();
        }
        if (lastSave) {
          restore.disabled = false;
          status.textContent = saves.length + ' of 10 states kept here. Auto-save runs every 5 minutes.';
          restoreOnResume = true;
          pauseEngine();
          resumeEngine();
        } else {
          ready = true;
          status.textContent = 'Auto-save states: every 5 minutes; keeps the latest 10 states.';
        }
      } catch (error) {
        ready = true;
        status.textContent = 'Auto-save storage is unavailable. Use Save State to keep a backup.';
      }
      updateSaveButton();
      timer = setInterval(() => {
        if (!document.hidden && !emulator.paused) autoCheckpoint();
      }, SAVE_INTERVAL);
      if (document.hidden) hideGame();
      emulator.on('exit', () => {
        active = false;
        ready = false;
        panel.hidden = true;
        restore.disabled = true;
        updateSaveButton();
        clearInterval(timer);
        clearTimeout(watchdog);
        if (emulator.play === play) emulator.play = originalPlay;
        if (emulator.pause === pause) emulator.pause = originalPause;
      });
      return { checkpoint };
    }
  };
})();
