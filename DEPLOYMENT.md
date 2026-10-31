# PS1 Player deployment

This is the guide for the existing GCP setup. Resource settings below were checked on **23 October 2026**. Run the inspection commands again when debugging; the snapshot can go stale.

## Deploy the latest code

Use GitHub for normal releases. Push the player changes to `main`; `.github/workflows/ps1-deploy.yml` builds, checks, and deploys the existing service. The full identity and trust setup is recorded in `PROJECT.md` under GitHub deploy. To run the latest `main` again:

```sh
gh workflow run ps1-deploy.yml --repo hemantai1101/EmulatorJS --ref main
gh run list --repo hemantai1101/EmulatorJS --workflow ps1-deploy.yml --limit 5
```

The local Cloud Build route below remains available when requested.

Run from the project folder:

```sh
cd /Users/heman/projects/ps1-player
gcloud auth list
make deploy
```

If no suitable account is signed in, run `gcloud auth login` first. The current operator is `hemantai1101@gmail.com`.

Local tools: Python 3.11+, Node.js, Make, 7-Zip (`7zz` or `7z`), and Google Cloud CLI. Billing must be enabled on the GCP project. A local Docker daemon is not needed: Cloud Build builds the container.

`make deploy` runs `hosting/ps1/deploy.sh`, which:

1. Runs `prepare.py`. This verifies the pinned EmulatorJS 4.2.3 archive, applies the player patches, and prepares `public/`.
2. Runs `check.sh`. A failing check stops deployment.
3. Sends the allowed build files to Cloud Build in `asia-east2`.
4. Builds the Nginx image and pushes it to Artifact Registry with a UTC timestamp tag.
5. Deploys a new Cloud Run revision with the runtime account and settings below. A normal successful deploy routes traffic to the new revision.

The release archive is cached in `hosting/ps1/.cache/`. It is checked against the SHA-256 in `prepare.py` on every build. The first build downloads it if missing. Generated files in `public/` and the cache are ignored by Git.

The script accepts `PS1_PROJECT`, defaulting to `heman-dev`. Region, service name, and repository name are fixed in the script. Changing the project alone does not create its required resources.

## Live resources

| Item | Current value |
| --- | --- |
| GCP project | `heman-dev` |
| Project number | `168235937982` |
| Region | `asia-east2` (Hong Kong) |
| Cloud Run service | `ps1-player` |
| Player address used for browser saves | `https://ps1-player-168235937982.asia-east2.run.app/` |
| Alternate service address returned by gcloud | `https://ps1-player-kqtcwpesdq-df.a.run.app/` |
| Artifact Registry repository | `asia-east2-docker.pkg.dev/heman-dev/ps1-player` |
| Image path | `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player:UTC_TIMESTAMP` |
| Cloud Build source bucket | `gs://heman-dev_cloudbuild/` |
| Runtime account | `ps1-player-runtime@heman-dev.iam.gserviceaccount.com` |
| Private download bucket | `gs://heman-dev-ps1-downloads-168235937982/` |
| Download signer | `ps1-download-signer@heman-dev.iam.gserviceaccount.com` |

Keep using the same player address. Browser storage belongs to the exact origin, so the alternate hostname has separate saves. Localhost and different localhost ports also have separate saves.

Latest verified release, **31 October 2026 (Hong Kong)**: local `make deploy` completed Cloud Build `c8ff979c-ec0d-489a-a50e-be089bf63635`. Ready revision `ps1-player-00043-6tb` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:4291284b00b18b7271dbdcda646c4d3aeef97a15dcbfabfe50c287ad0c56170b` (tag `20261031005219`). This deploys the compact Saves panel with foldouts and a fixed Done row, state wording, and the picker following the latest state by default. Auto-save preserves a chosen older state; Save state now selects its new state after a successful write. Versioned recovery/menu/saves URLs fetch this release. Save IDs, stored bytes, card handling and the shared save job stay unchanged. This deployed the working checkout directly; it is not a GitHub release.

`make check` passed. All 13 checked live files matched the tested build with both isolation headers kept. Fresh desktop Chrome and Playwright WebKit checked the live panel at 390×844, 320×568, 852×393, 568×320 and 1100×850, including panel bounds, scrolling, visible Done, 44 px controls, foldout click/keyboard actions, Done/Escape and browser-fill visibility. Separate isolated browser contexts checked the live recovery script with dummy snapshot bytes and real IndexedDB: default latest following, older-state retention, manual selection and state labels passed in both browsers. These are UI/persistence integration checks on this Mac, not real gameplay or a physical iPhone test. The user's live game and browser saves were untouched. Hosting resources and the player address are unchanged.

Previous GitHub release, **30 October 2026 (Hong Kong)**: GitHub Actions [run 41050668097](https://github.com/hemantai1101/EmulatorJS/actions/runs/41050668097) deployed commit `b6eecb8f1df582e74b904ae8c4b190ba78893ef1` from `main`. Ready revision `ps1-player-00042-k4f` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:0d2fce2830c7a1028c277330a2ab1c9037e65e3f0b3651b63c523b87d89d9d3c`. This adds the guarded Forbidden Memories restore hook in `state-cards.js`. Restoring an older state now aligns only its expected save sequence with a validated slot 1 card from the same profile. It does not edit the stored state/history or the card, and skips unknown layouts, other profiles and invalid cards. The UI now says saved points and cards are separate backups. Hosting settings and the player address are unchanged.

