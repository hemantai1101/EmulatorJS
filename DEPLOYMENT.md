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

Latest verified release, **25 October 2026 (Hong Kong)**: GitHub Actions [run 40121898240](https://github.com/hemantai1101/EmulatorJS/actions/runs/40121898240) deployed commit `8416ca6d3d04a0a511ad101aee17a4ab17fe474d` from [PR #11](https://github.com/hemantai1101/EmulatorJS/pull/11). Ready revision `ps1-player-00023-jbn` serves 100% of traffic, image `asia-east2-docker.pkg.dev/heman-dev/ps1-player/player@sha256:4db5d15bf26b5fb63cabc366fb28b4fc1eacf3f6bc304c34b37d3a86b6aaf804`. Settings now opens at the top of its own view within the menu, with a sticky Back button and one scroll area; frame touches do not collapse it. Names stay unchanged. GitHub checks/deploy passed. Live index/menu bytes matched the local build with isolation headers kept. A fresh muted desktop Chrome context checked the served Settings view, frame touches and an edge swipe, Back, Escape, rotation, tablet/phone layouts, and existing save/restart actions with dummy game data. Volume drag checks also passed locally. No physical iPad or real-game test was run.

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
