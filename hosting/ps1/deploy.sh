#!/bin/sh
set -eu
cd "$(dirname "$0")"
PS1_PROJECT="${PS1_PROJECT:-heman-dev}"
PS1_REGION="asia-east2"
PS1_IMAGE="$PS1_REGION-docker.pkg.dev/$PS1_PROJECT/ps1-player/player:$(date -u +%Y%m%d%H%M%S)"
test -f public/data/cores/pcsx_rearmed-wasm.data || python3 prepare.py
gcloud builds submit . --tag="$PS1_IMAGE" --project="$PS1_PROJECT" --region="$PS1_REGION" --quiet
gcloud run deploy ps1-player \
    --image="$PS1_IMAGE" \
    --project="$PS1_PROJECT" \
    --region="$PS1_REGION" \
    --service-account="ps1-player-runtime@$PS1_PROJECT.iam.gserviceaccount.com" \
    --allow-unauthenticated \
    --port=8080 --cpu=1 --memory=256Mi \
    --min-instances=0 --max-instances=1 \
    --concurrency=80 --timeout=60 --quiet
