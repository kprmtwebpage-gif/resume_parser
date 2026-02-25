#!/bin/bash
# ================================================================
# setup_ssl.sh  –  Install Nginx + Let's Encrypt SSL on the server
#
# Run on the server:  bash /root/resume-parser/nginx/setup_ssl.sh
# ================================================================
set -euo pipefail

DOMAIN="kprmtglobalsolutions.duckdns.org"
EMAIL="admin@kprmtglobalsolutions.com"    # change if needed
NGINX_CONF="/root/resume-parser/nginx/resume-parser.conf"

echo "──────────────────────────────────────────────"
echo "  SSL + Nginx setup for $DOMAIN"
echo "──────────────────────────────────────────────"

# ── 1. Install Nginx + Certbot ──────────────────────────────
echo "📦 Installing Nginx and Certbot..."
apt-get update -qq
apt-get install -y nginx certbot python3-certbot-nginx

# ── 2. Stop Nginx temporarily (so certbot can bind port 80) ──
systemctl stop nginx 2>/dev/null || true

# ── 3. Get SSL certificate (standalone mode) ────────────────
echo "🔐 Obtaining SSL certificate for $DOMAIN..."
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN"
    echo "✅ Certificate obtained"
else
    echo "✅ Certificate already exists, skipping"
fi

# ── 4. Generate DH parameters (if not present) ──────────────
if [ ! -f /etc/letsencrypt/ssl-dhparams.pem ]; then
    echo "🔑 Generating DH parameters (this takes a minute)..."
    openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048
fi

# ── 5. Create certbot recommended SSL options (if not present)
if [ ! -f /etc/letsencrypt/options-ssl-nginx.conf ]; then
    echo "📝 Creating SSL options file..."
    cat > /etc/letsencrypt/options-ssl-nginx.conf <<'SSLCONF'
ssl_session_cache shared:le_nginx_SSL:10m;
ssl_session_timeout 1440m;
ssl_session_tickets off;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_ciphers "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384";
SSLCONF
fi

# ── 6. Deploy Nginx config ──────────────────────────────────
echo "📋 Deploying Nginx configuration..."
cp "$NGINX_CONF" /etc/nginx/sites-available/resume-parser
ln -sf /etc/nginx/sites-available/resume-parser /etc/nginx/sites-enabled/resume-parser
rm -f /etc/nginx/sites-enabled/default

# ── 7. Test & start Nginx ───────────────────────────────────
echo "🧪 Testing Nginx configuration..."
nginx -t

echo "🚀 Starting Nginx..."
systemctl enable nginx
systemctl start nginx

# ── 8. Set up auto-renewal cron ─────────────────────────────
echo "⏰ Setting up certificate auto-renewal..."
# Certbot installs a systemd timer or cron automatically, but let's ensure
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | sort -u | crontab -

echo ""
echo "══════════════════════════════════════════════"
echo "  ✅ SSL setup complete!"
echo ""
echo "  HTTPS:  https://$DOMAIN/"
echo "  Dev:    https://$DOMAIN/dev/"
echo "  UAT:    https://$DOMAIN/uat/"
echo ""
echo "  Certificate renews automatically via cron."
echo "══════════════════════════════════════════════"
