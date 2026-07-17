#!/usr/bin/env bash
# Build the API image, push to GHCR, and redeploy it on the VM.
# Run from the repo root: ./deploy/deploy.sh
set -euo pipefail

IMAGE="ghcr.io/victorthedev/groovz-api:latest"
VM_HOST="ubuntu@groovz-api.duckdns.org"
SSH_KEY="$HOME/.ssh/oracle_groovz"
REMOTE_DIR="~/Groovz"

echo "==> Building image (linux/amd64)"
docker build --platform linux/amd64 -f apps/api/Dockerfile -t "$IMAGE" .

echo "==> Pushing to GHCR"
docker push "$IMAGE"

echo "==> Redeploying on VM"
ssh -i "$SSH_KEY" "$VM_HOST" "
  set -e
  cd $REMOTE_DIR && git pull
  cd deploy && sudo docker compose pull && sudo docker compose up -d
"

echo "==> Done. Verifying health endpoint"
sleep 3
curl -sf https://groovz-api.duckdns.org/health && echo " — healthy" || echo " — health check failed, check VM logs"
