import L from 'leaflet';

/**
 * Icônes de la supervision, dessinées comme dans les apps : véhicule vu de dessus (jaune, orienté
 * dans le sens de la marche), client = épingle avec une personne, destination = drapeau rouge.
 * L'état du chauffeur se lit à l'anneau : vert = libre, orange = en course, gris = hors ligne.
 */

export const SENEGAL = [[12.25, -17.6], [16.75, -11.3]];
export const COULEURS_ETAT = { EN_LIGNE: '#16a34a', OCCUPE: '#f59e0b', HORS_LIGNE: '#94a3b8', ATTENTE: '#f59e0b' };

const LIBELLES_VEHICULE = {
  VOITURE: 'Voiture', TAXI: 'Taxi', MOTO_TAXI: 'Moto-taxi', MOTO: 'Moto', TROIS_ROUES: '3 roues',
  FOURGONNETTE: 'Fourgonnette', CAMION: 'Camion',
};
export const libelleVehicule = c => LIBELLES_VEHICULE[c] || 'Véhicule';

/** Forme du véhicule selon son code (serveur : VOITURE, TAXI, MOTO_TAXI, MOTO, TROIS_ROUES, FOURGONNETTE, CAMION) */
const forme = code => {
  const c = String(code || 'VOITURE').toUpperCase();
  if (c.includes('TROIS') || c.includes('3')) return 'tricycle';
  if (c.includes('CAMION')) return 'camion';
  if (c.includes('FOURGON')) return 'van';
  if (c.includes('MOTO')) return 'moto';
  return 'car';
};

const svgVehicule = (code, couleur) => {
  switch (forme(code)) {
    case 'moto':
      return `<svg viewBox="0 0 22 48" width="16" height="34">
        <rect x="8.5" y="1" width="5" height="11" rx="2.5" fill="#1f2a37"/><rect x="8" y="35" width="6" height="12" rx="3" fill="#1f2a37"/>
        <rect x="1" y="11.5" width="20" height="3" rx="1.5" fill="#1f2a37"/>
        <rect x="6.5" y="13" width="9" height="24" rx="4.5" fill="${couleur}"/>
        <circle cx="11" cy="26" r="5.5" fill="#344054"/><circle cx="11" cy="2.5" r="1.8" fill="#fff8e1"/></svg>`;
    case 'tricycle':
      return `<svg viewBox="0 0 30 56" width="19" height="36">
        <rect x="12.5" y="1.5" width="5" height="10" rx="2.5" fill="#1f2a37"/><rect x="6" y="10.5" width="18" height="3" rx="1.5" fill="#1f2a37"/>
        <rect x="0.5" y="39" width="5" height="11" rx="2.5" fill="#1f2a37"/><rect x="24.5" y="39" width="5" height="11" rx="2.5" fill="#1f2a37"/>
        <rect x="10" y="12" width="10" height="14" rx="4.5" fill="${couleur}"/><circle cx="15" cy="20" r="4.5" fill="#344054"/>
        <rect x="4" y="27" width="22" height="26" rx="2.5" fill="#7a5c00"/><rect x="6.2" y="29.2" width="17.6" height="21.6" rx="1.5" fill="#f2f4f7"/></svg>`;
    case 'camion':
      return `<svg viewBox="0 0 36 80" width="20" height="45">
        <rect x="4" y="3" width="28" height="19" rx="7" fill="${couleur}"/>
        <path d="M8 9 Q18 5.5 28 9 L27 16 L9 16 Z" fill="#1f2a37"/>
        <rect x="1.5" y="24" width="33" height="53" rx="2.5" fill="#ffffff" stroke="#98a2b3"/>
        <rect x="16" y="26" width="4" height="49" fill="${couleur}" opacity=".85"/></svg>`;
    case 'van':
      return `<svg viewBox="0 0 32 66" width="20" height="41">
        <rect x="4" y="3" width="24" height="20" rx="7" fill="${couleur}"/>
        <path d="M8 11 Q16 7 24 11 L23 18 L9 18 Z" fill="#1f2a37"/>
        <rect x="2" y="21" width="28" height="42" rx="3" fill="#f2f4f7" stroke="#98a2b3"/>
        <rect x="14" y="24" width="4" height="36" fill="${couleur}" opacity=".85"/></svg>`;
    default:
      return `<svg viewBox="0 0 30 58" width="19" height="37">
        <rect x="3" y="3" width="24" height="52" rx="9" fill="${couleur}"/>
        <path d="M7 17 Q15 12 23 17 L21.5 25 L8.5 25 Z" fill="#1f2a37"/>
        <path d="M8.5 43 L21.5 43 L23 48 Q15 50 7 48 Z" fill="#1f2a37"/>
        <rect x="8.5" y="26.5" width="13" height="15" rx="3" fill="#ffd966"/>
        <rect x="6" y="4" width="5" height="2.5" rx="1" fill="#fff8e1"/><rect x="19" y="4" width="5" height="2.5" rx="1" fill="#fff8e1"/>
        <rect x="6" y="52" width="5" height="2" rx="1" fill="#d92d20"/><rect x="19" y="52" width="5" height="2" rx="1" fill="#d92d20"/></svg>`;
  }
};

