#!/bin/bash
set -euo pipefail

APP_DIR="/opt/quizforge"
COMPOSE_URL="https://raw.githubusercontent.com/Roadmvn/quizforge/main/docker-compose.prod.yml"
NGINX_URL="https://raw.githubusercontent.com/Roadmvn/quizforge/main/nginx.prod.conf"
ENV_URL="https://raw.githubusercontent.com/Roadmvn/quizforge/main/.env.example"

echo "=== QuizForge - Setup VPS ==="
echo ""

# Vérifier qu'on est root
if [ "$EUID" -ne 0 ]; then
  echo "Erreur: lancer avec sudo"
  exit 1
fi

# 1. Demander les infos
read -rp "Nom de domaine (ex: quiz.monsite.com): " DOMAIN
read -rp "Email pour Let's Encrypt: " EMAIL
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

# 3. Installer Certbot si absent
if ! command -v certbot &> /dev/null; then
  echo ">>> Installation de Certbot..."
  apt-get update -qq
  apt-get install -y -qq certbot
else
  echo ">>> Certbot déjà installé"
fi

# 4. Créer le répertoire
echo ">>> Création de $APP_DIR..."
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# 5. Télécharger les fichiers de config
echo ">>> Téléchargement des configs..."
curl -fsSL "$COMPOSE_URL" -o docker-compose.prod.yml
curl -fsSL "$NGINX_URL" -o nginx.prod.conf
curl -fsSL "$ENV_URL" -o .env.example

# 6. Remplacer le placeholder domaine dans nginx.prod.conf
sed -i "s/__DOMAIN__/$DOMAIN/g" nginx.prod.conf

# 7. Générer le .env
cat > .env <<EOF
QUIZFORGE_SECRET_KEY=$SECRET_KEY
DOMAIN=$DOMAIN
ALLOWED_ORIGINS=https://$DOMAIN
REGISTRATION_ENABLED=false
EOF

echo ">>> .env généré (secret JWT auto-généré)"

# 8. Obtenir le certificat SSL
echo ">>> Obtention du certificat SSL..."
certbot certonly --standalone -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive

# 9. Login GHCR et pull les images
echo ">>> Login GHCR..."
echo "$GH_TOKEN" | docker login ghcr.io -u "$GH_USER" --password-stdin

echo ">>> Pull des images..."
docker compose -f docker-compose.prod.yml pull

# 10. Lancer l'app
echo ">>> Lancement de QuizForge..."
docker compose -f docker-compose.prod.yml up -d

# 11. Cron pour renouvellement SSL
CRON_CMD="0 3 * * * certbot renew --quiet --deploy-hook 'cd $APP_DIR && docker compose -f docker-compose.prod.yml restart nginx'"
(crontab -l 2>/dev/null | grep -v certbot; echo "$CRON_CMD") | crontab -

echo ""
echo "=== QuizForge déployé ==="
echo "URL: https://$DOMAIN"
echo "Secret JWT: $SECRET_KEY"
echo "Renouvellement SSL: cron quotidien à 3h"
echo ""
echo "Pour activer l'inscription: modifier REGISTRATION_ENABLED=true dans $APP_DIR/.env"
echo "puis: cd $APP_DIR && docker compose -f docker-compose.prod.yml restart backend"
