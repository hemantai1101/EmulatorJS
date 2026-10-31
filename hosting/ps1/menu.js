(function (root) {
  function setup(emulator) {
    const menu = emulator.elements.menu;
    if (!menu || menu.dataset.ps1Menu) return;
    menu.dataset.ps1Menu = 'true';
    const bar = emulator.elements.bottomBar;
    const group = title => {
      const details = document.createElement('details');
      details.className = 'ps1-menu-group';
      const summary = document.createElement('summary');
      summary.textContent = title;
      const body = document.createElement('div');
      body.className = 'ps1-menu-group-body';
      details.append(summary, body);
      menu.append(details);
      return body;
    };
    const move = (name, parent) => {
      for (const button of bar[name] || []) {
        parent.append(button);
      }
    };
    move('playPause', menu);
    menu.append(menu.querySelector('.ejs_volume_parent'));
    const volume = menu.querySelector('input[data-range="volume"]');
    volume.addEventListener('input', () => {
      emulator.volume = Number(volume.value);
      emulator.setVolume(emulator.volume);
    });
    move('gamepad', menu);
    menu.append(emulator.diskParent);

    const saves = group('Saves');
    const saveNow = document.createElement('button');
    saveNow.type = 'button';
    saveNow.textContent = 'Save state now';
    saveNow.addEventListener('click', () => document.querySelector('#save-now').click());
    const pickerLabel = document.createElement('label');
    pickerLabel.htmlFor = 'menu-saved-points';
    pickerLabel.textContent = 'Saved states';
    const picker = document.createElement('select');
    picker.id = 'menu-saved-points';
    const load = document.createElement('button');
    load.type = 'button';
    load.textContent = 'Load selected state';
    const exportSave = document.createElement('button');
    exportSave.type = 'button';
    exportSave.textContent = 'Export selected state';
    exportSave.addEventListener('click', () => document.querySelector('#export-local').click());
    const manage = document.createElement('button');
    manage.type = 'button';
    manage.textContent = 'States & memory cards';
    manage.addEventListener('click', () => root.PS1Saves.open());
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const source = document.querySelector('#local-saves');
    const originalSave = document.querySelector('#save-now');
    const originalLoad = document.querySelector('#restore-local');
    const originalStatus = document.querySelector('#recovery-status');
    const sync = () => {
      picker.replaceChildren(...[...source.options].map(option => option.cloneNode(true)));
      picker.value = source.value;
      picker.disabled = source.disabled;
      saveNow.disabled = originalSave.disabled;
      load.disabled = originalLoad.disabled;
      exportSave.disabled = document.querySelector('#export-local').disabled;
      status.textContent = originalStatus.textContent;
    };
    const observer = new MutationObserver(sync);
    for (const element of [source, originalSave, originalLoad, originalStatus, document.querySelector('#export-local')]) {
      observer.observe(element, { subtree: true, childList: true, attributes: true, characterData: true });
    }
    picker.addEventListener('change', () => { source.value = picker.value; });
    source.addEventListener('change', sync);
    load.addEventListener('click', () => {
      source.value = picker.value;
      originalLoad.click();
      emulator.menu.close();
    });
    saves.append(manage, saveNow, pickerLabel, picker, load, exportSave, status);
    move('saveState', saves);
    move('loadState', saves);
    const hint = document.createElement('p');
    hint.textContent = 'States keep one moment of play. Use the same game and disc.';
    saves.append(hint);
    sync();

    const advanced = group('Advanced');
    move('restart', advanced);
    bar.restart[0].addEventListener('click', event => {
      if (!root.confirm('Restart this game? Progress since your last save may be lost.')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    move('saveSavFiles', saves);
    move('loadSavFiles', saves);
    const cardHint = document.createElement('p');
    cardHint.textContent = 'Memory card files hold saves made inside the game. They are different from .state backups.';
    saves.append(cardHint);
    move('cheat', advanced);
    advanced.append(emulator.settingParent);
    move('exit', advanced);
    const settingsButton = bar.settings[0][0];
    const settingsPage = document.createElement('section');
    settingsPage.className = 'ps1-settings-page';
    settingsPage.hidden = true;
    settingsPage.setAttribute('aria-label', 'Settings');
    const settingsHeader = document.createElement('div');
    settingsHeader.className = 'ps1-settings-header';
    const back = document.createElement('button');
    back.type = 'button';
    back.textContent = 'Back';
    const heading = document.createElement('h3');
    heading.textContent = 'Settings';
    settingsHeader.append(back, heading);
    settingsPage.append(settingsHeader, emulator.settingsMenu);
    menu.append(settingsPage);
    let menuScroll = 0;
    const showSettings = open => {
      if (open) menuScroll = menu.scrollTop;
      settingsPage.hidden = !open;
      menu.classList.toggle('ps1-settings-view', open);
      menu.scrollTop = open ? 0 : menuScroll;
      if (open) back.focus({ preventScroll: true });
    };
    const closeSettings = emulator.closeSettingsMenu.bind(emulator);
    emulator.closeSettingsMenu = () => {
      closeSettings();
      if (menu.classList.contains('ps1-settings-view')) showSettings(false);
    };
    settingsButton.addEventListener('click', () => showSettings(emulator.settingsMenuOpen));
    back.addEventListener('click', () => {
      emulator.closeSettingsMenu();
      settingsButton.focus({ preventScroll: true });
    });
    emulator.settingsMenu.addEventListener('click', () => { menu.scrollTop = 0; });
    for (const type of ['mousedown', 'touchstart']) {
      menu.addEventListener(type, event => event.stopPropagation(), { passive: true });
    }

    menu.querySelector('.ejs_menu_bar_spacer').hidden = true;
    for (const button of menu.querySelectorAll('.ejs_menu_button')) {
      const label = button.querySelector('.ejs_menu_text')?.textContent;
      if (label) { button.setAttribute('aria-label', label); button.title = label; }
    }
    for (const button of [...bar.contextMenu, ...bar.fullscreen]) button.hidden = true;
    const openMenu = emulator.menu.open.bind(emulator.menu);
    emulator.menu.open = () => openMenu(true);
    emulator.menu.toggle = () => {
      if (!emulator.started) return;
      if (menu.classList.contains('ejs_menu_bar_hidden')) {
        emulator.menu.open();
      } else {
        emulator.closeSettingsMenu();
        emulator.closeDisksMenu();
        emulator.menu.close();
      }
    };
    document.addEventListener('pointerdown', event => {
      if (menu.contains(event.target) || emulator.elements.menuToggle?.contains(event.target)) return;
      if (menu.classList.contains('ejs_menu_bar_hidden') || emulator.isPopupOpen()) return;
      emulator.closeSettingsMenu();
      emulator.closeDisksMenu();
      emulator.menu.close();
    });
    menu.addEventListener('pointerdown', () => emulator.menu.open(true));
    menu.addEventListener('focusin', () => emulator.menu.open(true));
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || menu.classList.contains('ejs_menu_bar_hidden') || emulator.isPopupOpen()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      emulator.closeSettingsMenu();
      emulator.closeDisksMenu();
      emulator.menu.close();
      emulator.elements.menuToggle?.focus();
    }, true);
    menu.addEventListener('keydown', event => event.stopPropagation());
    menu.addEventListener('keyup', event => event.stopPropagation());
    emulator.on('exit', () => observer.disconnect());
    emulator.menu.close();
  }
  root.PS1Menu = { setup };
})(window);
