#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ENV="${1:-production}"

if [[ "$DEPLOY_ENV" != "production" && "$DEPLOY_ENV" != "staging" ]]; then
  echo "Usage: $0 [production|staging]" >&2
  exit 2
fi

: "${SERVER_HOST:?Set SERVER_HOST to the deployment server host}"
: "${SERVER_USER:=root}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_REPO_DIR="${REMOTE_REPO_DIR:-/root/focus-go}"
SSH_OPTS=(
  -o StrictHostKeyChecking=no
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=6
  -o ConnectTimeout=30
)

if [[ -n "${SSH_KEY_PATH:-}" ]]; then
  SSH_OPTS=(-i "$SSH_KEY_PATH" "${SSH_OPTS[@]}")
fi

SSH_CMD=(ssh)
if [[ -n "${SSH_PASSWORD:-}" ]]; then
  command -v sshpass >/dev/null || {
    echo "SSH_PASSWORD requires sshpass to be installed" >&2
    exit 2
  }
  export SSHPASS="$SSH_PASSWORD"
  SSH_CMD=(sshpass -e ssh)
fi

RSYNC_RSH="$(printf '%q ' "${SSH_CMD[@]}" "${SSH_OPTS[@]}")"

STAMP="$(date +%Y%m%d_%H%M%S)"
REMOTE_DIST_DIR="${REMOTE_REPO_DIR}/.deploy-dist-cache/${DEPLOY_ENV}"

cleanup() {
  rm -rf "$REPO_ROOT/apps/web/dist-direct-${STAMP}" 2>/dev/null || true
}
trap cleanup EXIT

cd "$REPO_ROOT"

echo "=== [1/5] install dependencies ==="
ROOT_LOCK_HASH="$(shasum -a 256 package-lock.json | cut -d' ' -f1)"
ROOT_LOCK_HASH_FILE="node_modules/.deploy-lock-hash"
if [[ -f "$ROOT_LOCK_HASH_FILE" && "$(cat "$ROOT_LOCK_HASH_FILE")" == "$ROOT_LOCK_HASH" && -d node_modules ]]; then
  echo "npm ci skipped — root lock unchanged"
else
  npm ci
  echo "$ROOT_LOCK_HASH" > "$ROOT_LOCK_HASH_FILE"
fi

echo "=== [2/5] build web ==="
VITE_API_BASE="${VITE_API_BASE:-https://api.nestflow.art}" \
VITE_REDIRECT_URI="${VITE_REDIRECT_URI:-https://app.nestflow.art/}" \
npm run build:web

echo "=== [3/5] sync server-side deploy files to ${SERVER_USER}@${SERVER_HOST}:${REMOTE_REPO_DIR} ==="
"${SSH_CMD[@]}" "${SSH_OPTS[@]}" "${SERVER_USER}@${SERVER_HOST}" \
  "mkdir -p '$REMOTE_REPO_DIR/apps/web/focus-go-api'"
rsync -az \
  -e "$RSYNC_RSH" \
  "$REPO_ROOT/deploy.sh" \
  "${SERVER_USER}@${SERVER_HOST}:${REMOTE_REPO_DIR}/deploy.sh"
rsync -az --delete \
  --exclude 'node_modules/' \
  --exclude 'data/' \
  --exclude 'logs/' \
  --exclude '*.log' \
  --exclude '.DS_Store' \
  --exclude '.deploy-lock-hash' \
  --exclude '.env' \
  --exclude '.env.*' \
  -e "$RSYNC_RSH" \
  "$REPO_ROOT/apps/web/focus-go-api/" \
  "${SERVER_USER}@${SERVER_HOST}:${REMOTE_REPO_DIR}/apps/web/focus-go-api/"

echo "=== [4/5] upload dist ==="
"${SSH_CMD[@]}" "${SSH_OPTS[@]}" "${SERVER_USER}@${SERVER_HOST}" "mkdir -p '$REMOTE_DIST_DIR'"
rsync -azc --delete \
  -e "$RSYNC_RSH" \
  "$REPO_ROOT/apps/web/dist/" \
  "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIST_DIR}/"

echo "=== [5/5] run remote deploy without GitHub ==="
"${SSH_CMD[@]}" "${SSH_OPTS[@]}" "${SERVER_USER}@${SERVER_HOST}" \
  "cd '$REMOTE_REPO_DIR' && DEPLOY_SKIP_GIT_FETCH=1 bash '$REMOTE_REPO_DIR/deploy.sh' '$DEPLOY_ENV' '$REMOTE_DIST_DIR'"

echo "=== Direct deploy complete: ${DEPLOY_ENV} ==="
