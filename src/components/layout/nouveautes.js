import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiNouveautes, Auth } from '../../services/api';

/**
 * Pastilles rouges du menu : nombre de nouveautés par module depuis la dernière visite
 * de l'admin dans ce module (mémorisée dans le navigateur).
 * Ouvrir un module remet sa pastille à zéro. Mise à jour chaque minute.
 */
export const MODULES_NOUVEAUTES = {
  sos: '/sos', chauffeurs: '/chauffeurs', documents: '/documents', clients: '/clients',
  suppressions: '/suppressions', commandes: '/commandes', livraisons: '/livraisons',
  trajets: '/trajets', reservations: '/reservations', entreprises: '/entreprises',
};

const CLE = m => `nd2_vu_${m}`;

/** Heure locale « 2026-11-16T09:30:00 » (le serveur compte en heure locale) */
const isoLocal = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);

const lireVu = m => { try { return localStorage.getItem(CLE(m)); } catch { return null; } };
const marquerVu = m => { try { localStorage.setItem(CLE(m), isoLocal(new Date())); } catch { /* navigation privée */ } };

export function useNouveautes() {
  const [compteurs, setCompteurs] = useState({});
  const location = useLocation();
  const modules = Object.keys(MODULES_NOUVEAUTES).filter(m => Auth.can(m));
  const cle = modules.join(',');
  const enCours = useRef(false);

  // Module ouvert : vu maintenant, pastille effacée
  const ouvert = Object.entries(MODULES_NOUVEAUTES).find(([, to]) => location.pathname === to)?.[0];
  useEffect(() => {
    if (!ouvert) return;
    marquerVu(ouvert);
    setCompteurs(c => (c[ouvert] ? { ...c, [ouvert]: 0 } : c));
  }, [ouvert]);

  useEffect(() => {
    if (!modules.length) return undefined;
    const charger = async () => {
      if (enCours.current) return;
      enCours.current = true;
      try {
        const depuis = {};
        modules.forEach(m => { const v = lireVu(m); if (v) depuis[m] = v; });
        const r = await apiNouveautes.compter(depuis);
        if (!r) return;
        // Le module affiché à l'écran reste à zéro
        const page = Object.entries(MODULES_NOUVEAUTES).find(([, to]) => window.location.pathname === to)?.[0];
        if (page) { r[page] = 0; marquerVu(page); }
        setCompteurs(r);
      } catch { /* hors ligne : on garde les derniers chiffres */ }
      finally { enCours.current = false; }
    };
    charger();
    const t = setInterval(charger, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  return compteurs;
}
