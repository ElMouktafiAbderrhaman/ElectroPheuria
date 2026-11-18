#!/bin/bash
# ============================================
# ElectroPheuria - DigitalOcean Droplet Setup
# Ubuntu 24.04, Nginx, PHP 8.3, MySQL 8
#
# Deploys from the LOCAL project (no GitHub clone).
# Run AFTER the project has been uploaded to $APP_DIR
# (see deploy/upload.sh which runs on your local machine).
#
# Secrets are NOT stored in this script. The database
# password must be provided via the DB_PASS environment
# variable, and the backend .env (with mail/app secrets)
# is uploaded separately to $APP_DIR/ElectroPheuria-backend/.env
#
# Usage:
#   DB_PASS='<db-password>' bash setup_server.sh
# ============================================
set -euo pipefail

DOMAIN="electropheuria.com"
DB_NAME="electropheuria_db"
DB_USER="electropheuria"
DB_PASS="${DB_PASS:?Set DB_PASS env var (must match DB_PASSWORD in the uploaded backend .env)}"
APP_DIR="/var/www/electropheuria"
WEB_ROOT="/var/www/html"
export DEBIAN_FRONTEND=noninteractive

echo "=============================="
echo "  ElectroPheuria Server Setup"
echo "=============================="

if [ ! -d "${APP_DIR}/ElectroPheuria-backend" ] || [ ! -d "${APP_DIR}/ElectroPheuria-frontend" ]; then
  echo "ERROR: ${APP_DIR} is not populated. Upload the project first (deploy/upload.sh)." >&2
  exit 1
fi

# 1. System update
echo "[1/8] Updating system..."
apt-get update && apt-get upgrade -y

# 2. Install Nginx
echo "[2/8] Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx

# 3. Install PHP 8.3 + extensions
echo "[3/8] Installing PHP 8.3..."
apt-get install -y software-properties-common
add-apt-repository -y ppa:ondrej/php
apt-get update
apt-get install -y php8.3-fpm php8.3-mysql php8.3-mbstring php8.3-xml php8.3-curl \
  php8.3-zip php8.3-bcmath php8.3-intl php8.3-gd php8.3-tokenizer php8.3-cli
systemctl enable php8.3-fpm

# 4. Install MySQL + create fresh database/user
echo "[4/8] Installing MySQL..."
apt-get install -y mysql-server
systemctl enable mysql

mysql <<EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF
echo "  -> Database '${DB_NAME}' and user '${DB_USER}' ready."

# 5. Install Node.js 20 + pnpm
echo "[5/8] Installing Node.js & pnpm..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pnpm

# 6. Install Composer
echo "[6/8] Installing Composer..."
curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# 7. Laravel backend
echo "[7/8] Setting up Laravel backend..."
cd "${APP_DIR}/ElectroPheuria-backend"

if [ ! -f .env ]; then
  echo "ERROR: backend .env not found. Upload it before running setup." >&2
  exit 1
fi

composer install --no-dev --optimize-autoloader --no-interaction

# Generate APP_KEY only if missing (keeps an existing key across re-runs)
if ! grep -q '^APP_KEY=base64:' .env; then
  php artisan key:generate --force
fi

php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

chown -R www-data:www-data "${APP_DIR}/ElectroPheuria-backend"
chmod -R 775 "${APP_DIR}/ElectroPheuria-backend/storage"
chmod -R 775 "${APP_DIR}/ElectroPheuria-backend/bootstrap/cache"

# 8. React frontend
echo "[8/8] Building React frontend..."
cd "${APP_DIR}/ElectroPheuria-frontend"
echo "VITE_API_URL=https://${DOMAIN}/api" > .env.production
pnpm install --frozen-lockfile || pnpm install
pnpm run build

# Publish build to the web root (preserving existing architecture)
mkdir -p "${WEB_ROOT}"
rm -rf "${WEB_ROOT:?}/assets" "${WEB_ROOT}/index.html" "${WEB_ROOT}/favicon.png" "${WEB_ROOT}/vite.svg"
cp -r dist/. "${WEB_ROOT}/"
chown -R www-data:www-data "${WEB_ROOT}"

echo ""
echo "================================"
echo "  Setup complete!"
echo "  Now run: bash ${APP_DIR}/deploy/setup_nginx.sh"
echo "================================"
