import { useEffect, useRef, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { apiMonEntreprise, money } from '../services/api';

/**
 * Le gérant paie son abonnement par Wave / Orange Money (encaissé par Ñu Demm).
 * Le lien du fournisseur s'ouvre dans un nouvel onglet ; la page relit le statut jusqu'à la confirmation du serveur.
 */
export default function PayerAbonnement({ prixMensuel, onPaye }) {
  const [moyens, setMoyens] = useState(null);
  const [mois, setMois] = useState(1);
  const [moyen, setMoyen] = useState('');
  const [etat, setEtat] = useState(''); // '' | attente | paye | erreur
  const [msg, setMsg] = useState('');
  const suivi = useRef(null);

  useEffect(() => {
    apiMonEntreprise.moyensPaiement().then(m => {
      const l = m.actif ? m.moyens : [];
      setMoyens({ liste: l, simulation: m.simulation });
      if (l.length) setMoyen(l[0]);
    }).catch(() => setMoyens({ liste: [] }));
    return () => clearInterval(suivi.current);
  }, []);

  if (!moyens || moyens.liste.length === 0) return null;

  const payer = async () => {
    setMsg(''); setEtat('attente');
    try {
      const p = await apiMonEntreprise.payerAbonnement(mois, moyen);
      if (p.lien) window.open(p.lien, '_blank', 'noopener');
      let n = 0;
      clearInterval(suivi.current);
      suivi.current = setInterval(async () => {
        if (++n > 200) { clearInterval(suivi.current); return; }
        try {
          const s = await apiMonEntreprise.statutPaiement(p.reference);
          if (s.statut === 'PAYE') { clearInterval(suivi.current); setEtat('paye'); onPaye && onPaye(); }
          else if (s.statut === 'ECHEC' || s.statut === 'EXPIRE') { clearInterval(suivi.current); setEtat('erreur'); setMsg("Le paiement n'a pas abouti."); }
        } catch { /* réseau : prochain tour */ }
      }, 3000);
    } catch (e) { setEtat('erreur'); setMsg(e.message); }
  };

  return (
    <div className="nd-card" style={{ marginTop: 16 }}><div className="nd-card-body">
      <h3 className="ee-h3"><CreditCard size={16} /> Payer mon abonnement en ligne</h3>
      {etat === 'paye' ? (
        <p style={{ color: '#15803D', fontWeight: 700 }}>✓ Paiement reçu : votre abonnement est prolongé de {mois} mois.</p>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="nd-input nd-select" style={{ width: 'auto' }} value={mois} onChange={e => setMois(Number(e.target.value))}>
            {[1, 2, 3, 6, 12].map(m => <option key={m} value={m}>{m} mois{prixMensuel ? ` · ${money(prixMensuel * m)}` : ''}</option>)}
          </select>
          {moyens.liste.length > 1 && (
            <select className="nd-input nd-select" style={{ width: 'auto' }} value={moyen} onChange={e => setMoyen(e.target.value)}>
              {moyens.liste.map(m => <option key={m} value={m}>{m === 'WAVE' ? 'Wave' : 'Orange Money'}</option>)}
            </select>
          )}
          <button className="nd-btn nd-btn-primary" disabled={etat === 'attente'} onClick={payer}>
            {etat === 'attente' ? 'En attente de la confirmation…' : `Payer par ${moyen === 'WAVE' ? 'Wave' : 'Orange Money'}`}
          </button>
        </div>
      )}
      {moyens.simulation && <p className="nd-cell-sub">Mode démonstration : aucun argent réel.</p>}
      {msg && <p style={{ color: 'var(--nd-red)' }}>{msg}</p>}
    </div></div>
  );
}
