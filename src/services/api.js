// ─── ND API SERVICE ───────────────────────────────────────────
// Miroir exact du nd-core.js HTML → adapté React / ES Modules

// Backend de production par défaut (avant : localhost, donc un admin
// fraîchement installé ne parlait pas au vrai serveur).
export const DEFAULT_BASE_URL = 'https://backend-nu-demm.onrender.com';
const getBase = () =>
  (localStorage.getItem('nd2_base_url') || DEFAULT_BASE_URL).replace(/\/$/, '');

const EP = {
  ADMIN_LOGIN:    '/api/admin/login',
  ADMIN_REGISTER: '/api/admin/register',
  ADMIN_STATS:    '/api/admin/stats',
  ADMIN_DASHBOARD:'/api/admin/dashboard',
  ADMIN_LIVE:     '/api/admin/live',
  ADMIN_PUSH:     '/api/admin/push',
  USER_STATUT:    id => `/api/admin/users/${id}/statut`,
  USERS_ALL:      '/api/admin/users',
  USERS_ROLE:     r  => `/api/admin/users/role/${r}`,
  USER_BY_ID:     id => `/api/admin/users/${id}`,
  USER_UPDATE:    id => `/api/admin/users/${id}`,
  USER_DELETE:    id => `/api/admin/users/${id}`,
  CHAUFFEUR_REGISTER: '/api/auth/chauffeur/register',
  CLIENT_REGISTER:    '/api/auth/client/register',
  COMMANDES:       '/api/commandes',
  COMMANDE:        id => `/api/commandes/${id}`,
  COMMANDE_DET:    id => `/api/commandes/${id}/details`,
  COMMANDE_STATUS: id => `/api/commandes/${id}/status`,
  COMMANDES_ATT:   '/api/commandes/en-attente',
  TRAJETS_DISPO:   '/api/trajets/disponibles',
  TRAJETS_CHAUFF:  id => `/api/trajets/chauffeur/${id}`,
  TRAJET_CREATE:   '/api/trajets',
  TRAJET_UPDATE:   id => `/api/trajets/${id}`,
  TRAJET_DELETE:   id => `/api/trajets/${id}`,
  LIVRAISONS:      '/api/livraison',
  LIVRAISON:       id => `/api/livraison/${id}`,
  LIVRAISON_DET:   id => `/api/livraison/${id}/details`,
  LIVRAISONS_ATT:  '/api/livraison/en-attente',
  RESA_TRAJET:     id => `/api/reservations/trajet/${id}`,
  RESA_CLIENT:     id => `/api/reservations/client/${id}`,
  RESA_DELETE:     id => `/api/reservations/${id}`,
  VEHICULES_ALL:   '/api/vehicules/all',
  VEHICULE_USER:   id => `/api/vehicules/user/${id}`,
  VEHICULE_ADD:    id => `/api/vehicules/add/${id}`,
  NOTIFS:          (uid, t) => `/api/notifications/${uid}/${t}`,
  NOTIFS_UNREAD:   (uid, t) => `/api/notifications/${uid}/${t}/non-lues`,
  NOTIFS_COUNT:    (uid, t) => `/api/notifications/${uid}/${t}/count`,
  NOTIF_READ:      id       => `/api/notifications/${id}/lire`,
  NOTIFS_READ_ALL: (uid, t) => `/api/notifications/${uid}/${t}/lire-tout`,
};

