# PS1 Player deployment

This is the guide for the existing GCP setup. Resource settings below were checked on **23 October 2026**. Run the inspection commands again when debugging; the snapshot can go stale.

## Deploy the latest code

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

The last verified ready revision was `ps1-player-00011-lp7`, with 100% of traffic. Its image tag was `20261023050145`. Later local commits added project tooling and docs; those commits do not by themselves change the live site.

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
