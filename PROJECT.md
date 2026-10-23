# PS1 Player

Working folder: `/Users/heman/projects/ps1-player`

Fork: https://github.com/hemantai1101/EmulatorJS

Live player: https://ps1-player-168235937982.asia-east2.run.app/

## Start here

```sh
cd /Users/heman/projects/ps1-player
make play
```

Open `http://localhost:8765/`. Stop the server with Ctrl+C.
If that port is busy, use `make play PORT=8766`.

Requires Python 3.11+, Node.js, Make, and 7-Zip (`7zz` or `7z`).
The first build downloads the pinned EmulatorJS 4.2.3 release. Later builds use a local cache and verify its checksum each time.
This checkout already has the release cached.

`make check` rebuilds and runs all player checks. It does not open a browser or play audio.
`make deploy` rebuilds, runs the checks, then deploys to the existing GCP service. It requires a signed-in gcloud account and can incur GCP costs.

## Where to edit

- `hosting/ps1/index.html`: game picker, state import, fullscreen, picture zoom, control selection.
- `hosting/ps1/recovery.js`: manual save, auto-save, background pause, resume, and restore.
- `hosting/ps1/touch-controls.js`: stick dead zone and direction stability.
- `hosting/ps1/prepare.py`: pinned release, checksum checks, reproducible engine patches, and public build.
- `hosting/ps1/public/`: generated files. Rebuild these; do not edit them.
- `hosting/ps1/*.test.cjs`: save, touch, fullscreen, menu, and keyboard regression checks.

The root package.json and data/ belong to the upstream project. Use the Make commands for our deployed PS1 player; npm start serves the upstream project instead.

## Current behavior

- Games and BIOS files stay on the device.
- One latest save per game name is stored in IndexedDB. Save now and auto-save share one job.
- Auto-save runs every 30 seconds and attempts another save when the page backgrounds.
- After a reload, restoring an existing save requires a user choice before auto-save resumes.
- A raw .state import checks the RASTATE header. It does not verify which game/disc created the state.
- Safari backgrounding can suspend or kill the page. Recovery helps resume; the app cannot promise background gameplay.
- Arrow buttons are the default. A larger pad and a steadier eight-direction stick are available.
- Fullscreen bypasses the normal page height cap. Optional Zoom picture hides Global Force's built-in black rim; other games can lose edge content when zoomed.
- Repeated gameplay keys prevent page scrolling. Mobile menu opening ignores touch-generated mouse events.

## Next work discussed with the user

Game/disc identity checks for saves were discussed, not implemented. The suggested first step is a content fingerprint plus emulator version, with a warning for old states. Renaming should not change identity. ZIP and CHD files of the same disc need different handling if they are to count as the same game. Avoid loading a whole disc into another in-memory buffer on iPhone just to hash it.

Do not silently migrate, overwrite, or remove existing saves when adding this feature. A multi-save picker is also not implemented; the current app keeps one latest local save per game name.

## Hosting

GCP project `heman-dev`, region `asia-east2`, Cloud Run service `ps1-player`.
Runtime service account: `ps1-player-runtime@heman-dev.iam.gserviceaccount.com`.
The Docker context includes only the prepared public player, not local games or saves.

## User preferences

Keep replies short and plain. Chrome tests are allowed. Mute audio before a browser game test.
Work in this fork. Include the required Assisted-by trailer in commits.

The old chat output path points to this folder for compatibility. This project folder is the source of truth.
