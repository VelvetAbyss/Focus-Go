#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/root/focus-go"
DIST_SRC="$REPO_DIR/apps/web/dist"
DIST_DEST="/var/www/focus-go-app"
API_DIR="$REPO_DIR/apps/web/focus-go-api"
PM2_APP_NAME="focus-go-api"

echo "=== [1/7] Fetching latest code ==="
cd "$REPO_DIR"
git fetch origin main

echo "=== [2/7] Resetting to origin/main ==="
git reset --hard origin/main

echo "=== [3/7] Installing dependencies ==="
npm ci

echo "=== [4/7] Building web app ==="
npm run build:web

echo "=== [5/7] Deploying static files ==="
rm -rf "$DIST_DEST"/*
cp -r "$DIST_SRC"/. "$DIST_DEST/"

echo "=== [6/7] Validating and reloading nginx ==="
nginx -t
systemctl reload nginx

echo "=== [7/7] Restarting API (PM2) ==="
cd "$API_DIR"
pm2 reload "$PM2_APP_NAME" --update-env || pm2 start index.js --name "$PM2_APP_NAME"

echo "=== Deploy complete ==="
