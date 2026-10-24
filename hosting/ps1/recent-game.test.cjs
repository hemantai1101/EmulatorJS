const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
let saved, failWrite = false;
const db = {
  createObjectStore() {},
  transaction(store, mode) {
    assert.equal(store, 'files');
    const transaction = {
      objectStore() {
        return {
          get(key) {
            assert.equal(key, 'last');
            const request = {};
            queueMicrotask(() => { request.result = saved; request.onsuccess(); });
            return request;
          },
          put(value, key) {
            assert.equal(mode, 'readwrite');
            assert.equal(key, 'last');
            queueMicrotask(() => {
              if (failWrite) {
                transaction.error = new Error('Storage is full');
                transaction.onabort();
              } else {
                saved = structuredClone(value);
                transaction.oncomplete();
              }
            });
          }
        };
      }
    };
    return transaction;
  }
};
function boot(unavailable = false) {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'recent-game.js'), 'utf8'), {
    window, File,
    indexedDB: { open(name, version) {
      assert.equal(name, 'ps1-player-recent-game');
      assert.equal(version, 1);
      const request = {};
      queueMicrotask(() => {
        if (unavailable) {
          request.error = new Error('Storage blocked');
          request.onerror();
        } else {
          request.result = db;
          request.onupgradeneeded();
          request.onsuccess();
        }
      });
      return request;
    } }
  });
  return window.PS1RecentGame;
}
(async () => {
  const recent = boot();
  assert.equal(await recent.read(), undefined);
  const game = new File([new Uint8Array([1, 2, 3])], 'Game (Japan).chd');
  const bios = new File([new Uint8Array([4, 5, 6])], 'bios.bin');
  await recent.remember(game, bios);
  const afterReload = boot();
  const files = afterReload.files(await afterReload.read());
  assert.equal(files.game.name, game.name);
  assert.equal(files.bios.name, bios.name);
  assert.deepEqual(new Uint8Array(await files.game.arrayBuffer()), new Uint8Array([1, 2, 3]));
  assert.deepEqual(new Uint8Array(await files.bios.arrayBuffer()), new Uint8Array([4, 5, 6]));
  failWrite = true;
  await assert.rejects(recent.remember(new File(['new'], 'New.chd')), /Storage is full/);
  assert.equal((await recent.read()).name, game.name);
  failWrite = false;
  await recent.remember(new File(['new'], 'New.chd'));
  assert.equal((await recent.read()).name, 'New.chd');
  assert.equal(recent.files(await recent.read()).bios, null, 'a different game must not inherit the old BIOS');
  await assert.rejects(boot(true).read(), /Storage blocked/);
  console.log('PASS: last game and BIOS survive reload, exact filename and bytes kept, one game only, quota failure preserves old copy, unavailable storage reports failure.');
})();
