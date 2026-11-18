#!/bin/bash
# Usage: bash deploy-frontend.sh
set -e

SERVER="root@167.172.103.90"
REMOTE_DIR="/var/www/html"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_DIST="$SCRIPT_DIR/ElectroPheuria-frontend/dist"

echo "Building..."
cd "$(dirname "$0")/ElectroPheuria-frontend"
npm run build

echo "Deploying to server..."
ssh "$SERVER" "rm -rf $REMOTE_DIR/assets $REMOTE_DIR/index.html $REMOTE_DIR/favicon.png $REMOTE_DIR/vite.svg"
scp -r "$LOCAL_DIST/assets" "$SERVER:$REMOTE_DIR/"
scp "$LOCAL_DIST/index.html" "$LOCAL_DIST/favicon.png" "$LOCAL_DIST/vite.svg" "$SERVER:$REMOTE_DIR/"

echo "Fixing permissions..."
ssh "$SERVER" "chmod 755 $REMOTE_DIR/assets && chmod 644 $REMOTE_DIR/assets/*"

echo "Done. Site is live."
