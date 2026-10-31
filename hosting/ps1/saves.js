(function (root) {
  const panel = document.querySelector('#saves-panel');
  const status = document.querySelector('#card-status');
  const cardPicker = document.querySelector('#card-file');
  let emulator, importingSlot, busy = false, secondCardEnabled = false;
  function download(bytes, name) {
    const url = URL.createObjectURL(new Blob([bytes]));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function open() {
    if (panel.open) return;
    if (emulator) {
      emulator.menu.close();
      root.PS1Touch?.reset();
    }
    refreshCards();
    panel.showModal();
  }
  function close() { if (panel.open) panel.close(); }
  document.querySelector('#saves-toggle').addEventListener('click', open);
  document.querySelector('#saves-done').addEventListener('click', close);
  document.querySelector('#saves-save-now').addEventListener('click', () => document.querySelector('#save-now').click());
  const recoveryStatus = document.querySelector('#recovery-status');
  new MutationObserver(() => {
    document.querySelector('#saves-status').textContent = recoveryStatus.textContent;
  }).observe(recoveryStatus, { childList: true, characterData: true, subtree: true });
  const saveButton = document.querySelector('#save-now');
  new MutationObserver(() => {
    document.querySelector('#saves-save-now').disabled = saveButton.disabled;
  }).observe(saveButton, { attributes: true });
  for (const type of ['keydown', 'keyup', 'pointerdown', 'mousedown', 'touchstart']) {
    panel.addEventListener(type, event => event.stopPropagation());
  }
  function cardPath(slot) {
    const path = emulator.gameManager.getSaveFilePath();
    return slot === 1 ? path : path.slice(0, path.lastIndexOf('/') + 1) + 'pcsx-card2.mcd';
  }
  function cardBytes(slot) {
    const manager = emulator.gameManager;
    if (slot === 1) return manager.getSaveFile();
    const path = cardPath(slot);
    return manager.FS.analyzePath(path).exists ? manager.FS.readFile(path) : null;
  }
  function cardSummary(bytes) {
    if (!bytes) return 'No card file yet';
    if (!(bytes instanceof Uint8Array) || bytes.length !== 131072 || bytes[0] !== 77 || bytes[1] !== 67) return 'Cannot read card';
    let used = 0;
    for (let frame = 0; frame <= 15; frame++) {
      const start = frame * 128;
      let checksum = 0;
      for (let i = 0; i < 127; i++) checksum ^= bytes[start + i];
      if (checksum !== bytes[start + 127]) return 'Cannot read card';
      if (!frame) continue;
      if (bytes[start + 1] || bytes[start + 2] || bytes[start + 3]) return 'Cannot read card';
      const state = bytes[start];
      if ([0x51, 0x52, 0x53].includes(state)) used++;
      else if (![0xa0, 0xa1, 0xa2, 0xa3].includes(state)) return 'Cannot read card';
    }
    if (!used) return 'Empty · 15 blocks free';
    return (used === 15 ? 'Full' : 'Used') + ' · ' + used + '/15 blocks';
  }
  function refreshCards() {
    if (!emulator || busy) return;
    for (const slot of [1, 2]) {
      let text = 'Cannot read card';
      try { text = slot === 2 && !secondCardEnabled ? 'Slot off' : cardSummary(cardBytes(slot)); }
      catch (error) { /* Keep an unreadable card distinct from an empty card. */ }
      const output = document.querySelector('#card' + slot + '-contents');
      if (output.textContent !== text) output.textContent = text;
    }
  }
  root.addEventListener?.('ps1-state-loaded', () => { if (panel.open) refreshCards(); });
  function exportCard(slot) {
    const bytes = cardBytes(slot);
    if (!bytes) throw new Error('No card file yet. Save inside the game first.');
    const name = slot === 1 ? cardPath(slot).split('/').pop() : 'pcsx-card2.mcd';
    download(bytes, name);
  }
  function setBusy(value) {
    busy = value;
    for (const id of ['export-card1', 'import-card1', 'export-card2', 'import-card2']) {
      document.querySelector('#' + id).disabled = value || (id.endsWith('2') && !secondCardEnabled);
    }
  }
  function pickCard(slot) {
    if (!emulator || busy) return;
    importingSlot = slot;
    cardPicker.click();
  }
  for (const slot of [1, 2]) {
    document.querySelector('#export-card' + slot).addEventListener('click', () => {
      if (!emulator || busy) return;
      try {
        exportCard(slot);
        status.textContent = 'Exported slot ' + slot + '.';
      } catch (error) { status.textContent = error.message; }
    });
    document.querySelector('#import-card' + slot).addEventListener('click', () => {
      pickCard(slot);
    });
  }
  cardPicker.addEventListener('change', async () => {
    const file = cardPicker.files[0];
    if (!file || !emulator || busy) return;
    const slot = importingSlot;
    setBusy(true);
    try {
      if (!/\.(srm|mcd)$/i.test(file.name) || file.size !== 131072) {
        throw new Error('Pick a 128 KB PS1 card (.srm or .mcd).');
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes[0] !== 77 || bytes[1] !== 67) throw new Error('This file is not a raw PS1 memory card.');
      const message = slot === 1
        ? 'Replace slot 1 with this card? A backup of the current card downloads first. Use Load inside the game after import.'
        : 'Replace the shared slot 2 card and reload? A backup downloads first. Then choose Play last game (or pick the same game) and Start fresh to use the card. Your states stay here.';
      if (!root.confirm(message)) return;
      const previous = cardBytes(slot);
      if (previous) exportCard(slot);
      const manager = emulator.gameManager;
      const path = cardPath(slot);
      try {
        manager.FS.writeFile(path, bytes);
        if (slot === 1) manager.loadSaveFiles();
        await new Promise((resolve, reject) => manager.FS.syncfs(false, error => error ? reject(error) : resolve()));
      } catch (error) {
        if (previous) manager.FS.writeFile(path, previous);
        else if (manager.FS.analyzePath(path).exists) manager.FS.unlink(path);
        if (slot === 1 && previous) manager.loadSaveFiles();
        throw error;
      }
      status.textContent = 'Imported slot ' + slot + '. Use Load inside the game.';
      if (slot === 2) location.reload();
    } catch (error) { status.textContent = 'Could not import: ' + error.message; }
    finally { cardPicker.value = ''; setBusy(false); refreshCards(); }
  });
  document.querySelector('#enable-card2').addEventListener('click', () => {
    if (!emulator) return;
    emulator.menuOptionChanged('pcsx_rearmed_memcard2', 'enabled');
    document.querySelector('#enable-card2').hidden = true;
    document.querySelector('#card2-status').textContent = 'Set to On. Save your progress, then reload to use slot 2.';
  });
  function attach(instance) {
    emulator = instance;
    const wasOpen = panel.open;
    if (wasOpen) panel.close();
    document.querySelector('#game').append(panel);
    if (wasOpen) panel.showModal();
    const enabled = emulator.getSettingValue('pcsx_rearmed_memcard2') === 'enabled';
    secondCardEnabled = enabled;
    setBusy(false);
    document.querySelector('#enable-card2').hidden = enabled;
    document.querySelector('#card2-status').textContent = enabled
      ? 'On · Shared by all games in this browser.'
      : 'Off · Turn it on for the next game start.';
    for (const id of ['export-card2', 'import-card2']) document.querySelector('#' + id).disabled = !enabled;
    refreshCards();
    emulator.on('exit', () => {
      close(); setBusy(true); emulator = null;
      for (const slot of [1, 2]) document.querySelector('#card' + slot + '-contents').textContent = 'Start the game to check';
    });
  }
  root.PS1Saves = { open, close, attach, download, pickCard };
})(window);