// ─── Auth helpers ────────────────────────────────────────────
export const Auth = {
  K_TOKEN: 'nd2_token',
  K_USER:  'nd2_user',
  token()  { return localStorage.getItem(this.K_TOKEN); },
  user()   { try { return JSON.parse(localStorage.getItem(this.K_USER)); } catch { return null; } },
  logged() { return !!this.token() && !this.isTokenExpired(); },
  role()   { return this.user()?.role || ''; },

  decodeToken(token) {
    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch { return null; }
  },
  isTokenExpired() {
    const token = this.token();
    if (!token) return true;
    const decoded = this.decodeToken(token);
    if (!decoded?.exp) return false;
    return decoded.exp * 1000 < Date.now() + 30000;
  },
  tokenRemainingMinutes() {
    const token = this.token();
    if (!token) return 0;
    const decoded = this.decodeToken(token);
    if (!decoded?.exp) return 0;
    return Math.max(0, Math.round((decoded.exp * 1000 - Date.now()) / 60000));
  },
  save(token, user) {
    localStorage.setItem(this.K_TOKEN, token);
    localStorage.setItem(this.K_USER, JSON.stringify(user));
  },
  logout() {
    localStorage.removeItem(this.K_TOKEN);
    localStorage.removeItem(this.K_USER);
    window.location.href = '/login';
  },
  PERMS: {
    SUPER_ADMIN: ['*'],
    ADMIN:       ['dashboard','supervision','sos','entreprises','chauffeurs','documents','clients','suppressions','sessions','commandes','livraisons','trajets','vehicules','reservations','notifications','publicites','contenus','tarifs','controle','regions','admins','audit','settings'],
    ADMIN1:      ['dashboard','supervision','sos','chauffeurs','documents','clients','suppressions','commandes','livraisons','trajets','vehicules','reservations','notifications','publicites','contenus','tarifs'],
    ADMIN2:      ['dashboard','supervision','sos','documents','commandes','livraisons','notifications','publicites','audit'],
    GESTIONNAIRE_FLOTTE: ['mon-entreprise'],
    MODERATEUR:  ['dashboard','supervision','sos','commandes','livraisons','notifications'],
  },
  can(mod) {
    // L'espace « Mon entreprise » n'a de sens que pour le gérant d'une entreprise de transport
    if (mod === 'mon-entreprise' || mod.startsWith('ent-')) return this.role() === 'GESTIONNAIRE_FLOTTE';
    const perms = this.PERMS[this.role()] || [];
    return perms.includes('*') || perms.includes(mod);
  },
};

// ─── HTTP core ────────────────────────────────────────────────
async function http(method, url, body) {
  const isLogin = url.includes('/login');
  // Connexion : on ignore toute ancienne session restée dans le navigateur
  const token = isLogin ? null : Auth.token();
  if (token && Auth.isTokenExpired()) { Auth.logout(); return; }
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  let r;
  try { r = await fetch(getBase() + url, opts); }
  catch { throw new Error('Serveur inaccessible — vérifiez que le backend est en ligne'); }
  // 401 sur une requête authentifiée = session expirée → déconnexion.
  // 401 sans jeton (connexion) = mauvais identifiants → on affiche l'erreur.
  // (Avant : la page se rechargeait sans message, « rien ne se passait ».)
  if (r.status === 401 && token && !isLogin) { Auth.logout(); return; }
  if (r.status === 403) throw new Error('Accès refusé (403)');
  const text = await r.text();
  let d = {};
  try { d = text ? JSON.parse(text) : {}; } catch {}
  if (!r.ok) throw new Error(d.error || d.erreur || d.message || `HTTP ${r.status}`);
  return d;
}
const get    = url      => http('GET',    url);
const post   = (url, b) => http('POST',   url, b);
const put    = (url, b) => http('PUT',    url, b);
const del    = url      => http('DELETE', url);

// ─── Services ─────────────────────────────────────────────────
export const apiAuth = {
  login: d => post(EP.ADMIN_LOGIN, d),
};

export const apiUsers = {
  all:      ()      => get(EP.USERS_ALL),
  byRole:   r       => get(EP.USERS_ROLE(r)),
  byId:     id      => get(EP.USER_BY_ID(id)),
  update:   (id, d) => put(EP.USER_UPDATE(id), d),
  del:      id      => del(EP.USER_DELETE(id)),
  stats:    ()      => get(EP.ADMIN_STATS),
  /** Suspendre (actif=false) ou réactiver un compte. L'utilisateur est prévenu. */
  setActif: (id, actif, motif = '') => put(EP.USER_STATUT(id), { actif, motif }),
  chauffeurs: async () => {
    try { return await get(EP.USERS_ROLE('CHAUFFEUR')); }
    catch { const a = await get(EP.USERS_ALL); return (a||[]).filter(u => u.role==='CHAUFFEUR'); }
  },
  clients: async () => {
    try { return await get(EP.USERS_ROLE('CLIENT')); }
    catch { const a = await get(EP.USERS_ALL); return (a||[]).filter(u => u.role==='CLIENT'); }
  },
  admins: async () => {
    const a = await get(EP.USERS_ALL);
    return (a||[]).filter(u => ['ADMIN','SUPER_ADMIN','ADMIN1','ADMIN2','MODERATEUR'].includes(u.role));
  },
  registerChauffeur: d => post(EP.CHAUFFEUR_REGISTER, d),
  registerClient:    d => post(EP.CLIENT_REGISTER, d),
  registerAdmin:     d => post(EP.ADMIN_REGISTER, d),
};