const cache = new Map();

/** Véhicule orienté (cap en degrés, 0 = nord) avec l'anneau de son état ; « sel » = sélectionné */
export const iconeVehicule = ({ code, etat = 'EN_LIGNE', cap = 0, sel = false, libelle } = {}) => {
  const angle = Math.round((Number(cap) || 0) / 15) * 15; // 24 orientations : icônes réutilisées
  const cle = `v-${forme(code)}-${etat}-${angle}-${sel}-${libelle || ''}`;
  if (cache.has(cle)) return cache.get(cle);
  const anneau = COULEURS_ETAT[etat] || '#64748b';
  const corps = etat === 'HORS_LIGNE' ? '#cbd5e1' : '#FFC107';
  const taille = sel ? 54 : 44;
  const icone = L.divIcon({
    className: '',
    html: `<div class="cv-vehicule${sel ? ' sel' : ''}" style="--anneau:${anneau};width:${taille}px;height:${taille}px">
             <div class="cv-rot" style="transform:rotate(${angle}deg)">${svgVehicule(code, corps)}</div>
             ${libelle ? `<span class="cv-libelle">${libelle}</span>` : ''}
           </div>`,
    iconSize: [taille, taille], iconAnchor: [taille / 2, taille / 2], popupAnchor: [0, -taille / 2],
  });
  cache.set(cle, icone);
  return icone;
};

/** Personne : client (bleu) ou point de prise en charge en attente (orange, qui pulse) */
export const iconePersonne = ({ couleur = '#2563eb', attente = false, petit = false } = {}) => {
  const cle = `p-${couleur}-${attente}-${petit}`;
  if (cache.has(cle)) return cache.get(cle);
  const w = petit ? 22 : 30, h = petit ? 30 : 40;
  const icone = L.divIcon({
    className: '',
    html: `<div class="cv-personne${attente ? ' attente' : ''}">
      <svg viewBox="0 0 34 46" width="${w}" height="${h}">
        <path d="M17 44 Q17 33 6 26 A15 15 0 1 1 28 26 Q17 33 17 44 Z" fill="#fff"/>
        <circle cx="17" cy="16.5" r="13" fill="${couleur}"/>
        <circle cx="17" cy="12.5" r="4.2" fill="#fff"/>
        <path d="M9.5 24.5 Q9.5 17.5 17 17.5 Q24.5 17.5 24.5 24.5 Z" fill="#fff"/></svg></div>`,
    iconSize: [w, h], iconAnchor: [w / 2, h - 1], popupAnchor: [0, -h + 4],
  });
  cache.set(cle, icone);
  return icone;
};