Local `make check` and GitHub checks/deployment passed. Thirteen live files, including the new state-card script, matched the tested build with both isolation headers kept. Fresh muted desktop Chrome on the live URL loaded the exact user state at counter 25 against their card at 26, saved to 27, reloaded that unchanged state and saved to 28, and repeated to 29. Live Playwright WebKit checked the reload Resume and Saved points restore buttons, followed by successful native saves to 27 and 28. Local Chrome also covered the source engine; unit tests cover guarded data handling and counter-only copies. Tests used isolated contexts on this Mac, not a physical phone. The live user game was not reloaded or altered; only a copy of slot 1 was downloaded through the visible Saves panel for inspection. Original files remained unchanged.

Previous GitHub release, **29 October 2026 (Hong Kong)**: GitHub Actions [run 40826428187](https://github.com/hemantai1101/EmulatorJS/actions/runs/40826428187) deployed commit `298d32d66f84a70fdf4a726a012df70d65e2f8a0` from `main`. Ready revision `ps1-player-00041-bsl` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:e4cf2f5a6c932d1efab487819363600bc524ba9dbfc5a32ee7f613c4807d8d1f`. This adds the Saves dialog, export of a selected saved point, and import/export controls for both memory cards. Slot 2 defaults to enabled and is shared across games. Exact-match engine patches apply default options before core startup and keep the save mount alive through exit so queued persistence cannot erase card files on reload. Save IDs, history and the shared save job stay in place. Hosting settings and the player address are unchanged.

Local `make check`, GitHub build/check/deploy and the live-page job passed. Twelve live files (index, Saves/menu/recovery/recent-game/touch scripts, both engines, GameManager and three search files) matched the tested build byte for byte with isolation headers kept. Fresh muted desktop Chrome on the live URL checked selected-point export against stored bytes, selection retention, card export, three viewport sizes, Escape/Done, browser fill, native fullscreen and card persistence after reload. Live Playwright WebKit checked slot 1 import and bad-file rejection, slot 2 backup/import/reload with byte-for-byte persistence, and preserving slot 1/history. These used a private PadTest fixture in isolated contexts on this Mac, not a physical iPhone or retail-game save/load test. The user's live game and saves were untouched.

Previous GitHub release, **28 October 2026 (Hong Kong)**: GitHub Actions [run 40672938643](https://github.com/hemantai1101/EmulatorJS/actions/runs/40672938643) deployed commit `f2bbe5932a29c291feac7f48891968f1c6765d30` from `main`. Ready revision `ps1-player-00040-lv9` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:c29f3bfc13834d9b03c830a75ffde0b365767db7dd2d8834ecfb11a98247f136`. This publishes the previously tested landscape placement, analog/controller-state fixes, mouse buttons, direction icons and per-game choices from the fork. Local `make check`, the GitHub build/check/deploy and live-page job passed. A separate read-only live check matched the index, touch script, both engines, menu/recovery/recent-game scripts and search files (10 files) byte for byte against the tested build, with both isolation headers kept. The earlier Chrome/WebKit game/controller checks are recorded below; no new physical-phone claim is made. The user's live game and saves were untouched.

Previous local status release:

On **28 October 2026 (Hong Kong)**: local `make deploy` completed Cloud Build `bc3cb1d0-7cd7-4f3a-b547-f88ab4a51542`. Ready revision `ps1-player-00039-kx5` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:f26d435cec862c2d321e731993b7a1f5fa969e23861480d7a03cfa87cb70110f` (tag `20261028100629`). Picture & controls now shows actual PS1 analog On/Off/Unknown from a native snapshot. It refreshes on open, active panel polling, mode changes and restore; unchanged text is not rewritten or repeatedly announced. The manual override is under Advanced and names its next action. Stick/arrow choices automatically request analog/digital, read the actual result, avoid redundant or Unknown pulses, serialize rapid opposite choices, defer while paused, and apply after resume/restore. `ps1-game-direction-modes-v1` keeps direction choices per existing game-name/version ID; the old `ps1-direction-mode-v2` stays the browser fallback. Native snapshots do not write saved points. The pinned engine/checksum, game files, save IDs/history and shared save job stay unchanged. Versioned script/engine URLs fetch the matching status build.

`make check` passed, including actual/Unknown reads and latest-choice/no-redundant-toggle cases. Fresh muted Chrome and WebKit contexts with the private manual-mode PadTest fixture checked On/Off/Unknown, Advanced action labels, automatic choices, rapid choices, pause/resume, same-game reload and two-game isolation with no errors. Chrome loaded the exact supplied Crash game/save, moved Crash with the stick and verified native On → Off → On; WebKit also checked reload-dialog and Settings restore with that state. These controller and per-game checks passed live in WebKit, including no repeated live-region mutations for unchanged status. The exact Crash checks passed live in Chrome on the initial status revision. Live index, versioned touch script and both engines matched the final tested build byte for byte with isolation headers kept. No physical iPhone test was run. User files and the live game were untouched; fixtures/screenshots stay outside Git/public. This was a local deployment, not a GitHub release.

Initial status revision `ps1-player-00038-7qs` (Cloud Build `78c7c277-f1d8-4483-9cf1-27925f17b448`) was superseded by the current revision to suppress unchanged live-region writes.

Previous direction-icon release:

On **28 October 2026 (Hong Kong)**: local `make deploy` completed Cloud Build `f2b5d090-bc3c-436d-87d5-b0b56b4b389a`. Ready revision `ps1-player-00037-pld` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:c7260bb1466077915d83a6e4d214fbb9439e6bc5f852b386cba7889ca86d2346` (tag `20261028091535`). Direction control is now a pair of icon buttons (stick / arrow pad) in page Settings and Picture & controls, matching the Original/Zoom green pressed style. Native buttons keep hover titles, accessible names and aria-pressed, with mouse/touch/Enter/Space support. Page and quick choices stay in sync using the same saved preference and shared input reset. The pinned engine, input mappings, analog-state fix, save IDs/history and save job are unchanged.

`make check` passed. Fresh muted Chrome and Playwright WebKit contexts with the private PadTest fixture checked icons/names, pressed state, mouse/tap/Enter/Space, page/quick sync, saved arrow choice after reload, equal widths and 44 px minimum button height at 852×393, 393×852 and 320×568. Live WebKit repeated these checks and confirmed Picture zoom selection and Direction control stay independent. The live index matched the tested build byte for byte with both isolation headers kept. No physical phone test was run. User games and saves were untouched; fixtures/screenshots remain outside Git/public. This was a local deployment, not a GitHub release.

Previous mouse-button release:

On **28 October 2026 (Hong Kong)**: local `make deploy` completed Cloud Build `ebf27e9e-8110-40df-a42b-613dda46fb6c`. Ready revision `ps1-player-00036-zcn` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:3ec6b66b6ab43c9193d4d286a87977afbcb6f603f35be5d8a6d63f612c6bdf6b` (tag `20261028062802`). All virtual face buttons, Start, Select and arrows accept left mouse clicks/holds as well as the existing touch path. Mouse handlers capture the pointer, release outside, and clear on cancel, lost capture, blur/background, hide and shared resets. Quick mouse clicks stay active for 40 ms to span an input poll; long holds release immediately. Touch/pen/secondary mouse pointers are excluded from the mouse-only path. Arrow mouse drags use the existing touch geometry. Exact-match patches attach these helpers to both shipped engine builds, reading the game manager when input starts. Cache query versions were updated. The pinned release/checksum, analog-save fix, save IDs/history and shared save job stay unchanged.

`make check` passed, including late manager creation, mouse hold/quick-click timing, cancel/lost capture/blur/reset, unrelated pointers and arrow coordinate forwarding. Fresh muted Chrome and Playwright WebKit loaded the supplied Crash game/state at desktop and iPhone-landscape sizes. All six buttons passed mouse hold, quick click, highlight and outside release. Other checks covered right-click rejection, blur/hide release, arrow directions/diagonals and quick arrow clicks. Chrome checked both engine builds. Screenshots confirmed mouse Cross clicks make Crash jump. Phone simulations kept exactly one native down/up for each touch tap; Chrome CDP two-finger input released one face button while holding the other. The same full mouse checks passed in live desktop Chrome and iPhone-size WebKit, with WebKit touch parity. Live index, versioned touch script and both engines matched the tested build byte for byte, with both isolation headers kept. No physical phone test was run. The user's live game and save file were untouched, and private fixtures/screenshots stay outside Git/public. This was a local deployment, not a GitHub release.

Previous analog-state restore release:

On **28 October 2026 (Hong Kong)**: local `make deploy` completed Cloud Build `36ed250f-1011-4f81-8955-6c97994140a2`. Ready revision `ps1-player-00035-p5w` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:ec4d2ecd7173395703b4e5f6c4ccf7b6d2d75700f71b60a9c001b4811a809ca1` (tag `20261028060846`). The exact Crash 3 save supplied by the user reproduced an inert stick while digital directions worked: its DualShock analog mode was off. When Analog stick is selected, the shared restore hook now passes a separate in-memory buffer with only the port-one analog-mode and analog-button-choice flags enabled. The original file and IndexedDB bytes stay unchanged. Arrow-mode restores and already enabled controllers stay unchanged. Format checks are limited to the pinned PCSX ReARMed f29871d header/version, expected MEM length, a unique eight-record controller block and zero trailing core padding. Unknown layouts, other controller types, multitap and active configuration exchanges are skipped. These are core-format checks, not game/disc identity checks. Touch-script/engine query versions were updated; pinned engine/checksum, game IDs, save history and single-flight save writes stay unchanged.

`make check` passed, including separate-buffer preservation, only the two controller flags changing, enabled/arrow/legacy-standard cases, malformed and ambiguous layouts, and a single attached restore hook. Fresh muted Chrome at iPhone landscape size and Playwright WebKit tested the user's exact game and failing state. Chrome CDP touch drags and WebKit synthetic pointer drags visibly moved Crash after the fix; native snapshots confirmed analog mode after file import, reload-dialog restore and Settings restore. The source engine also passed. Live Chrome file-import/touch checks and WebKit reload/Settings restore checks passed with the exact state and no page errors. Live index, versioned touch script and both engines matched the tested build byte for byte, with isolation headers kept. A separate muted native Chrome Guest window was also opened through the UI on the live site, with the exact game/state and Show touch controls enabled; it is left open for the user to try. No physical iPhone test was run. The user's original state file and normal game window were untouched; test fixtures stay outside Git/public. This was a local deployment, not a GitHub release.

Previous desktop control-visibility release:

On **28 October 2026 (Hong Kong)**: local `make deploy` completed Cloud Build `5216e7c6-28c1-429b-bbb3-a2c17ad1eaf5`. Ready revision `ps1-player-00034-jr2` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:803eb41ca41eb1d934b0953074936015d0257a1bab177ed2425ed25962faf983` (tag `20261028053306`). Page Settings and Picture & controls add Show touch controls, including for computers without a touch screen. Both checkboxes stay in sync; explicit show/hide choices use localStorage key `ps1-show-touch-controls`, with the existing device default used otherwise. Hiding releases all digital and left analog inputs. Both engine builds cancel a pending temporary resize hide when control visibility is changed. Engine query versions fetch these patches on reload. Saves and their IDs are unchanged.

`make check` passed. Fresh muted no-touch desktop Chrome and Playwright WebKit contexts loaded the user-supplied Crash 3 BIN and a private test checkpoint. Real mouse drags visibly moved Crash; checks covered default hidden, page/quick switches, analog release, and saved show/hide choices after reload. Chrome repeated the checks with the source engine and a pending resize hide. A WebKit iPhone-landscape simulation kept the default controls visible and still moved Crash with synthetic pointer input. The live minified engine passed the full no-touch Chrome mouse/switch/preference checks. Live index, versioned touch script and both engines matched the tested build byte for byte, with both isolation headers kept. No physical iPhone check was run; the original iPhone failure after loading the user's own save remains open. User games and saves were untouched, and private test data stays outside Git/public. This was a local deployment, not a GitHub release.

Previous PS1 mode-switch release:

On **28 October 2026 (Hong Kong)**: local `make deploy` completed Cloud Build `0057b53f-7f08-4383-bcf8-bb8051e9620f`. Ready revision `ps1-player-00033-5pf` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:faa6b8bb0196465bf5db9d871c16f0a72c426bf473ceb18bb9fc257f3e4dce3c` (tag `20261028044616`). Picture & controls adds PS1 Analog on/off, allowing the game's DualShock digital/analog mode to be switched separately from the visible touch control. It uses the core's supported L3+R3 combo for two actual frames, releases the inputs, and restores the old combo option without persisting it. Repeated taps share one job; background/reset, pause, and stalled-frame paths release inputs. Analog remains the default; no automatic mode toggle is made because an already enabled game must not be switched off. Versioned touch-script and engine URLs fetch the matching analog build after reload. Game IDs, save history and the shared save job are unchanged.

`make check` passed, including mode-pulse sharing, cleanup, prior-option restoration and timeout checks. Fresh muted desktop Chrome and Playwright WebKit contexts tested the actual pinned core with a private PadTest variant whose four auto-configuration calls were disabled. Onscreen Digital → Analog → Digital → Analog was checked using image crops. Loading a toy state saved in Digital restored Digital, then the new button restored Analog. Chrome CDP touch and synthetic WebKit pointer checks still passed analog magnitude, axis changes, release/cancel/blur and arrow fallback/persistence. Chrome also passed at 568×320. The same full controller-mode and digital-state restore checks passed against the live URL in both browsers. Live index, versioned touch script and both engine files matched the tested build byte for byte with isolation headers kept. The user confirmed this release still did not move Crash 3 on their iPhone. Follow-up tests with their exact Crash Bandicoot 3 - Warped (Europe).bin visibly moved Crash in the playable warp room using native analog and the visible stick in fresh muted Chrome and Playwright WebKit contexts; WebKit used synthetic pointer events. The live URL passed the same real-game WebKit checks. A checkpoint made under the old standard-controller startup also regained analog movement under the current build. The physical iPhone cause remains unconfirmed. No physical iPhone test was run, and no further deployment was made for this follow-up. Test files/screenshots stay outside Git/public. This was a local deployment, not a GitHub release.

Previous analog-stick release:

On **28 October 2026 (Hong Kong)**: local `make deploy` completed Cloud Build `0f09ac3a-468b-493b-aff5-a124e5ed1c2f`. Ready revision `ps1-player-00032-w6r` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:cc36691b26d0613bfba009f7477207bc6c400aaab3f281f195b614971f9fe9d9` (tag `20261027190205`). Analog stick is the new default, with continuous left-stick strength, a centre dead zone, and an Arrow buttons choice in both page Settings and Picture & controls. The engine starts PCSX ReARMed with port 1 DualShock via `--device=1:517`, applied by exact-match release patches; the pinned engine release/checksum stay the same. New preference `ps1-direction-mode-v2` keeps future explicit choices and leaves the legacy preference key untouched. Saves, game names, and IDs are unchanged.

`make check` passed, including analog magnitude/signs/clamp/dead zone, resets, shipped hooks and both engine startup arguments. Fresh muted Chrome and Playwright WebKit contexts loaded the public PadTest 1.1 BIN/CUE ZIP in the actual pinned core. Port 1 reported Analog, and small/large pushes produced different onscreen values. Chrome CDP touch and synthetic WebKit pointer drags checked real stick handlers at strengths 9362 and 30427, axis reversal, end/cancel/blur release, analog default despite the legacy saved arrow default, arrow fallback and preference restore, with no page errors. Both browsers passed the same checks against the live URL. Eight-size local layout/touch checks passed with both engine files, and a real Global Force state still loaded for WebKit landscape/panel/menu checks. Live index, touch script, and both engine files matched the tested build byte for byte with both isolation headers kept. No physical iPhone or retail action-game analog test was run. The user's live game was untouched. This was a local deployment, not a GitHub release.

Previous lower-controls release:

On **28 October 2026 (Hong Kong)**: local `make deploy` completed Cloud Build `973b1aad-5b97-4d2f-86e2-a66fe12ccec0`. Ready revision `ps1-player-00031-vbr` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:06ace061ab1736b6f4deb45afb34ca69b2646c9ae1812a8ca49aa4b8970bba05` (tag `20261027184934`). In short wide player views (at least 3:2 and at most 500 px tall), the main touch groups sit near the safe bottom edge and Select/Start sit above them. Fixed-size stick clearance is included. Portrait and taller wide views keep their placement; the saved spacing slider still moves both sides together. `make check` passed. Fresh muted Chrome and Playwright WebKit contexts checked eight viewport sizes, both size limits, bottom and stick clearance, Select/Start placement, spacing/reset/preferences, and D-pad/face/Select/Start touch press/release using both shipped engines. Real Global Force normal/browser-fill checks passed in WebKit at 852×393 and Chrome at 568×320, including Zoom, menu and Settings panels. Live WebKit checks repeated the eight-size checks with the shipped minified engine. Live index/menu/minified engine bytes matched the tested build with both isolation headers kept. Safe areas were simulated; no physical iPhone test was run. The user's live game and saves were untouched. This was a local deployment, not a GitHub release.

Previous control-spacing release:

On **28 October 2026 (Hong Kong)**: local `make deploy` completed Cloud Build `6fdc1ec2-18b3-4b32-bbca-b05b62bc69c9`. Ready revision `ps1-player-00030-cc8` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:e4f070ab728ddf64c8655f9b66bb6ee76da1ba6713c97a21d57659a3f020d394` (tag `20261027184322`). Wide views put controls in the available side space, with Select/Start below their groups. Picture & controls adds one saved Control spacing slider and Reset spacing. The picture size stays the same; tight screens can still have some overlap. `make check` passed. Fresh muted Chrome and Playwright WebKit checks covered eight viewport sizes, paired movement, reset, saved 0%, size limits, rotation, panel keyboard/Reset/Done, and touch press/release for face/Select/Start buttons using both shipped engines. Real Global Force normal/browser-fill checks passed in WebKit at 852×393 and Chrome at 568×320, including picture/panels/menu/Settings. The live minified engine passed the spacing, panel, touch, and preference checks in fresh WebKit contexts at all eight sizes. Live index, menu script, and minified engine matched the tested build byte for byte with both isolation headers kept. Safe areas and the iPhone fullscreen fallback were simulated; no physical iPhone test was run. The user's live game and saves were untouched. This was a local deployment, not a GitHub release.

Previous desktop menu-button release:

On **27 October 2026 (Hong Kong)**: local `make deploy` completed Cloud Build `e6531f19-4093-459b-8d64-13cb5999b419`. Ready revision `ps1-player-00029-228` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:2a55b2706d0d0f9251d60e76e63e127c9e42b731dfdad7f249ca348285223656` (tag `20261027100912`). The page now creates a Game menu button when the engine omits its touch-only button on computers without a touch screen. The existing touch button is reused, so each view has one menu button. `make check` passed. Fresh muted no-touch desktop Chrome contexts checked both local engine files in normal, Fill screen, and native fullscreen: one visible 44 px menu button, click and Enter/Space open/close, Escape, outside close, no auto-open/auto-hide, and Settings close/reopen. The same desktop checks passed with the live minified engine. Simulated-touch menu checks also passed locally. Tests used dummy game data, not a real game or physical phone/tablet. Live index, menu script, and minified engine matched the tested build byte for byte with both isolation headers kept. The user's live game was untouched. This was a local deployment, not a GitHub release.

Previous button-only menu release:

On **27 October 2026 (Hong Kong)**: local `make deploy` from the working checkout completed Cloud Build `2cb4ee22-21c3-406b-aa2c-ae2d44c8becd`. Ready revision `ps1-player-00027-455` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:96e702be154daf52b8d223cb0429465a6019f8d71010bb5c7f25c56bad5b3522` (tag `20261027083740`). This was a local deployment, not a GitHub release. The game menu opens only from its button and stays open until the button, an outside press, or Escape closes it. Game clicks, taps, and mouse moves cannot open it; repeated button presses have no two-second lockout. `make check` and the existing Chrome menu action checks passed. Fresh muted Chrome contexts checked mouse and simulated touch with both local engine files, then repeated the menu checks against the live minified engine: no auto-open/auto-hide, fast toggles, inside controls, desktop/phone outside close, Settings close/reopen, and Enter/Space/Escape. Tests used dummy game data, not a real game or physical phone/tablet. Live index, menu script, and both engine files matched the tested build byte for byte with both isolation headers kept. The user's live game was not reloaded or used for testing.

Previous responsive-layout release:

On **25 October 2026 (Hong Kong)**: GitHub Actions [run 40181458064](https://github.com/hemantai1101/EmulatorJS/actions/runs/40181458064) deployed commit `db4df7be05d96205998819a40d4a8d15e51e50ad` from [PR #14](https://github.com/hemantai1101/EmulatorJS/pull/14). Ready revision `ps1-player-00026-mkz` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:6258fcc121b928478759fdb93530858fb5a065120ec0da8c8f028cf8308d52ae`. The game picture starts below a separate tool row; short landscape controls fit the available height, and phone page icons stay 44 px. Before the code commit, real Global Force gameplay passed 12 viewport sizes in fresh muted Chrome and WebKit contexts: normal/fullscreen at each size, desktop browser fill, menus/Settings, max control size, rotation, and touch input. 128 screenshots and dimension reports stay outside Git/public. Mobile safe areas, touch capability, and fullscreen fallback were simulated; no physical iPhone/iPad test was run. GitHub checks/deploy and `make check` passed. Live index bytes matched the tested build and isolation headers stayed in place. Follow-up real-game checks on the live URL passed iPhone portrait/rotation in WebKit and normal/fullscreen/browser fill on desktop Chrome.

Previous desktop-fill release:

On **25 October 2026 (Hong Kong)**: GitHub Actions [run 40176550533](https://github.com/hemantai1101/EmulatorJS/actions/runs/40176550533) deployed commit `c68d34cd07f1af527dca3cf132450352785b1e23` from [PR #13](https://github.com/hemantai1101/EmulatorJS/pull/13). Ready revision `ps1-player-00025-vwt` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:6b7a47a4c6c3e230e78bb2236441345e88870187275b8936f203efbaaf7b34b5`. Desktop Fill screen fills the browser window without native fullscreen. Matching 44 px icons have accessible names and hover labels; saving keeps its icon. GitHub checks/deploy and `make check` passed. Live index/recovery bytes matched the build with isolation headers kept. Fresh muted desktop Chrome contexts checked the live window fill, resizing, native fullscreen, exit/focus, icon sizes, Settings, and dummy saves. Touch-tablet emulation confirmed Fill screen stays hidden. No physical iPad test was run.

Previous quick-tools release:

On **25 October 2026 (Hong Kong)**: GitHub Actions [run 40122781988](https://github.com/hemantai1101/EmulatorJS/actions/runs/40122781988) deployed commit `6eb136464c7ef4209d723765efd4aaf474268e70` from [PR #12](https://github.com/hemantai1101/EmulatorJS/pull/12). Ready revision `ps1-player-00024-hqm` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:93eb9590054a9c6402496c00202ba48111608d5956a6b89c24799b7140f36020`. The quick panel uses a sliders icon and Original/Zoom buttons without an auto-open dropdown. The three top tools share one toolbar, and PS1 symbols use matching SVG sizes/strokes. GitHub checks/deploy passed. Live index bytes matched the build with isolation headers kept. A fresh muted desktop Chrome context checked the served panel focus/toggles, toolbar alignment with simulated safe-area padding, matching SVG geometry and real touch press/release, native menu and fullscreen exit at tablet/phone sizes. Existing Settings scroll and volume checks passed locally. No physical iPad or real-game test was run.

Previous Settings-view release:

On **25 October 2026 (Hong Kong)**: GitHub Actions [run 40121898240](https://github.com/hemantai1101/EmulatorJS/actions/runs/40121898240) deployed commit `8416ca6d3d04a0a511ad101aee17a4ab17fe474d` from [PR #11](https://github.com/hemantai1101/EmulatorJS/pull/11). Ready revision `ps1-player-00023-jbn` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:4db5d15bf26b5fb63cabc366fb28b4fc1eacf3f6bc304c34b37d3a86b6aaf804`. Settings now opens at the top of its own view within the menu, with a sticky Back button and one scroll area; frame touches do not collapse it. Names stay unchanged. GitHub checks/deploy passed. Live index/menu bytes matched the local build with isolation headers kept. A fresh muted desktop Chrome context checked the served Settings view, frame touches and an edge swipe, Back, Escape, rotation, tablet/phone layouts, and existing save/restart actions with dummy game data. Volume drag checks also passed locally. No physical iPad or real-game test was run.

Previous startup-menu release:

On **25 October 2026 (Hong Kong)**: GitHub Actions [run 40121274364](https://github.com/hemantai1101/EmulatorJS/actions/runs/40121274364) deployed commit `420c823e1c58756704111ebb6c2171a4e3a393ea` from [PR #10](https://github.com/hemantai1101/EmulatorJS/pull/10). Ready revision `ps1-player-00022-vnc` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:7a551832358e95c56b9f66377e4b7c5a81316a9f5f32b4c1eea149dbcf94e74d`. The menu starts closed after the engine starts; its icon still opens it. GitHub checks/deploy passed. Live index/menu bytes matched the local build with isolation headers kept. The closed-at-start and touch-icon-open checks plus existing menu checks passed against live assets in a fresh muted desktop Chrome context with dummy game data. No physical iPad or real-game test was run.

Previous volume-slider release:

On **25 October 2026 (Hong Kong)**: GitHub Actions [run 40121012938](https://github.com/hemantai1101/EmulatorJS/actions/runs/40121012938) deployed commit `d55fbcbc8e39a644d5249942f162d0299b632e57` from [PR #9](https://github.com/hemantai1101/EmulatorJS/pull/9). Ready revision `ps1-player-00021-pm4` serves 100% of traffic, image digest `sha256:f184222d8fd16d838b45e4a9f1b9ffe0719ec4e66f6cab3910ba179a6266c86e`. The volume slider now has usable width and updates engine volume while dragging. GitHub build/check/deploy passed. Live index/menu bytes matched the local build and both isolation headers remained. The same mouse/touch drag, keyboard, engine gain, and Mute/Unmute checks passed against live assets in a fresh muted desktop Chrome context at tablet and phone sizes, with dummy game data. No physical iPad or real-game audio test was run.

Previous menu release:

On **25 October 2026 (Hong Kong)**: GitHub Actions [run 40120591550](https://github.com/hemantai1101/EmulatorJS/actions/runs/40120591550) deployed commit `c8c191dffd805d5eebb94461b869893237c1a393` from [PR #8](https://github.com/hemantai1101/EmulatorJS/pull/8). Ready revision `ps1-player-00020-s5h` serves 100% of traffic, image digest `sha256:b1a91a5a684464a6783bb32c0ac144124c21921fdf4db2bcbb39d0d1bac1ac31`. This adds the grouped grey game menu without renaming existing actions, separates Select/Start, removes Fast/Slow touch buttons, and confirms Restart. GitHub checks and deployment passed. The live page, menu/recovery scripts, engine, robots, sitemap, and verification file matched the local build byte for byte with both isolation headers. Muted desktop Chrome checked the native menu/settings, state download/import using dummy bytes, save delegation and disabled state, Restart cancel/confirm, Escape, and tablet/phone spacing. No physical iPad or real-game test was run.

Previous touch-controls release:

On **25 October 2026 (Hong Kong)**, GitHub Actions [run 40119257232](https://github.com/hemantai1101/EmulatorJS/actions/runs/40119257232) deployed commit `d7f115585e16c079aae39868a1e6a06f5347aa61` from merged [PR #7](https://github.com/hemantai1101/EmulatorJS/pull/7). Ready revision `ps1-player-00019-jrn` receives 100% of traffic. Its image digest is `sha256:0c212ba124bf02db321fa7c792c232901573d2eb809abe752c7c2dbba155f8c2`. The release includes larger translucent touch controls, spaced coloured PS1 symbols, matching picture/fullscreen tools, saved size/strength settings, Play last game, blank popup titles, and five-minute/latest-10 saves. Main's search metadata, robots, sitemap, and verification file are preserved.

The GitHub build, player checks, deployment, and live check passed. The normal player address returned HTTP 200. The page, recent-game and recovery scripts, both engine files, robots, sitemap, and verification file matched the local build byte for byte, with both isolation headers kept. Muted desktop Chrome checks used dummy game data at tablet and phone sizes to check layout, zoom, preference restore, and engine touch press/release. No real game or physical iPad/iPhone test was run for this UI release.

The initial local Cloud Build `adf0cad2-0794-4f27-a422-657fed06f4d6` deployed `ps1-player-00018-r2r` before the user requested GitHub deployment. It was superseded by the GitHub release above. Earlier revision `ps1-player-00017-8cf`, image tag `20261024062118`, digest `sha256:105d9bc9cf5cf3702bd51ff7a33eaff3e3c788f4aa6dedfc123624c321a291ed`, served the save/recent-game/popup features before the touch update.

## Container and Cloud Run settings

| Setting | Value |
| --- | --- |
| Base image | `nginxinc/nginx-unprivileged:stable-alpine` |
| Container port | `8080` |
| CPU / memory | `1` CPU / `256Mi` |
| Minimum instances | `0` (default; scale to zero) |
| Maximum instances per revision | `1`, set by deploy.sh |
| Service-level maximum | `20` in the current service metadata |
| Requests per instance | `80` |
| Request timeout | `60` seconds |
| Startup CPU boost | Enabled |
| Ingress | All |
| Public access | `allUsers` has `roles/run.invoker` |

The current single serving revision is limited to one instance. Do not read that as a whole-project spending cap, or assume the service-level maximum is also one. Inspect scaling again if splitting traffic across revisions.

The Nginx base tag can change between builds. Keep old image digests when planning a rollback.

Nginx serves static files only. Emulation runs on the user's device. There is no game-upload server, cloud save database, or secret required by the player container.

`nginx.conf` adds `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, and `X-Content-Type-Options: nosniff`. The index response uses `Cache-Control: no-cache`. Preserve the isolation headers when changing hosting.

Both `.gcloudignore` and `.dockerignore` allow only `Dockerfile`, `nginx.conf`, and `public/`. Never put ROMs, BIOS files, saves, credentials, or signed links in `public/`.

## Accounts and permissions

These are separate identities:

- **Deploy operator:** the signed-in gcloud user. It needs permission to submit builds, use the source bucket, deploy Cloud Run, use the runtime account, and set public invoker access.
- **Build account:** the verified build used `168235937982-compute@developer.gserviceaccount.com`. It currently has project-level `roles/editor`. This is the existing broad grant, not a least-privilege template to copy into a new project.
- **Runtime account:** `ps1-player-runtime@heman-dev.iam.gserviceaccount.com`. The project IAM check returned no project roles for it. Static serving does not need bucket access.
- **Download signer:** has `roles/storage.objectViewer` on the private download bucket. The current operator has `roles/iam.serviceAccountTokenCreator` on the signer account. No downloaded service-account key is used for signed links.

A future build account needs source-read, image-write, and build-log permissions; the deploy operator also needs to be allowed to use that build account when required by the build configuration. Review the actual build identity and IAM errors before granting roles. Build, runtime, and download signing do not need to share an account.

## Inspect a deployment

```sh
gcloud run services describe ps1-player --project=heman-dev --region=asia-east2 --format='yaml(status.url,status.latestReadyRevisionName,status.traffic)'
gcloud builds list --project=heman-dev --region=asia-east2 --limit=5
gcloud run services logs read ps1-player --project=heman-dev --region=asia-east2 --limit=50
curl -I https://ps1-player-168235937982.asia-east2.run.app/
```

Expect the ready revision to receive traffic and the page to return HTTP 200 with the isolation headers. Build logs explain preparation/container failures. Cloud Run logs explain server/startup failures. Device-side emulator failures may not appear in Cloud Run logs.

For a browser check, mute before starting a game test. Use a separate test tab and protect the user's live game and saves. Check loading a game, controls, fullscreen, Save now, and restore as relevant to the change. Record which browser/device was actually tested.

## Roll back to a working revision

List retained revisions first:

```sh
gcloud run revisions list --service=ps1-player --project=heman-dev --region=asia-east2 --format='table(metadata.name,metadata.creationTimestamp,spec.containers[0].image)'
```

Choose a known working revision from that list. This example returns traffic to the revision verified on 23 October; use a newer known working name if appropriate:

```sh
gcloud run services update-traffic ps1-player --project=heman-dev --region=asia-east2 --to-revisions=ps1-player-00011-lp7=100
```

Re-run the inspection commands and check the player. This changes serving traffic; it does not revert Git or undo a user's browser save changes. The revision and its image must still exist.

After a rollback, inspect traffic on the next deploy. If traffic remains pinned to the older revision, first verify the new ready revision, then explicitly route traffic with `gcloud run services update-traffic ps1-player --project=heman-dev --region=asia-east2 --to-latest`.

## Private file downloads

The download bucket is separate from the public player. Its location is `ASIA-EAST2`, uniform bucket-level access is enabled, and public access prevention is enforced. The app does not read from it. Uploads here are manual, user-requested transfers.

Export the latest state from the running game first. Do not assume the newest file already in Downloads is the current game state. A `.state` export should begin with `RASTATE`; that header alone does not prove it belongs to the right game or disc.

Change only the file path on the first line of this example:

```sh
PS1_STATE_FILE='/absolute/path/to/exported.state'
PS1_OBJECT="gs://heman-dev-ps1-downloads-168235937982/$(basename "$PS1_STATE_FILE")"
gcloud storage cp "$PS1_STATE_FILE" "$PS1_OBJECT" --project=heman-dev --content-type=application/octet-stream
gcloud storage sign-url "$PS1_OBJECT" --project=heman-dev --region=asia-east2 --duration=12h --impersonate-service-account=ps1-download-signer@heman-dev.iam.gserviceaccount.com
```

Keep `--region=asia-east2` on the sign command. The signer can read objects but cannot auto-detect the bucket region with its current permissions.

Open the returned signed URL and compare the downloaded bytes or SHA-256 with the export before handing it over. Tell the user the export time and link expiry. Keep actual signed URLs out of Git. A link expiring does not delete the uploaded object. No automatic lifecycle cleanup policy was returned in the bucket check; remove files only when their removal is authorized.

## Rebuild missing resources

The resources above already exist. The following are starting points for restoring missing resources, not commands to run on every deploy:

```sh
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iam.googleapis.com iamcredentials.googleapis.com --project=heman-dev
gcloud artifacts repositories create ps1-player --project=heman-dev --location=asia-east2 --repository-format=docker
gcloud iam service-accounts create ps1-player-runtime --project=heman-dev --display-name='PS1 Player runtime'
```

Do not grant the runtime account Editor. Set up build/operator permissions separately as described above, then run `make deploy`. This is an operating guide, not a full infrastructure-as-code restore: custom IAM, source-bucket setup, the private download bucket, signer access, and billing must also be restored if lost. Keep the existing project and address when possible to preserve the normal browser save origin.

## Costs and cleanup

Cloud Run can scale to zero. Builds, image/source storage, download-bucket storage, and data transfer can still cost money. No numeric price or total spending cap is claimed here.

Inspect Artifact Registry images and the Cloud Build source bucket periodically. Keep images needed for rollback. Do not delete revisions, images, game downloads, or save exports just because a deployment finished. Cleanup is separate from deployment and needs its own retention decision.
