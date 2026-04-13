#!/bin/bash
# ============================================
# Nginx + SSL setup for ElectroPheuria
# Run AFTER setup_server.sh
# ============================================
set -e

DOMAIN="electropheuria.com"

echo "[1/3] Configuring Nginx..."
cp /var/www/electropheuria/deploy/nginx.conf /etc/nginx/sites-available/electropheuria
ln -sf /etc/nginx/sites-available/electropheuria /etc/nginx/sites-enabled/electropheuria
rm -f /etc/nginx/sites-enabled/default

# Test config
nginx -t

systemctl reload nginx
echo "  -> Nginx configured and running."

echo "[2/3] Installing SSL (Let's Encrypt)..."
apt install -y certbot python3-certbot-nginx
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email aelmouktafi65@gmail.com

echo "[3/3] Setting up auto-renewal..."
systemctl enable certbot.timer

echo ""
echo "======================================="
echo "  DONE! Your site is live at:"
echo "  https://${DOMAIN}"
echo "======================================="
