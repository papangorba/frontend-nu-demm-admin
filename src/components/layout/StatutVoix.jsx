import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AudioLines } from 'lucide-react';
import { apiVoix } from '../../services/api';

/** Pastille du haut : Wolof Ndiaye actif / inactif (clic → page de réglage). Cachée si la route n'est pas permise. */
export default function StatutVoix() {
  const navigate = useNavigate();
  const [statut, setStatut] = useState(null);

  useEffect(() => {
    let vivant = true;
    const lire = () => apiVoix.statut().then(s => vivant && setStatut(s)).catch(() => vivant && setStatut(null));
    lire();
    const id = setInterval(lire, 60000);
    const surChangement = e => setStatut(e.detail);
    window.addEventListener('voix-statut', surChangement);
    return () => { vivant = false; clearInterval(id); window.removeEventListener('voix-statut', surChangement); };
  }, []);

  if (!statut) return null;
  const actif = !!statut.actif;
  const detail = actif
    ? `Client : ${statut.VOIX_CLIENT_ACTIF ? 'oui' : 'non'} · Chauffeur : ${statut.VOIX_CHAUFFEUR_ACTIF ? 'oui' : 'non'}`
    : 'Coupé dans les apps';
  return (
    <button type="button" className="nd-topbar-clock" onClick={() => navigate('/wolof-ndiaye')}
      title={`Wolof Ndiaye — ${detail}`}
      style={{ cursor: 'pointer', color: actif ? 'var(--nd-green)' : 'var(--nd-text-muted)', fontWeight: 600 }}>
      <AudioLines />
      Wolof Ndiaye
      <span style={{ width: 8, height: 8, borderRadius: 4, background: actif ? 'var(--nd-green)' : '#9ca3af' }} />
      {actif ? 'Actif' : 'Inactif'}
    </button>
  );
}
