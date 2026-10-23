# PS1 player work

Read the repository's root AGENTS.md first. Keep its AI attribution rule.

## User preferences

- Use small words, short sentences, and short paragraphs.
- Browser tests are allowed in Chrome or other browsers. Mute audio before starting a game test.
- Keep game files, BIOS files, save states, and signed download links out of Git and the public build.

## Working here

- Read PROJECT.md at the repository root for the current setup and next work.
- Edit index.html, recovery.js, touch-controls.js, and prepare.py here. Do not edit generated public files directly.
- Run make check from the repository root after code changes.
- All release patches must be reproduced by prepare.py, with exact-match checks.
- Preserve the shared single-flight save job: manual and automatic saves must never overlap.
- Do not claim an iPhone fix was tested on an iPhone unless it actually was.
- Game/disc fingerprint checks were discussed but are not implemented. Do not describe raw state imports as game-verified.
