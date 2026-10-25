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
  async function writeSave(save, saves) {
    const db = await database;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('states', 'readwrite');
      transaction.objectStore('states').put({ ...save, history: saves.slice(1) });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  window.PS1Recovery = {
    async attach(emulator, gameName) {
      const panel = document.querySelector('#resume-panel');
      const message = document.querySelector('#resume-message');
      const resume = document.querySelector('#resume-game');
      const reload = document.querySelector('#reload-game');
      const fresh = document.querySelector('#start-fresh');
      const restore = document.querySelector('#restore-local');
      const saveNow = document.querySelector('#save-now');
      const saveLabel = document.querySelector('#save-now-label');
      const savePicker = document.querySelector('#local-saves');
      const resumePicker = document.querySelector('#resume-save');
      const status = document.querySelector('#recovery-status');
      const id = 'pcsx_rearmed-4.2.3:' + gameName;
      let saves = [];
      let lastSave, backgrounded = false, schedulerPaused = false;
      let ready = false, pendingSave = null, manualRequested = false;
      let active = true, failedRecovery = false;
      let timer, watchdog, restoreOnResume = false;

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
      function showPanel(text, savedGame = false, failed = false) {
        failedRecovery = failed;
        message.textContent = text;
        resume.textContent = savedGame ? 'Restore selected save' : 'Resume game';
        resumePicker.hidden = !savedGame;
        document.querySelector('#resume-save-label').hidden = !savedGame;
        resume.hidden = failed;
        fresh.hidden = !savedGame;
        reload.hidden = !failed;
        panel.hidden = false;
        updateSaveButton();
      }
      function updateSaveList() {
        for (const picker of [savePicker, resumePicker]) {
          picker.replaceChildren();
          saves.forEach((save, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = new Date(save.savedAt).toLocaleString() + (index === 0 ? ' (latest)' : '');
            picker.append(option);
          });
          picker.value = '0';
        }
      }
      function updateSaveButton() {
        saveNow.disabled = !!pendingSave || !active || !ready || failedRecovery || !panel.hidden;
        saveLabel.textContent = saveNow.title = pendingSave ? 'Saving…' : 'Save now';
        restore.disabled = savePicker.disabled = !active || !saves.length || !!pendingSave;
        resumePicker.disabled = !!pendingSave;
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
        saveLabel.textContent = saveNow.title = 'Saving…';
        try {
          save = { id, state: emulator.gameManager.getState(), savedAt: Date.now() };
        } catch (error) {
          status.textContent = 'Could not save on this device. Use Save State to download a backup.';
          manualRequested = false;
          updateSaveButton();
          return Promise.resolve(false);
        }
        const nextSaves = [save, ...saves].slice(0, SAVE_LIMIT);
        pendingSave = writeSave(save, nextSaves).then(() => {
          saves = nextSaves;
          lastSave = save;
          updateSaveList();
          status.textContent = (manualRequested ? 'Saved now at ' : 'Auto-saved at ') + new Date(save.savedAt).toLocaleTimeString() + '. ' + saves.length + ' of 10 saves kept here.';
          return true;
        }).catch(() => {
          status.textContent = 'Could not save on this device. Use Save State to download a backup.';
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
      function autoCheckpoint() {
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
          showPanel('Safari could not resume. Reload, pick the same CHD, and restore your last save.', false, true);
        } else {
          showPanel('Safari paused the game while you were away. Tap Resume game.');
        }
      }
      function resumeEngine() {
        if (!active) return;
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
              showPanel('Safari is still stuck. Reload, pick the same CHD, and restore your last save.', false, true);
            }
          }, 2000);
        } catch (error) {
          showPanel('Safari could not resume. Reload, pick the same CHD, and restore your last save.', false, true);
        }
      }
      resume.addEventListener('click', () => {
        if (restoreOnResume) lastSave = saves[Number(resumePicker.value)];
        resumeEngine();
      });
      fresh.addEventListener('click', () => {
        restoreOnResume = false;
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
        } catch (error) {
          showPanel('Safari could not resume. Reload, pick the same CHD, and restore your last save.', false, true);
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
        showPanel('Safari stopped the game screen. Reload, pick the same CHD, and restore your last save.', false, true);
      });
      try {
        const stored = await readSave(id);
        if (stored) {
          lastSave = { id: stored.id, state: stored.state, savedAt: stored.savedAt };
          saves = [lastSave, ...(stored.history || [])];
          updateSaveList();
        }
        if (lastSave) {
          restore.disabled = false;
          status.textContent = saves.length + ' of 10 saves kept here. Auto-save runs every 5 minutes.';
          restoreOnResume = true;
          pauseEngine();
          showPanel('A save from ' + new Date(lastSave.savedAt).toLocaleString() + ' is kept on this device.', true);
        } else {
          ready = true;
          status.textContent = 'Auto-save is on. Every 5 minutes; keeps the latest 10 saves.';
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
      });
      return { checkpoint };
    }
  };
})();
