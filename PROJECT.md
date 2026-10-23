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

- The setup screen has a game picker and an optional BIOS panel. During play, Settings groups touch controls, local restore, and backup import. Save status stays below the game. Help holds install and backup tips.
- The UI uses charcoal, soft white, and green. Desktop browser layout checks covered desktop, phone portrait, and phone landscape widths. These are not real iPhone or gameplay checks.
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

Read [DEPLOYMENT.md](DEPLOYMENT.md) for deploy commands, verified GCP resources and IAM, production checks, rollback, and private download exports.

GCP project `heman-dev`, region `asia-east2`, Cloud Run service `ps1-player`.
Runtime service account: `ps1-player-runtime@heman-dev.iam.gserviceaccount.com`.
The Docker context includes only the prepared public player, not local games or saves.

## Ad plan

Reviewed 2026-10-23. This is a plan only. No ad code, custom ad slots, account changes, or new route are part of this docs task.

- **Use Auto ads.** It needs one publisher script, not custom slots. Manual units are only needed for exact placement. See Google's [Auto ads guide](https://support.google.com/adsense/answer/9261805).
- **Split home and play before enabling ads.** Today `index.html` hides `#setup` and starts the game in the same document. Hiding setup does not unload ad code. Our recommendation is a real home document with useful help and a clear Play link, then a full page load to `/play.html` with the file picker and player, without ad code. Keep the game and BIOS picker on that ad-free document so no file handoff is needed. A hash, query change, or hidden ad area is not a reliable stop for ads during play. Do not implement this split in the UI-only work.
- **Build and serve a real file.** `prepare.py` must copy any future `play.html` into `public/`; keep engine paths valid. Local `serve.py` serves files, and deployed nginx uses `try_files $uri $uri/ =404`; neither has a single-page app fallback. Test direct loads, reload, Back, and the installed app entry point.
- **Keep saves.** A new path on the same scheme, host, and port keeps the IndexedDB origin. Keep database `ps1-player-recovery`, store `states`, and IDs `pcsx_rearmed-4.2.3:` plus the existing game name. Do not migrate or delete saves. A new domain, subdomain, or port has separate saves. Test an old save before and after the route change.
- **Keep player isolation.** Both servers now send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on every page. COEP can block third-party resources and frames that lack the required opt-in headers ([Chrome guidance](https://developer.chrome.com/blog/iframe-credentialless)). AdSense compatibility is untested. Do not weaken the player's headers. If needed, scope different headers to the future home document in both servers, then test real ad resources and confirm `crossOriginIsolated` remains true in the player.
- **Account setup later.** Use the real publisher ID, verify site ownership, and get site approval before ads can serve ([Google setup](https://support.google.com/adsense/answer/7584263)). Review content, rights, privacy notices, consent, and ads.txt. Approval, eligibility of this site, and earnings remain unknown. Do not promise them. Review Google's [consent requirements](https://support.google.com/adsense/answer/13554116) for the audience; a certified consent tool is required for personalized ads in the EEA, UK, and Switzerland.
- **Start with a light ad load.** In [Auto ads settings](https://support.google.com/adsense/answer/9305577), disable anchors, vignettes, side rails, and all ad intents. Start with in-page banners only, the lowest practical maximum count, and generous spacing. Exclude Play links and controls in the preview. [Area exclusions](https://support.google.com/adsense/answer/12626543) apply only to in-page ads and can break when CSS selectors change. Also [exclude the player URL](https://support.google.com/adsense/answer/9262311); page exclusions do not support query strings or fragments and can take an hour to apply. Keep the absence of ad code as the main gameplay guard.
- **No play barriers.** No ad over the game, buttons, saves, resume panel, or fullscreen view. No timed ad gate or required click before play. Keep Play clear and away from ads. Google's [gameplay guidance](https://support.google.com/adsense/answer/2768340) recommends at least 150 pixels from the game or removing ads from gameplay pages; our plan removes them.
- **Check before launch.** Compare home load time and layout shifts with ads off/on, including slow mobile loads, no fill, blocked ads, and consent refused. Test a separate muted Chrome tab and a real iPhone Safari session for file load, controls, fullscreen, saves, and resume. Confirm no ad requests in the player. No live ad or device test has been run for this plan.
- **Keep game data private.** Do not send game/BIOS bytes, filenames, save states, or save IDs to ads or analytics, including in URLs. A same-origin page split is not a security wall: third-party scripts on home run with that origin's access, including IndexedDB. Review that trust before adding them; do not claim an ad-free route alone makes local saves inaccessible to ad code.

## User preferences

Keep replies short and plain. Chrome tests are allowed. Mute audio before a browser game test.
Work in this fork. Include the required Assisted-by trailer in commits.

The old chat output path points to this folder for compatibility. This project folder is the source of truth.