export const apiCommandes = {
  all:     ()      => get(EP.COMMANDES),
  byId:    id      => get(EP.COMMANDE(id)),
  detail:  id      => get(EP.COMMANDE_DET(id)),
  update:  (id, d) => put(EP.COMMANDE(id), d),
  status:  (id, s) => put(EP.COMMANDE_STATUS(id), { status: s }),
  del:     id      => del(EP.COMMANDE(id)),
  /** Annulation par l'admin : statut ANNULEE + client et chauffeur notifiés. */
  annuler: id      => del(EP.COMMANDE(id)),
  attente: ()      => get(EP.COMMANDES_ATT),
};

// ─── Pubs, annonces et textes des apps ───────────────────────
export const apiContenus = {
  bannieres:          ()      => get('/api/admin/bannieres'),
  creerBanniere:      d       => post('/api/admin/bannieres', d),
  modifierBanniere:   (id, d) => put(`/api/admin/bannieres/${id}`, d),
  supprimerBanniere:  id      => del(`/api/admin/bannieres/${id}`),
  annonces:           ()      => get('/api/admin/annonces'),
  creerAnnonce:       d       => post('/api/admin/annonces', d),
  modifierAnnonce:    (id, d) => put(`/api/admin/annonces/${id}`, d),
  supprimerAnnonce:   id      => del(`/api/admin/annonces/${id}`),
  textes:             ()      => get('/api/admin/contenus'),
  modifierTexte:      (cle, d) => put(`/api/admin/contenus/${cle}`, d),
};

/** URL complète d'une image renvoyée par le serveur (« /api/public/medias/... »). */
export const mediaUrl = chemin =>
  !chemin ? null : chemin.startsWith('/') ? getBase() + chemin : chemin;

/**
 * Réduit une image avant l'envoi (largeur max 1280 px, JPEG 82 %) :
 * une photo de téléphone de 4 Mo devient ~200 Ko, chargée vite par les apps.
 */
