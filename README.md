# 🚗 Nu-Demm Admin Panel — React v3.0

Interface d'administration complète en React pour l'application Nu-Demm.

---

## 📋 MODULES DISPONIBLES

| Module | Route | Description |
|---|---|---|
| 🏠 Dashboard | `/` | Stats, graphiques, activité récente |
| 🏍 Chauffeurs | `/chauffeurs` | CRUD complet + filtres par type |
| 👤 Clients | `/clients` | CRUD complet |
| 🛒 Commandes | `/commandes` | Liste, filtres, changement de statut |
| 🚚 Livraisons | `/livraisons` | Liste + détails |
| 🗺 Trajets | `/trajets` | CRUD + réservations par trajet |
| 🚗 Véhicules | `/vehicules` | Liste de tous les véhicules |
| 📅 Réservations | `/reservations` | Toutes les réservations |
| 🔔 Notifications | `/notifications` | Par utilisateur/type |
| 🛡 Admins | `/admins` | Gestion des administrateurs |
| 📋 Audit | `/audit` | Journal d'activité (localStorage) |
| ⚙ Paramètres | `/settings` | URL backend, sécurité |

---

## 🛠 INSTALLATION ÉTAPE PAR ÉTAPE (VS Code)

### ÉTAPE 1 — Prérequis : Installer Node.js

1. Allez sur **https://nodejs.org**
2. Téléchargez **Node.js LTS** (version 18 ou 20)
3. Installez-le (cochez "Add to PATH" pendant l'installation)
4. Vérifiez dans un terminal :
   ```bash
   node --version   # doit afficher v18.x.x ou v20.x.x
   npm --version    # doit afficher 9.x.x ou 10.x.x
   ```

---

### ÉTAPE 2 — Ouvrir le projet dans VS Code

1. Extrayez le dossier `nudemm-admin-react` quelque part sur votre PC
2. Ouvrez **VS Code**
3. Cliquez `Fichier → Ouvrir le dossier` → sélectionnez `nudemm-admin-react`
4. Ouvrez le terminal intégré : `Terminal → Nouveau Terminal` (ou `Ctrl + ù`)

---

### ÉTAPE 3 — Installer les dépendances

Dans le terminal VS Code, depuis le dossier `nudemm-admin-react` :

```bash
npm install
```

> ⏳ Cela prend environ 1-3 minutes. Vous verrez `added XXX packages`.

---

### ÉTAPE 4 — Lancer l'application en développement

```bash
npm start
```

> Le navigateur s'ouvrira automatiquement sur **http://localhost:3000**
> Si ce n'est pas le cas, ouvrez manuellement http://localhost:3000

---

### ÉTAPE 5 — Configurer l'URL du backend

Sur la page de **connexion** de l'admin :
- En bas du formulaire se trouve le champ **"URL du Backend"**
- Entrez l'URL de votre backend Spring Boot :
  - En local : `http://localhost:8080`
  - En production : `https://votre-domaine.com`
- Cette URL est sauvegardée dans le navigateur automatiquement

---

### ÉTAPE 6 — Se connecter

- Entrez l'email et le mot de passe d'un **administrateur** enregistré dans votre backend
- Le token JWT sera stocké automatiquement
- Vous serez redirigé vers le tableau de bord

---

## 🏗 COMPILATION POUR LA PRODUCTION

Quand vous êtes prêt à déployer :

```bash
npm run build
```

> Cela crée un dossier `build/` avec tous les fichiers optimisés.
> Copiez ce dossier sur votre serveur web (Nginx, Apache, Vercel, etc.)

---

## ⚙ EXTENSIONS VS CODE RECOMMANDÉES

Installez ces extensions depuis l'onglet Extensions de VS Code (`Ctrl+Shift+X`) :

1. **ES7+ React/Redux/React-Native snippets** — raccourcis React
2. **Prettier - Code formatter** — formatage automatique
3. **ESLint** — détection d'erreurs
4. **Auto Import** — importation automatique des modules
5. **GitLens** — intégration Git avancée

---

## 📁 STRUCTURE DU PROJET

```
nudemm-admin-react/
├── public/
│   └── index.html           # HTML racine
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.jsx  # Structure principale
│   │   │   ├── Sidebar.jsx    # Menu latéral
│   │   │   └── Topbar.jsx     # Barre du haut
│   │   └── ui/
│   │       └── index.jsx      # Composants UI partagés
│   ├── context/
│   │   └── AppContext.jsx     # Auth + Toast Context
│   ├── pages/
│   │   ├── Login.jsx          # Page connexion
│   │   ├── Dashboard.jsx      # Tableau de bord
│   │   ├── Chauffeurs.jsx     # Gestion chauffeurs
│   │   ├── Clients.jsx        # Gestion clients
│   │   ├── Commandes.jsx      # Gestion commandes
│   │   └── OtherPages.jsx     # Livraisons, Trajets, Véhicules,
│   │                          # Réservations, Notifs, Admins, Audit, Settings
│   ├── services/
│   │   └── api.js             # Couche API (Auth, REST calls)
│   ├── App.jsx                # Routage principal
│   ├── index.js               # Point d'entrée
│   └── index.css              # Styles globaux
└── package.json               # Dépendances
```

---

## 🔧 DÉPANNAGE

### "Module not found" ou erreur au démarrage
```bash
rm -rf node_modules
npm install
npm start
```

### Erreur CORS du backend
Dans votre backend Spring Boot, autorisez l'origine React :
```java
@CrossOrigin(origins = "http://localhost:3000")
```
Ou dans la config globale CORS :
```java
registry.addMapping("/api/**").allowedOrigins("http://localhost:3000", "https://votre-domaine.com");
```

### Token expiré / déconnexion automatique
Le token est surveillé chaque minute. Si expiré, l'admin est redirigé vers la page de connexion.

### Le backend renvoie 401
Vérifiez que vous êtes bien connecté avec un compte ayant le rôle ADMIN/SUPER_ADMIN.

---

## 🔐 RÔLES ET PERMISSIONS

| Rôle | Accès |
|---|---|
| SUPER_ADMIN | Tout |
| ADMIN | Tout sauf certaines opérations critiques |
| ADMIN1 | Dashboard, Chauffeurs, Clients, Commandes, Livraisons, Trajets, Véhicules, Réservations, Notifications |
| ADMIN2 | Dashboard, Commandes, Livraisons, Notifications, Audit |
| MODERATEUR | Dashboard, Commandes, Livraisons, Notifications |

---

## 📞 ENDPOINTS API UTILISÉS

Tous configurés dans `src/services/api.js` :

| Endpoint | Description |
|---|---|
| POST `/api/admin/login` | Connexion admin |
| GET `/api/admin/users` | Liste tous les utilisateurs |
| GET `/api/admin/users/role/{role}` | Par rôle |
| GET `/api/commandes` | Toutes les commandes |
| GET `/api/livraison` | Toutes les livraisons |
| GET `/api/trajets/disponibles` | Trajets disponibles |
| GET `/api/vehicules/all` | Tous les véhicules |
| GET `/api/reservations/trajet/{id}` | Réservations d'un trajet |
| GET `/api/notifications/{uid}/{type}` | Notifications |
