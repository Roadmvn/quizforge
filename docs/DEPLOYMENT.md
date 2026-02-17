# Deploiement QuizForge

Guide complet pour deployer QuizForge sur un VPS en production.

## Pre-requis

- Un VPS Ubuntu 22.04+ (1 vCPU / 1 Go RAM minimum)
- Un nom de domaine pointe vers l'IP du VPS (optionnel, fonctionne aussi en IP seule)
- Un compte GitHub avec acces au repo et un Personal Access Token (scope `read:packages`)

## Deploiement rapide (script automatique)

Le script `deploy/setup.sh` installe Docker, configure nginx, genere le `.env` et lance l'app en une commande :

```bash
curl -fsSL https://raw.githubusercontent.com/Roadmvn/quizforge/main/deploy/setup.sh | sudo bash
```

Le script demande interactivement :
- **Domaine** : entrer le domaine pour activer SSL (Let's Encrypt), ou laisser vide pour un deploiement en IP seule
- **GitHub username + token** : pour pull les images depuis GHCR

A la fin, le `.env` est genere automatiquement avec un secret JWT aleatoire.

## Deploiement manuel (pas a pas)

### 1. Installer Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable docker
```

### 2. Creer le repertoire de l'app

```bash
sudo mkdir -p /opt/quizforge
cd /opt/quizforge
```

### 3. Telecharger les fichiers de configuration

```bash
REPO_RAW="https://raw.githubusercontent.com/Roadmvn/quizforge/main"

curl -fsSL "$REPO_RAW/docker-compose.prod.yml" -o docker-compose.prod.yml
curl -fsSL "$REPO_RAW/.env.example" -o .env.example
curl -fsSL "$REPO_RAW/nginx.prod.conf" -o nginx.prod.conf
```

### 4. Configurer le `.env`

```bash
cp .env.example .env
```

Editer `.env` :

```env
QUIZFORGE_SECRET_KEY=<generer avec: openssl rand -hex 32>
DOMAIN=<votre-domaine-ou-ip>
ALLOWED_ORIGINS=https://<votre-domaine>
REGISTRATION_ENABLED=false
```

> **Securite** : ne jamais commiter le fichier `.env` dans le repo. Il contient le secret JWT.

### 5. Configurer nginx

Remplacer le placeholder `__DOMAIN__` dans `nginx.prod.conf` :

```bash
sed -i "s/__DOMAIN__/votre-domaine.com/g" nginx.prod.conf
```

**Mode IP seule** (sans SSL) : utiliser `nginx.conf` (config dev) a la place de `nginx.prod.conf` :

```bash
curl -fsSL "$REPO_RAW/nginx.conf" -o nginx.prod.conf
```

Et retirer les lignes SSL du `docker-compose.prod.yml` :
- Port `443:443`
- Volumes `letsencrypt` et `certbot-webroot`

### 6. SSL avec Let's Encrypt (si domaine)

```bash
sudo apt-get install -y certbot
sudo certbot certonly --standalone -d votre-domaine.com --email votre@email.com --agree-tos --non-interactive
```

Ajouter le renouvellement automatique :

```bash
echo "0 3 * * * certbot renew --quiet --deploy-hook 'cd /opt/quizforge && docker compose -f docker-compose.prod.yml restart nginx'" | sudo crontab -
```

### 7. Pull et lancement

```bash
# Login GHCR (necessaire pour pull les images privees)
echo "<GITHUB_TOKEN>" | docker login ghcr.io -u <GITHUB_USER> --password-stdin

# Pull les images
docker compose -f docker-compose.prod.yml pull

# Lancer
docker compose -f docker-compose.prod.yml up -d
```

L'app est accessible sur `https://votre-domaine.com` (ou `http://<IP>` sans SSL).

## CI/CD (GitHub Actions)

Chaque push sur `main` declenche automatiquement :

1. **Test** : install des deps Python + build du frontend
2. **Build** : construction des images Docker et push sur GHCR
3. **Deploy** : connexion SSH au VPS, pull des images, recreation des conteneurs

### Secrets GitHub requis

Configurer dans **Settings > Secrets and variables > Actions** :

| Secret | Description |
|--------|-------------|
| `GHCR_TOKEN` | Personal Access Token GitHub (scopes: `write:packages`, `read:packages`) |
| `VPS_HOST` | IP ou domaine du VPS |
| `VPS_USER` | Utilisateur SSH (ex: `root`) |
| `VPS_SSH_KEY` | Cle privee SSH pour se connecter au VPS |

### Generer une cle SSH dediee au deploy

```bash
ssh-keygen -t ed25519 -f ~/.ssh/quizforge_deploy -N ""
```

Ajouter la cle publique sur le VPS :

```bash
ssh-copy-id -i ~/.ssh/quizforge_deploy.pub <user>@<VPS_IP>
```

Copier le contenu de `~/.ssh/quizforge_deploy` (cle privee) dans le secret `VPS_SSH_KEY`.

## Mise a jour manuelle

Si le CI/CD n'est pas configure, deployer manuellement :

```bash
ssh <user>@<VPS_IP> "cd /opt/quizforge && docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d --force-recreate"
```

## Persistence des donnees

La base SQLite et les uploads sont stockes dans un volume Docker nomme `quizforge-data`.

- `--force-recreate` recree les conteneurs mais **ne touche pas aux volumes**
- `docker compose down` arrete les conteneurs mais **preserve les volumes**
- `docker compose down -v` supprime les volumes (**perte de donnees**)

### Backup de la base

```bash
# Copier la DB depuis le conteneur
docker cp quizforge-backend-1:/app/data/quizforge.db ./backup_$(date +%Y%m%d).db

# Ou depuis le volume directement
docker run --rm -v quizforge-data:/data -v $(pwd):/backup alpine cp /data/quizforge.db /backup/backup_$(date +%Y%m%d).db
```

### Restaurer un backup

```bash
docker compose -f docker-compose.prod.yml down
docker run --rm -v quizforge-data:/data -v $(pwd):/backup alpine cp /backup/backup.db /data/quizforge.db
docker compose -f docker-compose.prod.yml up -d
```

## Monitoring

```bash
# Etat des conteneurs
docker compose -f docker-compose.prod.yml ps

# Logs en temps reel
docker compose -f docker-compose.prod.yml logs -f

# Logs backend uniquement
docker compose -f docker-compose.prod.yml logs -f backend

# Health check
curl -s http://localhost:8000/api/health
```

## Rollback

Les images sont taguees par commit SHA en plus du tag `latest`. Pour revenir a une version anterieure :

```bash
# Lister les tags disponibles
docker image ls ghcr.io/roadmvn/quizforge-backend

# Deployer un tag specifique
TAG=<commit-sha> docker compose -f docker-compose.prod.yml up -d --force-recreate
```

## Architecture production

```
Internet
  |
  v
Nginx (port 80/443)
  ├── /          -> Frontend (fichiers statiques)
  ├── /api/      -> Backend FastAPI (proxy port 8000)
  └── /ws/       -> WebSocket (proxy port 8000)
          |
          v
      Backend FastAPI
          |
          v
      SQLite (volume Docker)
```

## Variables d'environnement

| Variable | Description | Defaut |
|----------|-------------|--------|
| `QUIZFORGE_SECRET_KEY` | Secret JWT (**obligatoire**) | -- |
| `DOMAIN` | Domaine ou IP du serveur | -- |
| `ALLOWED_ORIGINS` | Origines CORS autorisees (virgule) | `http://localhost:8080` |
| `REGISTRATION_ENABLED` | Activer l'inscription publique | `false` |
| `HOST_LAN_IP` | IP LAN forcee pour QR code | auto-detect |
| `UPLOAD_DIR` | Repertoire des images uploadees | `/app/data/uploads` |
| `TAG` | Tag des images Docker a utiliser | `latest` |
