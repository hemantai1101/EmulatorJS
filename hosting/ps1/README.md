# PS1 player on Cloud Run

Live player: https://ps1-player-168235937982.asia-east2.run.app/

This hosts the player in `heman-dev`, in Hong Kong (`asia-east2`).
The page is public. Game and BIOS files are read on the device, not uploaded.
Saves stay in that browser. Save now adds a saved point immediately. It shares one in-flight save job with auto-save, so repeated or overlapping requests cannot start concurrent writes. Save State still downloads a separate backup file.

The player keeps the latest 10 saved points per game name. Auto-save runs every 5 minutes. Leaving the page only adds an auto-save if the newest save is at least 5 minutes old, or no save exists. Manual saves count toward the same 10 points; a new save drops the oldest when full. Existing saves are kept. Pick a time under Settings → Saved points and tap Load selected save to go back. Loading a point keeps the rest of the list. On return, tap Resume game. If Safari closed the page, pick the same CHD and pick a saved point and choose Restore selected save. Clearing site data removes these auto-saves; exported state files remain a useful backup. To move a save from a Mac to an iPhone, export it on the Mac, copy the file to the iPhone, then load it there.

Open the deployed HTTPS link in Safari. Pick a game from Files and press Play. Once it starts, one game copy and its optional BIOS are kept in this browser. Next time, use Play last game. The game must be picked once after this update. A different game replaces this copy but keeps saved points separate. If browser storage is full or blocked, use the picker again next time. Clearing site data or browser eviction can remove stored files.
The BIOS file is optional; the built-in substitute can cause game or save bugs.
Touch controls appear on phones. Turn the phone sideways for more room.
Arrow buttons are the default. Use the Direction control selector above the game to switch between Arrow buttons and Joystick without restarting. The choice is saved on the device.
The arrow pad is 144–168 CSS pixels wide, with 48–56 pixel arms. The 160 pixel stick starts after a 24 pixel drag, returns to neutral below 16 pixels, and keeps its direction through small angle changes. It supports eight directions and releases immediately. These are app tuning choices, not a universal sensitivity standard.
Use Fill screen above the game to expand it; Exit full screen brings the page back.
On iPhone, use Safari Share → Add to Home Screen → Open as Web App, then launch the new icon to hide Safari’s bars. Keep an exported state file when switching between Safari and the Home Screen app.

## Local project

The working checkout is `/Users/heman/projects/ps1-player`. From that folder:

```sh
make play
make check
```

Open http://localhost:8765/. The server is local only, uses the GCP isolation headers, and disables stale browser caching. Use `make play PORT=8766` if needed. Read PROJECT.md at the repository root for the handoff notes.

## Build and deploy

Full operating guide: [DEPLOYMENT.md](../../DEPLOYMENT.md). It covers live resources, account permissions, verification, rollback, and the private download bucket.

Requires Python 3.11+, Node.js, 7-Zip (`brew install sevenzip`), and a signed-in `gcloud`.
Run these commands from this folder:

```sh
python3 prepare.py
sh deploy.sh
```

`prepare.py` downloads the official EmulatorJS 4.2.3 release, checks its SHA-256, keeps the PS1 engine, and adds timestamps to save state downloads.
It caches the release in `.cache/` and checks its checksum on every build. It copies the player source into the build. Deployment always rebuilds and runs all checks before upload.
Generated files in `public/` are ignored by Git.

The project must have Cloud Run, Cloud Build, Artifact Registry, and IAM APIs enabled.
It needs a Docker repository named `ps1-player` in `asia-east2` and the service account `ps1-player-runtime` (no project roles).
These are created during the initial setup.

Cloud Run scales to zero and is capped at one instance. Builds, image storage, and data transfer can still incur charges.
The image and page include the upstream GPL license.

## Recovery checks

Run `node recovery.test.cjs` to check manual/auto overlap, repeated taps, failed-write retry, background saving, resume, audio wake-up, reload restoration, and the frozen-loop fallback. These checks do not replace testing on a real iPhone.

Run `node touch-controls.test.cjs` after `prepare.py` to check stick thresholds, direction changes, release, and the shipped engine hook.

## Fullscreen and touch menu checks

Both fullscreen paths use the viewport height; the native emulator button must bypass the normal 680px/70vh page limit. Fullscreen changes also trigger a resize after layout settles. PS1 video retains its original aspect ratio, so side bars can remain.

On coarse-pointer devices, automatic menu opening from mouse movement/click is disabled, including touch-generated mouse events. The visible 44px menu button remains available at the top right. Desktop mouse behavior is kept.

Run `node display.test.cjs` after `prepare.py` for touch-menu and fullscreen CSS regression checks.

Held gameplay keys prevent browser scrolling, including repeated keydown events. Settings and popups keep their normal key behavior. Run `node keyboard.test.cjs` after `prepare.py` to check held arrows and key release in both shipped engine versions.

Some games draw their own black rim inside the PS1 frame. In fullscreen, open the sliders icon at the top right and choose Picture → Zoom. This enlarges only the canvas by 15.38%, preserving its shape and leaving menus and controls at their normal size. This fits Global Force's 208 visible rows within its 240-row frame to the screen height. Picture → Original turns it off. Zoom is opt-in and only affects fullscreen; other games may have useful edge content that this mode would crop. It does not change emulator state or save data.

### Touch control look

The top-right sliders icon opens button size and button strength. The arrow pad and PS1 face buttons start larger (190 px clusters on tablets, scaled to fit phones). Strength starts at 45%, so the game shows through. The four face buttons sit farther apart. Their matching SVG line symbols use PS1 colours: green triangle, pink square, red circle, and blue cross. Pressed buttons become brighter. Size and strength are kept on this browser. The joystick uses its own 160 px zone. Picture controls, exit fullscreen, and game menu share one aligned row of grey 44 px tap areas. Original and Zoom are separate buttons; opening the panel does not open a dropdown.

This follows the adjustable transparency and layout used by [PPSSPP](https://www.ppsspp.org/docs/settings/controls/) and transparent input overlays with press feedback in [RetroArch](https://docs.libretro.com/development/retroarch/input/overlay/). The exact sizes and strength are our defaults.

### Game menu

Existing EmulatorJS action names stay the same. Saves groups local saved points with Save State and Load State. Advanced groups Restart, Export Save File, Import Save File, Cheats, Settings, and Exit Emulation when enabled. Restart asks before acting. Save now uses the same save job as the page toolbar and auto-save. Select and Start are spaced apart at the bottom; Fast and Slow touch buttons are removed. Speed options remain in Advanced → Settings.
