import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, ChevronRight } from 'lucide-react';
import { apiAFaire, Auth } from '../../services/api';

const COULEURS = { URGENT: 'var(--nd-red)', IMPORTANT: 'var(--nd-orange)', INFO: 'var(--nd-blue)' };
const LIBELLES = { URGENT: 'Urgent', IMPORTANT: 'À traiter', INFO: 'À surveiller' };

/**
 * Cloche « À faire » (barre du haut) : tous les problèmes et tâches en attente — SOS, chauffeurs reconnus sous un
 * autre numéro, documents, recharges, réclamations, remboursements, versements, suppressions, abonnements, budgets.
 * Actualisée chaque minute ; chaque ligne ouvre la page où la traiter. Seules les pages permises au rôle sont listées.
 */
export default function CentreAFaire() {
  const navigate = useNavigate();
  const [donnees, setDonnees] = useState(null);
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef(null);
  const panneau = useRef(null);
  const [place, setPlace] = useState({ top: 60, right: 16 });

  useEffect(() => {
    let vivant = true;
    const lire = () => apiAFaire.liste().then(d => vivant && setDonnees(d)).catch(() => {});
    lire();
    const id = setInterval(lire, 60000);
    const surFocus = () => document.visibilityState === 'visible' && lire();
    document.addEventListener('visibilitychange', surFocus);
    return () => { vivant = false; clearInterval(id); document.removeEventListener('visibilitychange', surFocus); };
  }, []);

  useEffect(() => {
    if (!ouvert) return;
    const fermer = e => {
      if (boite.current?.contains(e.target) || panneau.current?.contains(e.target)) return;
      setOuvert(false);
    };
    document.addEventListener('mousedown', fermer);
    return () => document.removeEventListener('mousedown', fermer);
  }, [ouvert]);

  if (!donnees) return null;
  const elements = (donnees.elements || []).filter(e => Auth.can(e.lien.replace(/^\//, '')));
  const total = elements.reduce((s, e) => s + e.nombre, 0);
  const urgent = elements.some(e => e.gravite === 'URGENT');

  return (
    <div ref={boite} style={{ position: 'relative' }}>
      <button type="button" className="nd-icon-btn" onClick={() => {
        // La barre du haut coupe ce qui dépasse (éclairs) : la liste s'affiche par-dessus la page, sous la cloche
        const r = boite.current?.getBoundingClientRect();
        if (r) setPlace({ top: r.bottom + 8, right: Math.max(16, window.innerWidth - r.right) });
        setOuvert(o => !o);
      }}
        title={total ? `${total} chose(s) à faire` : 'Rien à faire'} aria-label="À faire" style={{ position: 'relative' }}>
        <Bell style={urgent ? { color: 'var(--nd-red)' } : undefined} />
        {total > 0 && (
          <span style={{
            position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
            background: urgent ? 'var(--nd-red)' : 'var(--nd-orange)', color: '#fff', fontSize: 11, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>{total > 99 ? '99+' : total}</span>
        )}
      </button>
      {ouvert && createPortal(
        <div ref={panneau} role="dialog" aria-label="À faire" style={{
          position: 'fixed', right: place.right, top: place.top, width: 'min(360px, calc(100vw - 32px))', zIndex: 1000,
          background: 'var(--nd-surface)', border: '1px solid var(--nd-border)', borderRadius: 12,
          boxShadow: 'var(--nd-shadow-lg)', overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--nd-border)', fontWeight: 700 }}>
            À faire {total > 0 && <span className="nd-cell-sub" style={{ fontWeight: 500 }}>· {total}</span>}
          </div>
          {elements.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <CheckCircle2 size={32} color="var(--nd-green)" />
              <div className="nd-cell-sub" style={{ marginTop: 6 }}>Tout est à jour</div>
            </div>
          ) : (
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {elements.map(e => (
                <button key={e.code} type="button" onClick={() => { setOuvert(false); navigate(e.lien); }}
                  style={{
                    display: 'flex', width: '100%', gap: 10, alignItems: 'center', textAlign: 'left', padding: '10px 14px',
                    background: 'transparent', border: 0, borderBottom: '1px solid var(--nd-border)', cursor: 'pointer', color: 'var(--nd-text)',
                  }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, flex: '0 0 8px', background: COULEURS[e.gravite] }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{e.libelle}</span>
                    <span className="nd-cell-sub" style={{ color: COULEURS[e.gravite] }}>{LIBELLES[e.gravite]}</span>
                  </span>
                  <ChevronRight size={16} color="var(--nd-text-muted)" />
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