export const compresserImage = (file, maxW = 1280, qualite = 0.82) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Ce fichier n'est pas une image valide"));
      img.onload = () => {
        const ratio = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', qualite));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

// ─── Tarifs, contrôle des apps, documents chauffeurs ─────────
export const apiControle = {
  tarifs:          ()         => get('/api/admin/tarifs'),
  modifierTarif:   (code, d)  => put(`/api/admin/tarifs/${code}`, d),
  config:          ()         => get('/api/admin/config'),
  modifierConfig:  d          => put('/api/admin/config', d),
  documents:       (statut = 'EN_ATTENTE') => get(`/api/admin/documents?statut=${statut}`),
  documentsEnAttente: ()      => get('/api/admin/documents/compteur'),
  documentsChauffeur: id      => get(`/api/admin/documents/chauffeur/${id}`),
  validerDocument: id         => put(`/api/admin/documents/${id}/valider`),
  refuserDocument: (id, motif) => put(`/api/admin/documents/${id}/refuser`, { motif }),
  /** Photo du document (route protégée : chargée avec le jeton puis affichée). */
  async fichierDocument(id) {
    const r = await fetch(`${getBase()}/api/admin/documents/${id}/fichier`, {
      headers: { Authorization: `Bearer ${Auth.token()}` },
    });
    if (!r.ok) throw new Error(`Image indisponible (HTTP ${r.status})`);
    return URL.createObjectURL(await r.blob());
  },
};

// ─── Fiche complète d'un compte + activité des comptes ────────
export const apiFiche = {
  fiche:    id => get(`/api/admin/users/${id}/fiche`),
  activite: () => get('/api/admin/activite'),
  /** Hausses de prix des clients + contre-propositions des chauffeurs */
  statsPrix: () => get('/api/admin/stats-prix'),
  /** Tous les clients et chauffeurs + demandes de la période (carte de la supervision) */
  carte: (jours = 30) => get(`/api/admin/carte?jours=${jours}`),
};

// ─── Pilotage (routes réservées aux admins) ───────────────────
export const apiAdmin = {
  /** Indicateurs clés + courbe des 14 derniers jours (calculés côté serveur). */
  dashboard: () => get(EP.ADMIN_DASHBOARD),
  /** Courses / livraisons en attente ou en cours avec position du chauffeur. */
  live:      () => get(EP.ADMIN_LIVE),
  /** cible : CLIENTS | CHAUFFEURS | TOUS | UTILISATEUR (avec userId). */
  push:      d  => post(EP.ADMIN_PUSH, d),
};

// ─── Entreprises de transport abonnées (SaaS, partie 3) ───────
export const apiEntreprises = {
  liste:           (statut = 'TOUTES') => get(`/api/admin/flottes?statut=${statut}`),
  indicateurs:     ()        => get('/api/admin/flottes/indicateurs'),
  /** Renvoie l'entreprise + identifiant + motDePasse (affiché une seule fois). */
  creer:           d         => post('/api/admin/flottes', d),
  modifier:        (id, d)   => put(`/api/admin/flottes/${id}`, d),
  motDePasse:      id        => put(`/api/admin/flottes/${id}/mot-de-passe`),
  suspendre:       id        => put(`/api/admin/flottes/${id}/suspendre`),
  reactiver:       id        => put(`/api/admin/flottes/${id}/reactiver`),
  paiements:       id        => get(`/api/admin/flottes/${id}/paiements`),
  /** d : { mois, moyen, reference, montant? } — prolonge l'abonnement */
  payer:           (id, d)   => post(`/api/admin/flottes/${id}/paiements`, d),
  formules:        ()        => get('/api/admin/formules/toutes'),
  /** Modules en commun avec l'espace de l'entreprise (lecture) */
  vehicules:       id        => get(`/api/admin/flottes/${id}/vehicules`),
  chauffeurs:      id        => get(`/api/admin/flottes/${id}/chauffeurs`),
  tableauDeBord:   id        => get(`/api/admin/flottes/${id}/tableau-de-bord`),
  modifierFormule: (code, d) => put(`/api/admin/formules/${code}`, d),
};

/** Espace du gérant d'une entreprise (ne voit que la sienne). */
export const apiMonEntreprise = {
  moi:               ()        => get('/api/flotte/moi'),
  tableauDeBord:     ()        => get('/api/flotte/tableau-de-bord'),
  vehicules:         ()        => get('/api/flotte/vehicules'),
  creerVehicule:     d         => post('/api/flotte/vehicules', d),
  modifierVehicule:  (id, d)   => put(`/api/flotte/vehicules/${id}`, d),
  supprimerVehicule: id        => del(`/api/flotte/vehicules/${id}`),
  chauffeurs:        ()        => get('/api/flotte/chauffeurs'),
  creerChauffeur:    d         => post('/api/flotte/chauffeurs', d),
  modifierChauffeur: (id, d)   => put(`/api/flotte/chauffeurs/${id}`, d),
  retirerChauffeur:  id        => put(`/api/flotte/chauffeurs/${id}/retirer`),
  /** image : data URL (compresserImage) */
  changerLogo:       image     => put('/api/flotte/logo', { image }),
  /** periode : A_VENIR | PASSES */
  trajets:           (periode = 'A_VENIR') => get(`/api/flotte/trajets?periode=${periode}`),
  /** d.repetition = { jours: [1..7], jusquau: 'yyyy-mm-dd' } pour un trajet récurrent */
  creerTrajet:       d         => post('/api/flotte/trajets', d),
  modifierTrajet:    (id, d)   => put(`/api/flotte/trajets/${id}`, d),
  annulerTrajet:     (id, d)   => put(`/api/flotte/trajets/${id}/annuler`, d),
  /** Liste d'embarquement d'un départ (partie 3d-2) */
  passagers:         id        => get(`/api/flotte/trajets/${id}/passagers`),
  /** d : { code } ou { reservationId, embarque } */
  embarquer:         (id, d)   => put(`/api/flotte/trajets/${id}/embarquer`, d),
  messagePassagers:  (id, message) => post(`/api/flotte/trajets/${id}/message`, { message }),
  supprimerLogo:     ()        => del('/api/flotte/logo'),
};

// ─── Sécurité : alertes SOS des apps ──────────────────────────
export const apiSos = {
  /** filtre : ACTIVES (ouvertes + prises en charge) | TOUTES (100 dernières) */
  liste:    (filtre = 'ACTIVES') => get(`/api/admin/sos?filtre=${filtre}`),
  compteur: ()                   => get('/api/admin/sos/compteur'),
  /** d : { statut: PRISE_EN_CHARGE | RESOLUE, note } */
  traiter:  (id, d)              => put(`/api/admin/sos/${id}`, d),
};

// ─── Demandes de suppression de compte (page web publique /supprimer-compte) ───
// ─── Services ouverts / coupés par région ─────────────────────
export const apiRegions = {
  liste:    ()                => get('/api/admin/regions'),
  /** d : { services: { CODE: bool } } et/ou { message } */
  modifier: (code, d)         => put(`/api/admin/regions/${code}`, d),
  partout:  (service, actif)  => put('/api/admin/regions', { service, actif }),
};

/** Pastilles du menu : nouveautés par module depuis la dernière visite ({ module: 'aaaa-mm-jjThh:mm:ss' }) */
export const apiNouveautes = {
  compter: depuis => get(`/api/admin/nouveautes?${new URLSearchParams(depuis).toString()}`),
};

export const apiSuppressions = {
  liste:   ()         => get('/api/admin/suppressions'),
  traiter: id         => post(`/api/admin/suppressions/${id}/traiter`),
  rejeter: (id, note) => post(`/api/admin/suppressions/${id}/rejeter`, { note }),
};

export const apiTrajets = {
  dispo:       ()      => get(EP.TRAJETS_DISPO),
  byChauffeur: id      => get(EP.TRAJETS_CHAUFF(id)),
  create:      d       => post(EP.TRAJET_CREATE, d),
  update:      (id, d) => put(EP.TRAJET_UPDATE(id), d),
  del:         id      => del(EP.TRAJET_DELETE(id)),
  all: async () => {
    try { return await get(EP.TRAJETS_DISPO); } catch { return []; }
  },
};

export const apiLivraisons = {
  all:    ()  => get(EP.LIVRAISONS),
  byId:   id  => get(EP.LIVRAISON(id)),
  detail: id  => get(EP.LIVRAISON_DET(id)),
  attente: () => get(EP.LIVRAISONS_ATT),
  /** Annulation par l'admin : statut ANNULEE + client et livreur notifiés. */
  annuler: id => del(EP.LIVRAISON(id)),
};

export const apiReservations = {
  byTrajet: id => get(EP.RESA_TRAJET(id)),
  byClient: id => get(EP.RESA_CLIENT(id)),
  del:      id => del(EP.RESA_DELETE(id)),
};

export const apiVehicules = {
  all:    () => get(EP.VEHICULES_ALL),
  byUser: id => get(EP.VEHICULE_USER(id)),
};

export const apiNotifs = {
  get:         (uid, t) => get(EP.NOTIFS(uid, t)),
  unread:      (uid, t) => get(EP.NOTIFS_UNREAD(uid, t)),
  count:       (uid, t) => get(EP.NOTIFS_COUNT(uid, t)),
  markRead:    id       => put(EP.NOTIF_READ(id), {}),
  markAllRead: (uid, t) => put(EP.NOTIFS_READ_ALL(uid, t), {}),
};

// ─── Audit Log (localStorage) ────────────────────────────────
export const Audit = {
  KEY: 'nd2_audit',
  log(action, details) {
    const logs = this.all();
    const user = Auth.user();
    logs.unshift({ id: Date.now(), action, details, admin: user?.name||user?.email||'Admin', role: user?.role||'—', at: new Date().toISOString() });
    localStorage.setItem(this.KEY, JSON.stringify(logs.slice(0, 500)));
  },
  all()   { try { return JSON.parse(localStorage.getItem(this.KEY)||'[]'); } catch { return []; } },
  clear() { localStorage.removeItem(this.KEY); },
};

// ─── UI helpers ───────────────────────────────────────────────
export const fmtDate = d => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }); }
  catch { return d; }
};
export const fmtDT = d => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return d; }
};
export const money = n => {
  if (n==null||n==='') return '—';
  return Number(n).toLocaleString('fr-FR') + ' FCFA';
};
export const serviceIcon = t => {
  const map = { VOITURE_COURSE:'🚗', MOTO_TAXI:'🛵', MOTO_2_ROUES:'🏍', MOTO_3_ROUES:'🛺', FOURGONNETTE:'🚐', TAXI_BOKKO:'🚕', CAMION:'🚚' };
  return map[t] || '❔';
};

