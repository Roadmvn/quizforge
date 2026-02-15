# QuizForge

Plateforme de quiz interactif en temps réel. Créez des quiz, lancez des sessions live et suivez les scores de vos participants instantanément.

## Fonctionnalités

- **Gestion de quiz** : création, édition, suppression avec questions à choix multiples et limites de temps
- **Sessions live** : lancement de sessions en temps réel avec QR code pour rejoindre
- **WebSocket** : synchronisation instantanée entre l'admin et les participants
- **Classement live** : scores calculés en temps réel avec anti-triche (validation serveur)
- **Export CSV** : téléchargement des résultats par session
- **Authentification JWT** : inscription/connexion sécurisée avec bcrypt

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Backend | FastAPI, SQLAlchemy, SQLite (WAL mode) |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Infra | Docker Compose, Nginx reverse proxy |
| CI/CD | GitHub Actions → GHCR → VPS |

## Lancement local

```bash
# Cloner le repo
git clone git@github.com:Roadmvn/quizforge.git
cd quizforge

# Lancer avec Docker Compose
QUIZFORGE_SECRET_KEY=$(openssl rand -hex 32) docker compose up -d

# Accéder à l'app
open http://localhost:8080
```

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `QUIZFORGE_SECRET_KEY` | Secret JWT (obligatoire) | — |
| `ALLOWED_ORIGINS` | Origines CORS autorisées | `http://localhost:8080` |
| `REGISTRATION_ENABLED` | Activer l'inscription | `false` |

## Déploiement production (VPS)

```bash
# Sur un VPS Ubuntu avec un domaine pointé vers l'IP
curl -fsSL https://raw.githubusercontent.com/Roadmvn/quizforge/main/deploy/setup.sh | sudo bash
```

Le script installe Docker, Certbot, obtient un certificat SSL et lance l'app.

Chaque push sur `main` déclenche un déploiement automatique via GitHub Actions.

## Structure du projet

```
quizforge/
├── backend/              # API FastAPI
│   ├── main.py           # Point d'entrée + CORS
│   ├── models.py         # Modèles SQLAlchemy
│   ├── database.py       # Config DB + WAL mode
│   ├── routes/           # Endpoints (auth, quiz, session)
│   ├── services/         # Logique métier (auth)
│   └── websocket/        # Hub WebSocket temps réel
├── frontend/             # App React + Vite
│   └── src/
│       ├── pages/        # Pages (Dashboard, Quiz, Session, Play)
│       ├── hooks/        # useWebSocket
│       └── lib/          # API client, types
├── deploy/               # Script d'init VPS
├── docker-compose.yml    # Dev local
├── docker-compose.prod.yml # Production
├── nginx.conf            # Nginx dev
└── nginx.prod.conf       # Nginx prod (SSL)
```

## Licence

MIT
