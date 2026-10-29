#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! test -f public/data/emulator.min.js; then
    echo "Run make prepare from the project folder first." >&2
    exit 1
fi
node --check public/data/emulator.min.js
node --check recent-game.js
node --check recovery.js
node --check touch-controls.js
node --check menu.js
node --check saves.js
node keyboard.test.cjs
node display.test.cjs
node touch-controls.test.cjs
node recovery.test.cjs
node saves.test.cjs
node save-core.test.cjs
node recent-game.test.cjs
node popup.test.cjs
