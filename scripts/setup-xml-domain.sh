#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Copying Nginx site config ==="
sudo cp /home/dsquan/xml.thuocso.net.nginx /etc/nginx/sites-available/xml.thuocso.net
sudo ln -sfn /etc/nginx/sites-available/xml.thuocso.net /etc/nginx/sites-enabled/xml.thuocso.net

echo "=== 2. Testing Nginx config ==="
sudo nginx -t

echo "=== 3. Reloading Nginx ==="
sudo systemctl reload nginx

echo "=== 4. Requesting SSL certificate with Certbot ==="
sudo certbot --nginx \
  -d xml.thuocso.net \
  --non-interactive \
  --agree-tos \
  --redirect \
  --register-unsafely-without-email

echo "=== 5. Final Nginx reload ==="
sudo nginx -t
sudo systemctl reload nginx

echo "=== ALL DONE: https://xml.thuocso.net is LIVE! ==="