/** Service d'un chauffeur d'après le véhicule déclaré dans l'app (« Voiture course », « Moto-taxi Jakarta »…).
 *  Le champ typeService du compte est souvent vide : il ne sert qu'en secours. */
export const serviceDuVehicule = (typeVehicule, typeService) => {
  const t = String(typeVehicule || '').toLowerCase();
  if (t) {
    if (/jakarta|moto[ -_]?taxi|taxi[ -_]?moto/.test(t)) return 'MOTO_TAXI';
    if (/bokko/.test(t)) return 'TAXI_BOKKO';
    if (/camion/.test(t)) return 'CAMION';
    if (/fourgon/.test(t)) return 'FOURGONNETTE';
    if (/3|trois|tricycle/.test(t)) return 'MOTO_3_ROUES';
    if (/moto/.test(t)) return 'MOTO_2_ROUES';
    if (/voiture|taxi|course/.test(t)) return 'VOITURE_COURSE';
  }
  return typeService || null;
};
/** Courses (passagers), Livraison (colis à moto) ou Cargo (3 roues, fourgonnette, camion) */
export const categorieService = s =>
  ['VOITURE_COURSE', 'MOTO_TAXI', 'TAXI_BOKKO'].includes(s) ? 'Courses'
    : s === 'MOTO_2_ROUES' ? 'Livraison' : s ? 'Cargo' : null;