/**
 * Les trois services, avec la même couleur et la même icône que dans les apps :
 * course = personne (vert), livraison = colis (orange, moto), cargo = caisses (bleu, 3 roues / fourgonnette / camion).
 */
export const SERVICES_DEMANDE = {
  COURSE:    { couleur: '#12B76A', libelle: 'Course',    emoji: '🚗' },
  LIVRAISON: { couleur: '#F79009', libelle: 'Livraison', emoji: '📦' },
  CARGO:     { couleur: '#1570EF', libelle: 'Cargo',     emoji: '🚚' },
};

/** Service d'un élément de la supervision (course, ou livraison à moto, ou cargo) */
export const serviceDe = it => (it?.kind === 'COURSE' ? 'COURSE' : it?.service === 'CARGO' ? 'CARGO' : 'LIVRAISON');

const GLYPHES = {
  COURSE: '<circle cx="17" cy="12.5" r="4.2" fill="#fff"/><path d="M9.5 24.5 Q9.5 17.5 17 17.5 Q24.5 17.5 24.5 24.5 Z" fill="#fff"/>',
  LIVRAISON: '<rect x="9.5" y="12" width="15" height="11" rx="1.5" fill="#fff"/><rect x="8.5" y="9.5" width="17" height="4" rx="1.2" fill="#fff" stroke="#c46a00" stroke-width="1"/><rect x="15.8" y="9.5" width="2.4" height="13.5" fill="#f79009"/>',
  CARGO: '<g fill="#fff" stroke="#0b4fb3" stroke-width="1"><rect x="8" y="15.5" width="8.5" height="8"/><rect x="17.5" y="15.5" width="8.5" height="8"/><rect x="12.5" y="8" width="9" height="7.5"/></g><rect x="7.5" y="23.8" width="19" height="2" fill="#fff"/>',
};

/** Point de départ d'une demande : épingle de la couleur du service ; « attente » = pulse (pas encore de chauffeur) */
export const iconeDemande = ({ service = 'COURSE', attente = false, petit = false } = {}) => {
  const s = SERVICES_DEMANDE[service] ? service : 'COURSE';
  const cle = `d-${s}-${attente}-${petit}`;
  if (cache.has(cle)) return cache.get(cle);
  const w = petit ? 22 : 30, h = petit ? 30 : 40;
  const icone = L.divIcon({
    className: '',
    html: `<div class="cv-personne${attente ? ' attente' : ''}" style="--pulse:${SERVICES_DEMANDE[s].couleur}">
      <svg viewBox="0 0 34 46" width="${w}" height="${h}">
        <path d="M17 44 Q17 33 6 26 A15 15 0 1 1 28 26 Q17 33 17 44 Z" fill="#fff"/>
        <circle cx="17" cy="16.5" r="13" fill="${SERVICES_DEMANDE[s].couleur}"/>${GLYPHES[s]}</svg></div>`,
    iconSize: [w, h], iconAnchor: [w / 2, h - 1], popupAnchor: [0, -h + 4],
  });
  cache.set(cle, icone);
  return icone;
};

/** Destination : drapeau rouge */
export const iconeDrapeau = () => {
  if (cache.has('drapeau')) return cache.get('drapeau');
  const icone = L.divIcon({
    className: '',
    html: `<svg viewBox="0 0 40 46" width="30" height="35" style="filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))">
      <path d="M21 5 C27 2 32 9 38 6 L38 21 C32 24 27 17 21 20 Z" fill="#d92d20"/>
      <rect x="18.6" y="4" width="2.8" height="39" rx="1.4" fill="#344054"/><circle cx="20" cy="4" r="2.2" fill="#667085"/></svg>`,
    iconSize: [30, 35], iconAnchor: [15, 33],
  });
  cache.set('drapeau', icone);
  return icone;
};

/** La région (cadre [ouest, sud, est, nord]) → bornes Leaflet */
export const bornesRegion = r => (r?.cadre ? [[r.cadre[1], r.cadre[0]], [r.cadre[3], r.cadre[2]]] : SENEGAL);
