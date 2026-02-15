#!/bin/bash
set -euo pipefail

APP_DIR="/opt/quizforge"
REPO_RAW="https://raw.githubusercontent.com/Roadmvn/quizforge/main"

echo "=== QuizForge - Setup VPS ==="
echo ""

if [ "$EUID" -ne 0 ]; then
  echo "Erreur: lancer avec sudo"
  exit 1
fi

# 1. Domaine ou IP ?
read -rp "Nom de domaine (laisser vide pour utiliser l'IP): " DOMAIN
if [ -z "$DOMAIN" ]; then
  DOMAIN=$(hostname -I | awk '{print $1}')
  USE_SSL=false
  echo ">>> Mode IP: $DOMAIN (pas de SSL)"
else
  USE_SSL=true
  read -rp "Email pour Let's Encrypt: " EMAIL
fi

read -rp "GitHub username (pour pull les images GHCR): " GH_USER
read -rsp "GitHub Personal Access Token (scope: read:packages): " GH_TOKEN
echo ""

SECRET_KEY=$(openssl rand -hex 32)

# 2. Installer Docker si absent
if ! command -v docker &> /dev/null; then
  echo ">>> Installation de Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo ">>> Docker déjà installé"
fi

# 3. Créer le répertoire
echo ">>> Création de $APP_DIR..."
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# 4. Télécharger les fichiers
echo ">>> Téléchargement des configs..."
curl -fsSL "$REPO_RAW/docker-compose.prod.yml" -o docker-compose.prod.yml
curl -fsSL "$REPO_RAW/.env.example" -o .env.example

if [ "$USE_SSL" = true ]; then
  curl -fsSL "$REPO_RAW/nginx.prod.conf" -o nginx.prod.conf
  sed -i "s/__DOMAIN__/$DOMAIN/g" nginx.prod.conf
else
  curl -fsSL "$REPO_RAW/nginx.conf" -o nginx.prod.conf
fi

# 5. Générer le .env
if [ "$USE_SSL" = true ]; then
  ORIGIN="https://$DOMAIN"
else
  ORIGIN="http://$DOMAIN"
fi

cat > .env <<EOF
QUIZFORGE_SECRET_KEY=$SECRET_KEY
DOMAIN=$DOMAIN
ALLOWED_ORIGINS=$ORIGIN
REGISTRATION_ENABLED=false
EOF

echo ">>> .env généré (secret JWT auto-généré)"

# 6. SSL si domaine
if [ "$USE_SSL" = true ]; then
  if ! command -v certbot &> /dev/null; then
    apt-get update -qq
    apt-get install -y -qq certbot
  fi
  echo ">>> Obtention du certificat SSL..."
  certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive

  CRON_CMD="0 3 * * * certbot renew --webroot -w /var/www/certbot --quiet --deploy-hook 'cd $APP_DIR && docker compose -f docker-compose.prod.yml restart nginx'"
  (crontab -l 2>/dev/null | grep -v certbot; echo "$CRON_CMD") | crontab -
else
  # Sans SSL: nginx écoute sur port 80 seulement, retirer port 443 du compose
  sed -i '/"443:443"/d' docker-compose.prod.yml
  sed -i '/letsencrypt/d' docker-compose.prod.yml
  sed -i '/certbot-webroot/d' docker-compose.prod.yml
fi

# 7. Login GHCR et pull les images
echo ">>> Login GHCR..."
echo "$GH_TOKEN" | docker login ghcr.io -u "$GH_USER" --password-stdin

echo ">>> Pull des images..."
docker compose -f docker-compose.prod.yml pull

# 8. Lancer l'app
echo ">>> Lancement de QuizForge..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "=== QuizForge déployé ==="
echo "URL: $ORIGIN"
echo "Secret JWT: [saved in .env]"
if [ "$USE_SSL" = true ]; then
  echo "Renouvellement SSL: cron quotidien à 3h"
fi
echo ""
echo "Pour activer l'inscription: modifier REGISTRATION_ENABLED=true dans $APP_DIR/.env"
echo "puis: cd $APP_DIR && docker compose -f docker-compose.prod.yml restart backend"
