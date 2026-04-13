#!/bin/bash
# ============================================
# ElectroPheuria - DigitalOcean Droplet Setup
# Ubuntu 24.04, Nginx, PHP 8.3, MySQL 8
# ============================================
set -e

DOMAIN="electropheuria.com"
DB_NAME="electropheuria_db"
DB_USER="electropheuria"
DB_PASS="ElectroPH26"
GITHUB_TOKEN="${1:?Usage: bash setup_server.sh <GITHUB_TOKEN>}"
REPO="https://${GITHUB_TOKEN}@github.com/ElMouktafiAbderrhaman/ElectroPheuria.git"
APP_DIR="/var/www/electropheuria"

echo "=============================="
echo "  ElectroPheuria Server Setup"
echo "=============================="

# 0. Set hostname
echo "[0/9] Setting hostname..."
hostnamectl set-hostname electropheuria-s-1vcpu-1gb-fra1-01
echo "127.0.1.1 electropheuria-s-1vcpu-1gb-fra1-01" >> /etc/hosts

# 1. System update
echo "[1/9] Updating system..."
apt update && apt upgrade -y

# 2. Install Nginx
echo "[2/9] Installing Nginx..."
apt install -y nginx
systemctl enable nginx

# 3. Install PHP 8.3 + extensions
echo "[3/9] Installing PHP 8.3..."
apt install -y software-properties-common
add-apt-repository -y ppa:ondrej/php
apt update
apt install -y php8.3-fpm php8.3-mysql php8.3-mbstring php8.3-xml php8.3-curl \
  php8.3-zip php8.3-bcmath php8.3-intl php8.3-gd php8.3-tokenizer php8.3-cli

# 4. Install MySQL
echo "[4/9] Installing MySQL..."
apt install -y mysql-server
systemctl enable mysql

# Create database and user
mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF
echo "  -> Database '${DB_NAME}' and user '${DB_USER}' created."

# 5. Install Node.js 20 + pnpm
echo "[5/9] Installing Node.js & pnpm..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pnpm

# 6. Install Composer
echo "[6/9] Installing Composer..."
curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# 7. Clone repo & set up
echo "[7/9] Cloning repository..."
rm -rf ${APP_DIR}
git clone ${REPO} ${APP_DIR}
cd ${APP_DIR}

# --- Backend setup ---
echo "[8/9] Setting up Laravel backend..."
cd ${APP_DIR}/ElectroPheuria-backend

composer install --no-dev --optimize-autoloader

cp .env.example .env

# Write production .env
cat > .env <<ENVFILE
APP_NAME=ElectroPheuria
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://${DOMAIN}

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US
APP_MAINTENANCE_DRIVER=file

BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=${DB_NAME}
DB_USERNAME=${DB_USER}
DB_PASSWORD=${DB_PASS}

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database
CACHE_STORE=database

MAIL_MAILER=smtp
MAIL_SCHEME=null
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_ENCRYPTION=tls
MAIL_USERNAME=aelmouktafi65@gmail.com
MAIL_PASSWORD=qrpaquvfpxpfmioo
MAIL_FROM_ADDRESS="aelmouktafi65@gmail.com"
MAIL_FROM_NAME="ElectroPheuria"

FRONTEND_URL=https://${DOMAIN}
ENVFILE

php artisan key:generate --force
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Set permissions
chown -R www-data:www-data ${APP_DIR}/ElectroPheuria-backend
chmod -R 775 ${APP_DIR}/ElectroPheuria-backend/storage
chmod -R 775 ${APP_DIR}/ElectroPheuria-backend/bootstrap/cache

# --- Frontend setup ---
echo "[9/9] Building React frontend..."
cd ${APP_DIR}/ElectroPheuria-frontend

# Create production env
echo "VITE_API_URL=https://${DOMAIN}/api" > .env.production

pnpm install
pnpm run build

echo ""
echo "================================"
echo "  Setup complete!"
echo "  Now run: bash /root/setup_nginx.sh"
echo "================================"