export const avatarColor = name => {
  const colors = ['#e63946','#2a9d8f','#e9c46a','#264653','#f4a261','#8338ec','#3a86ff','#06d6a0'];
  return colors[(name||'?').charCodeAt(0) % colors.length];
};

export const STATUS_MAP = {
  EN_ATTENTE: { cls: 'badge-warn',      label: '⏳ En attente' },
  PROGRAMMEE: { cls: 'badge-info',      label: '🗓 Programmée' },
  ACCEPTEE:   { cls: 'badge-info',      label: '✓ Acceptée' },
  EN_COURS:   { cls: 'badge-primary',   label: '▶ En cours' },
  TERMINEE:   { cls: 'badge-success',   label: '✅ Terminée' },
  ANNULEE:    { cls: 'badge-danger',    label: '✗ Annulée' },
  LIVREE:     { cls: 'badge-success',   label: '📦 Livrée' },
  ACTIF:      { cls: 'badge-success',   label: '● Actif' },
  COMPLET:    { cls: 'badge-warn',      label: '⬛ Complet' },
  TERMINE:    { cls: 'badge-secondary', label: '■ Terminé' },
  ANNULE:     { cls: 'badge-danger',    label: '✗ Annulé' },
  CONFIRMEE:  { cls: 'badge-success',   label: '✓ Confirmée' },
  EXPIREE:    { cls: 'badge-secondary', label: 'Expirée' },
};

export const ROLE_MAP = {
  SUPER_ADMIN: { cls: 'role-sa',       label: '👑 Super Admin' },
  ADMIN:       { cls: 'role-admin',    label: '🔑 Admin' },
  ADMIN1:      { cls: 'role-a1',       label: '🔧 Admin 1' },
  ADMIN2:      { cls: 'role-a2',       label: '🛡 Admin 2' },
  MODERATEUR:  { cls: 'role-mo',       label: '👁 Modérateur' },
  GESTIONNAIRE_FLOTTE: { cls: 'role-admin', label: '🚌 Entreprise' },
  CLIENT:      { cls: 'role-client',   label: '👤 Client' },
  CHAUFFEUR:   { cls: 'role-chauffeur',label: '🏍 Chauffeur' },
};

export const setBaseUrl = url => localStorage.setItem('nd2_base_url', url);
export const getBaseUrl = () => localStorage.getItem('nd2_base_url') || DEFAULT_BASE_URL;
