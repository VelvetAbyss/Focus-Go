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
  APP_REDIRECT_URI="https://app.nestflow.art/"
else
  BRANCH="main"
  API_PORT=3000
  PM2_APP_NAME="focus-go-api"
  DEPLOY_ROOT="/var/www/focus-go"
  NODE_ENV="production"
  VITE_API_BASE="https://api.nestflow.art"
  APP_REDIRECT_URI="https://app.nestflow.art/"
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RELEASE_DIR="$DEPLOY_ROOT/releases/$TIMESTAMP"
CURRENT_LINK="$DEPLOY_ROOT/current"
API_DIR="$REPO_DIR/apps/web/focus-go-api"
# Pre-built dist dir uploaded by CI (2nd arg); falls back to building locally
DIST_SRC="${2:-}"

echo "=== Deploy: $DEPLOY_ENV | branch: $BRANCH | port: $API_PORT ==="

# ── 0. Pre-flight: verify API .env exists ─────────────────────────
if [[ ! -f "$API_DIR/.env" ]]; then
  echo "❌ Missing $API_DIR/.env — create it from .env.example before deploying"
  exit 1
fi

# ── 0.1. Enforce auth redirect URI consistency ────────────────────
if grep -q '^AUTHING_REDIRECT_URI=' "$API_DIR/.env"; then
  sed -i.bak "s|^AUTHING_REDIRECT_URI=.*|AUTHING_REDIRECT_URI=$APP_REDIRECT_URI|" "$API_DIR/.env"
else
  printf "\nAUTHING_REDIRECT_URI=%s\n" "$APP_REDIRECT_URI" >> "$API_DIR/.env"
fi
rm -f "$API_DIR/.env.bak"

# ── 1. Fetch code (for API + config; web already built on CI) ─────
echo "=== [1/8] git fetch origin/$BRANCH ==="
cd "$REPO_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# ── 2. API dependencies (cached by lock hash) ─────────────────────
API_LOCK_HASH=$(sha256sum "$API_DIR/package-lock.json" | cut -d' ' -f1)
API_LOCK_HASH_FILE="$API_DIR/.deploy-lock-hash"
if [[ -f "$API_LOCK_HASH_FILE" && "$(cat "$API_LOCK_HASH_FILE")" == "$API_LOCK_HASH" && -d "$API_DIR/node_modules" ]]; then
  echo "=== [2/8] api npm ci (skipped — lock unchanged) ==="
else
  echo "=== [2/8] api npm ci ==="
  cd "$API_DIR" && npm ci && cd "$REPO_DIR"
  echo "$API_LOCK_HASH" > "$API_LOCK_HASH_FILE"
fi

# ── 3. Use pre-built dist (built on CI) ───────────────────────────
if [[ -n "$DIST_SRC" && -d "$DIST_SRC" ]]; then
  echo "=== [3/8] using pre-built dist from CI: $DIST_SRC ==="
else
  echo "=== [3/8] no CI dist provided — building locally ==="
  printf "VITE_API_BASE=%s\nVITE_REDIRECT_URI=%s\n" "$VITE_API_BASE" "$APP_REDIRECT_URI" > apps/web/.env.production
  NODE_ENV="$NODE_ENV" npm run build:web
  DIST_SRC="$REPO_DIR/apps/web/dist"
fi

# ── 4. Create release dir ─────────────────────────────────────────
echo "=== [4/8] create release $TIMESTAMP ==="
mkdir -p "$RELEASE_DIR"
cp -r "$DIST_SRC"/. "$RELEASE_DIR/"
# Clean up uploaded temp dir
[[ "$DIST_SRC" == /tmp/* ]] && rm -rf "$DIST_SRC" || true

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
