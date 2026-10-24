(function () {
  let database;
  function openDatabase() {
    if (!database) database = new Promise((resolve, reject) => {
      const request = indexedDB.open('ps1-player-recent-game', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('files');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Game storage is busy.'));
    });
    return database;
  }
  window.PS1RecentGame = {
    async read() {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const request = db.transaction('files').objectStore('files').get('last');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },
    async remember(game, bios) {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('files', 'readwrite');
        transaction.objectStore('files').put({ game, name: game.name, bios: bios || null, biosName: bios?.name || '' }, 'last');
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    },
    files(saved) {
      return {
        game: new File([saved.game], saved.name, { type: saved.game.type }),
        bios: saved.bios ? new File([saved.bios], saved.biosName, { type: saved.bios.type }) : null
      };
    }
  };
})();
