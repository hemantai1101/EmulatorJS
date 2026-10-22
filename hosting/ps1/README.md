# PS1 player on Cloud Run

This hosts the player in `heman-dev`, in Hong Kong (`asia-east2`).
The page is public. Game and BIOS files are read on the device, not uploaded.
Saves stay in that browser. To move a save from a Mac to an iPhone, export it on the Mac, copy the file to the iPhone, then load it there.

Open the deployed HTTPS link in Safari. Pick a game from Files and press Play.
The BIOS file is optional; the built-in substitute can cause game or save bugs.
Touch controls appear on phones. Turn the phone sideways for more room.

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
