#!/usr/bin/env bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────
DEPLOY_ENV="${1:-production}"
REPO_DIR="/root/focus-go"

if [[ "$DEPLOY_ENV" == "staging" ]]; then
  BRANCH="develop"
  API_PORT=3001
  PM2_APP_NAME="focus-go-api-staging"
  DEPLOY_ROOT="/var/www/focus-go-staging"
  NODE_ENV="staging"
  VITE_API_BASE="https://api.nestflow.art"
else
  BRANCH="main"
  API_PORT=3000
  PM2_APP_NAME="focus-go-api"
  DEPLOY_ROOT="/var/www/focus-go"
  NODE_ENV="production"
  VITE_API_BASE="https://api.nestflow.art"
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RELEASE_DIR="$DEPLOY_ROOT/releases/$TIMESTAMP"
CURRENT_LINK="$DEPLOY_ROOT/current"
API_DIR="$REPO_DIR/apps/web/focus-go-api"

echo "=== Deploy: $DEPLOY_ENV | branch: $BRANCH | port: $API_PORT ==="

# ── 1. Fetch code ─────────────────────────────────────────────────
echo "=== [1/8] git fetch origin/$BRANCH ==="
cd "$REPO_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# ── 2. Dependencies ───────────────────────────────────────────────
echo "=== [2/8] npm ci ==="
npm ci

# ── 3. Build ──────────────────────────────────────────────────────
echo "=== [3/8] build:web (NODE_ENV=$NODE_ENV) ==="
printf "VITE_API_BASE=%s\nVITE_REDIRECT_URI=https://app.nestflow.art\n" "$VITE_API_BASE" > apps/web/.env.production
NODE_ENV="$NODE_ENV" npm run build:web

# ── 4. Create release dir ─────────────────────────────────────────
echo "=== [4/8] create release $TIMESTAMP ==="
mkdir -p "$RELEASE_DIR"
cp -r apps/web/dist/. "$RELEASE_DIR/"

# ── 5. Switch symlink ─────────────────────────────────────────────
echo "=== [5/8] symlink → $RELEASE_DIR ==="
PREVIOUS_RELEASE=$(readlink "$CURRENT_LINK" 2>/dev/null || echo "")
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

# ── 6. Nginx reload ───────────────────────────────────────────────
echo "=== [6/8] nginx reload ==="
nginx -t
systemctl reload nginx

# ── 7. PM2 reload API ─────────────────────────────────────────────
echo "=== [7/8] PM2 reload $PM2_APP_NAME ==="
cd "$API_DIR"
npm ci --omit=dev
PORT=$API_PORT NODE_ENV=$NODE_ENV pm2 reload "$PM2_APP_NAME" --update-env \
  || PORT=$API_PORT NODE_ENV=$NODE_ENV pm2 start index.js --name "$PM2_APP_NAME"

# ── 8. Health check ───────────────────────────────────────────────
echo "=== [8/8] health check (localhost:$API_PORT/health) ==="
sleep 8
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$API_PORT/health" || echo "000")

if [[ "$HTTP_STATUS" != "200" ]]; then
  echo "❌ Health check FAILED (HTTP $HTTP_STATUS)"
  if [[ -n "$PREVIOUS_RELEASE" ]]; then
    echo "↩ Rolling back to $PREVIOUS_RELEASE"
    ln -sfn "$PREVIOUS_RELEASE" "$CURRENT_LINK"
    systemctl reload nginx
    rm -rf "$RELEASE_DIR"
  fi
  exit 1
fi

echo "✅ Health check passed (HTTP 200)"

# ── Cleanup: keep last 5 releases ────────────────────────────────
ls -1dt "$DEPLOY_ROOT/releases"/*/ 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true

echo "=== Deploy complete: $DEPLOY_ENV @ $TIMESTAMP ==="
