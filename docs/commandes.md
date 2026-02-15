# Commandes QuizForge

## Lancement local (localhost)

```bash
QUIZFORGE_SECRET_KEY=$(openssl rand -hex 32) docker compose up -d
```

App accessible sur `http://localhost:8080`

## Lancement local avec inscription activee

```bash
QUIZFORGE_SECRET_KEY=$(openssl rand -hex 32) REGISTRATION_ENABLED=true docker compose up -d
```

## Lancement sur IP LAN (pour tester avec un telephone)

Trouver son IP LAN :

```bash
# macOS
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'
```

Lancer avec l'IP LAN dans les origines CORS autorisees :

```bash
export LAN_IP=$(ipconfig getifaddr en0)  # macOS
# export LAN_IP=$(hostname -I | awk '{print $1}')  # Linux

QUIZFORGE_SECRET_KEY=$(openssl rand -hex 32) \
REGISTRATION_ENABLED=true \
ALLOWED_ORIGINS="http://localhost:8080,http://$LAN_IP:8080" \
docker compose up -d
```

Ouvrir l'app depuis **`http://<IP_LAN>:8080`** (pas localhost) pour que le QR code contienne la bonne IP.

Le telephone doit etre sur le **meme reseau WiFi**.

## Rebuild apres modification du code

```bash
QUIZFORGE_SECRET_KEY=<ta_cle> REGISTRATION_ENABLED=true docker compose up -d --build
```

## Arreter l'app

```bash
docker compose down
```

## Arreter et supprimer les donnees (reset DB)

```bash
docker compose down -v
```

## Voir les logs

```bash
# Tous les services
docker compose logs -f

# Backend seulement
docker compose logs -f backend

# Nginx seulement
docker compose logs -f nginx
```

## Migration manuelle SQLite (ajout de colonne sans perdre les donnees)

```bash
docker exec -it quizforge-backend-1 python -c "
import sqlite3
conn = sqlite3.connect('/app/data/quizforge.db')
c = conn.cursor()
c.execute('ALTER TABLE <table> ADD COLUMN <colonne> <TYPE> DEFAULT <valeur>')
conn.commit()
conn.close()
print('OK')
"
```

## Changer le mot de passe d'un utilisateur

```bash
docker exec -it quizforge-backend-1 python -c "
from services.auth import hash_password
import sqlite3
new_hash = hash_password('NouveauMotDePasse')
conn = sqlite3.connect('/app/data/quizforge.db')
conn.execute('UPDATE users SET hashed_password=? WHERE email=?', (new_hash, 'admin@quizforge.io'))
conn.commit()
conn.close()
print('OK')
"
```

## Passer un utilisateur en admin

```bash
docker exec -it quizforge-backend-1 python -c "
import sqlite3
conn = sqlite3.connect('/app/data/quizforge.db')
conn.execute('UPDATE users SET role=\"admin\" WHERE email=\"admin@quizforge.io\"')
conn.commit()
conn.close()
print('OK')
"
```

## Variables d'environnement

| Variable | Description | Defaut |
|----------|-------------|--------|
| `QUIZFORGE_SECRET_KEY` | Secret JWT (obligatoire) | -- |
| `ALLOWED_ORIGINS` | Origines CORS (virgule) | `http://localhost:8080` |
| `REGISTRATION_ENABLED` | Activer l'inscription | `false` |
| `HOST_LAN_IP` | IP LAN forcee (QR code) | auto-detect |

## Deploiement VPS

```bash
# Telecharger et lancer le script d'installation
curl -fsSL https://raw.githubusercontent.com/Roadmvn/quizforge/main/deploy/setup.sh -o /tmp/setup.sh
sudo bash /tmp/setup.sh
```

## Migration sur le VPS (sans perdre les donnees)

```bash
ssh root@<VPS_IP> 'docker exec quizforge-backend-1 python -c "
import sqlite3
conn = sqlite3.connect(\"/app/data/quizforge.db\")
c = conn.cursor()
c.execute(\"ALTER TABLE <table> ADD COLUMN <col> <TYPE>\")
conn.commit()
conn.close()
print(\"OK\")
"'
```
