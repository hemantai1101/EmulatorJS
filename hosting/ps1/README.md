# PS1 player on Cloud Run

Live player: https://ps1-player-168235937982.asia-east2.run.app/

This hosts the player in `heman-dev`, in Hong Kong (`asia-east2`).
The page is public. Game and BIOS files are read on the device, not uploaded.
Saves stay in that browser. Save now updates the latest on-device save immediately. It shares one in-flight save job with auto-save, so repeated or overlapping requests cannot start concurrent writes. Save State still downloads a separate backup file.

The player keeps one auto-save per game every 30 seconds and tries to save again when the page goes into the background. On return, tap Resume game. If Safari closed the page, pick the same CHD and choose Restore last save. Clearing site data removes these auto-saves; exported state files remain a useful backup. To move a save from a Mac to an iPhone, export it on the Mac, copy the file to the iPhone, then load it there.

Open the deployed HTTPS link in Safari. Pick a game from Files and press Play.
The BIOS file is optional; the built-in substitute can cause game or save bugs.
Touch controls appear on phones. Turn the phone sideways for more room.
Arrow buttons are the default. Use the Direction control selector above the game to switch between Arrow buttons and Joystick without restarting. The choice is saved on the device.
The arrow pad is 144–168 CSS pixels wide, with 48–56 pixel arms. The 160 pixel stick starts after a 24 pixel drag, returns to neutral below 16 pixels, and keeps its direction through small angle changes. It supports eight directions and releases immediately. These are app tuning choices, not a universal sensitivity standard.
Use Fill screen above the game to expand it; Exit full screen brings the page back.
On iPhone, use Safari Share → Add to Home Screen → Open as Web App, then launch the new icon to hide Safari’s bars. Keep an exported state file when switching between Safari and the Home Screen app.

## Build and deploy

Requires Python 3, 7-Zip (`brew install sevenzip`), and a signed-in `gcloud`.
Run these commands from this folder:

```sh
python3 prepare.py
sh deploy.sh
```

`prepare.py` downloads the official EmulatorJS 4.2.3 release, checks its SHA-256, keeps the PS1 engine, and adds timestamps to save state downloads.
It copies `index.html` into the build. Run it again after editing that page.
Generated files in `public/` are ignored by Git.

The project must have Cloud Run, Cloud Build, Artifact Registry, and IAM APIs enabled.
It needs a Docker repository named `ps1-player` in `asia-east2` and the service account `ps1-player-runtime` (no project roles).
These are created during the initial setup.

Cloud Run scales to zero and is capped at one instance. Builds, image storage, and data transfer can still incur charges.
The image and page include the upstream GPL license.

## Recovery checks

Run `node recovery.test.cjs` to check manual/auto overlap, repeated taps, failed-write retry, background saving, resume, audio wake-up, reload restoration, and the frozen-loop fallback. These checks do not replace testing on a real iPhone.

Run `node touch-controls.test.cjs` after `prepare.py` to check stick thresholds, direction changes, release, and the shipped engine hook.
