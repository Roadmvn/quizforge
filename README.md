# QuizForge

Plateforme de quiz interactif en temps réel. Créez des quiz, lancez des sessions live et suivez les scores de vos participants instantanément.

## Fonctionnalites

- **Gestion de quiz** : creation, edition, reordonnement des questions, images par question, limites de temps
- **Sessions live** : lancement de sessions en temps reel avec QR code pour rejoindre
- **WebSocket** : synchronisation instantanee entre l'admin et les participants (late-joiner sync inclus)
- **Mode plein ecran** : affichage immersif des questions pour projection en salle
- **Classement live** : scores calcules en temps reel avec anti-triche (validation serveur, temps serveur)
- **Analytiques** : statistiques detaillees par question, taux de reussite, distribution des reponses
- **Export CSV** : telechargement des resultats par session (protection injection CSV)
- **Upload images** : images sur les questions (validation Pillow, 5 Mo max)
- **Panel admin** : gestion des utilisateurs, roles, statistiques globales
- **Sidebar retractable** : navigation compacte avec persistance localStorage
- **Authentification JWT** : inscription/connexion securisee avec PyJWT + bcrypt (token 2h)

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Backend | FastAPI, SQLAlchemy, SQLite (WAL mode), PyJWT, bcrypt |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Infra | Docker Compose, Nginx reverse proxy, rate limiting |
| CI/CD | GitHub Actions (test + build + deploy) → GHCR → VPS |

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

| Variable | Description | Defaut |
|----------|-------------|--------|
| `QUIZFORGE_SECRET_KEY` | Secret JWT (obligatoire) | — |
| `ALLOWED_ORIGINS` | Origines CORS autorisees (virgule) | `http://localhost:8080` |
| `REGISTRATION_ENABLED` | Activer l'inscription | `false` |
| `HOST_LAN_IP` | IP LAN forcee (QR code) | auto-detect |
| `UPLOAD_DIR` | Repertoire des images uploadees | `/app/data/uploads` |

## Déploiement production (VPS)

```bash
# Sur un VPS Ubuntu avec un domaine pointé vers l'IP
curl -fsSL https://raw.githubusercontent.com/Roadmvn/quizforge/main/deploy/setup.sh | sudo bash
```

Le script installe Docker, Certbot, obtient un certificat SSL et lance l'app.

Chaque push sur `main` declenche automatiquement : tests → build des images Docker → deploy sur le VPS via GitHub Actions.

Pour plus de commandes (LAN, migrations, reset DB, etc.), voir [`docs/commandes.md`](docs/commandes.md).

## Structure du projet

```
quizforge/
├── backend/              # API FastAPI
│   ├── main.py           # Point d'entree + CORS
│   ├── models.py         # Modeles SQLAlchemy (User, Quiz, Session, Participant...)
│   ├── schemas.py        # Schemas Pydantic (validation I/O)
│   ├── database.py       # Config DB + WAL mode
│   ├── routes/           # Endpoints REST
│   │   ├── auth.py       # Login, register, /me
│   │   ├── quiz.py       # CRUD quiz + questions + reponses
│   │   ├── session.py    # Sessions live, WebSocket, analytics, CSV export
│   │   ├── admin.py      # Gestion utilisateurs (admin only)
│   │   └── upload.py     # Upload images (Pillow validation)
│   ├── services/         # Logique metier
│   │   ├── auth.py       # JWT + bcrypt
│   │   └── qrcode.py     # Generation QR code
│   └── websocket/        # Hub WebSocket temps reel
│       └── hub.py        # Rooms, broadcast, connexion/deconnexion
├── frontend/             # App React + Vite
│   └── src/
│       ├── pages/        # Dashboard, QuizEditor, SessionControl, Play, Join, Analytics, Admin
│       ├── components/   # Layout (sidebar retractable)
│       ├── hooks/        # useAuth, useWebSocket (reconnect auto)
│       └── lib/          # API client, types TypeScript
├── deploy/               # Script d'init VPS (setup.sh)
├── docs/                 # Documentation
│   └── commandes.md      # Commandes utiles (local, VPS, migration)
├── .github/workflows/    # CI/CD (test → build → deploy)
├── docker-compose.yml    # Dev local
├── docker-compose.prod.yml # Production (GHCR images)
├── nginx.conf            # Nginx dev (rate limiting, CSP)
└── nginx.prod.conf       # Nginx prod (SSL, HSTS, gzip)
```

## Licence

MIT
