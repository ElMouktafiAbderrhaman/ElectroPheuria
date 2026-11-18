#!/bin/bash
# ============================================
# Upload the LOCAL ElectroPheuria project to the server.
# Runs on your local machine (Git Bash / WSL / macOS / Linux).
# No GitHub involved — the local project is the source of truth.
#
# Usage:
#   bash deploy/upload.sh
# ============================================
set -euo pipefail

SERVER="root@167.172.103.90"
APP_DIR="/var/www/electropheuria"

# Repo root = parent of this script's dir
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Uploading backend (excluding vendor / .env / caches)..."
ssh "$SERVER" "mkdir -p $APP_DIR/ElectroPheuria-backend"
tar czf - \
  --exclude='./vendor' \
  --exclude='./node_modules' \
  --exclude='./.git' \
  --exclude='./.env' \
  --exclude='./.env.production' \
  --exclude='./storage/logs/*' \
  --exclude='./storage/framework/cache/*' \
  --exclude='./storage/framework/sessions/*' \
  --exclude='./storage/framework/views/*' \
  --exclude='./bootstrap/cache/*' \
  -C ElectroPheuria-backend . \
  | ssh "$SERVER" "tar xzf - -C $APP_DIR/ElectroPheuria-backend"

echo "Uploading frontend (excluding node_modules / dist)..."
ssh "$SERVER" "mkdir -p $APP_DIR/ElectroPheuria-frontend"
tar czf - \
  --exclude='./node_modules' \
  --exclude='./dist' \
  --exclude='./.git' \
  -C ElectroPheuria-frontend . \
  | ssh "$SERVER" "tar xzf - -C $APP_DIR/ElectroPheuria-frontend"

echo "Uploading deploy scripts..."
ssh "$SERVER" "mkdir -p $APP_DIR/deploy"
tar czf - -C deploy . | ssh "$SERVER" "tar xzf - -C $APP_DIR/deploy"

echo "Uploading production backend .env -> backend/.env ..."
scp ElectroPheuria-backend/.env.production "$SERVER:$APP_DIR/ElectroPheuria-backend/.env"

echo "Done. Project uploaded to $APP_DIR"
