import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import { apiRegions } from '../services/api';
import { SENEGAL, bornesRegion, COULEURS_ETAT } from './carteIcones';

/** Les 14 régions (avec leur cadre), chargées une fois */
let regionsEnCache = null;
export function useRegions() {
  const [regions, setRegions] = useState(regionsEnCache || []);
  useEffect(() => {
    if (regionsEnCache) return;
    apiRegions.liste().then(r => {
      regionsEnCache = (r?.regions || []).map(x => ({ code: x.code, nom: x.nom, cadre: x.cadre }))
        .sort((a, b) => a.nom.localeCompare(b.nom));
      setRegions(regionsEnCache);
    }).catch(() => {});
  }, []);
  return regions;
}

/** Liste « Tout le Sénégal » + 14 régions, avec le nombre d'éléments dans chacune */
export function SelectZone({ value, onChange, regions, compter }) {
  return (
    <select className="nd-input nd-select" style={{ width: 210 }} value={value} onChange={e => onChange(e.target.value)}
      aria-label="Zone">
      <option value="">Tout le Sénégal{compter ? ` (${compter(null)})` : ''}</option>
      {regions.map(r => <option key={r.code} value={r.code}>{r.nom}{compter ? ` (${compter(r.code)})` : ''}</option>)}
    </select>
  );
}

/** Cadre la carte sur la zone choisie (tout le Sénégal par défaut) à chaque changement */
export function CadrerZone({ zone, regions, jeton = 0 }) {
  const map = useMap();
  useEffect(() => {
    const r = regions.find(x => x.code === zone);
    map.flyToBounds(zone && r ? bornesRegion(r) : SENEGAL, { padding: [20, 20], duration: 0.7 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, regions.length, jeton]);
  return null;
}

/** Légende fixe en bas à gauche de la carte */
export function Legende({ demandes = false }) {
  const ligne = (couleur, texte, forme = 'rond') => (
    <div className="cv-legende-ligne">
      <span className={`cv-puce ${forme}`} style={{ background: couleur, color: couleur }} />{texte}
    </div>
  );
  return (
    <details className="cv-legende" open>
      <summary>Légende</summary>
      {ligne(COULEURS_ETAT.EN_LIGNE, 'Chauffeur libre', 'anneau')}
      {ligne(COULEURS_ETAT.OCCUPE, 'En course', 'anneau')}
      {ligne(COULEURS_ETAT.HORS_LIGNE, 'Hors ligne', 'anneau')}
      {ligne('#2563eb', 'Client')}
      {ligne('#f59e0b', 'Attend un chauffeur')}
      {ligne('#d92d20', 'Destination', 'carre')}
      {demandes && ligne('#dc2626', 'Demandes (plus foncé = plus de demandes)')}
    </details>
  );
}
