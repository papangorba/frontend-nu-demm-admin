import { useEffect, useState } from 'react';
import { CreditCard, RefreshCw, Send, CheckCircle2 } from 'lucide-react';
import { apiPaiements, apiControle, Auth, fmtDT, money } from '../services/api';
import { useToast } from '../context/AppContext';

/**
 * Paiements Wave / Orange Money faits dans les apps : interrupteurs, liste, versements aux chauffeurs.
 * L'argent est encaissé puis reversé aussitôt au chauffeur (payout) ; les acomptes des trajets d'entreprise
 * et les remboursements se font à la main (référence obligatoire).
 */
const STATUTS = {
  PAYE: ['Payé', 'badge-success'], EN_ATTENTE: ['En attente', 'badge-warning'], CREE: ['En attente', 'badge-warning'],
  ECHEC: ['Échec', 'badge-danger'], EXPIRE: ['Abandonné', 'badge-secondary'],
};
const VERSEMENTS = {
  VERSE: ['Versé', 'badge-success'], EN_ATTENTE: ['À verser', 'badge-warning'], EN_COURS: ['En cours', 'badge-warning'],
  ECHEC: ['Échec du versement', 'badge-danger'], A_FAIRE: ['À verser à la main', 'badge-warning'],
  A_REMBOURSER: ['À rembourser', 'badge-danger'], REMBOURSE: ['Remboursé', 'badge-success'], AUCUN: ['—', 'badge-secondary'],
};
const OBJETS = { COURSE: 'Course', LIVRAISON: 'Livraison', RESERVATION: 'Acompte', COLIS: 'Colis', ABONNEMENT: 'Abonnement' };

export default function PaiementsEnLigne() {
  const toast = useToast();
  const [d, setD] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState('');
  const argent = Auth.argent();
  const regles = Auth.regles();

  const charger = () => Promise.all([apiPaiements.liste(), apiControle.config()])
    .then(([p, c]) => { setD(p); setCfg(c); })
    .catch(e => toast(e.message, 'error'));
  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const basculer = async (cle, v) => {
    if (cle === 'PAIEMENT_EN_LIGNE' && v && !window.confirm(
      "Ouvrir le paiement Wave / Orange Money dans les apps ?\nÀ faire seulement quand les clés des fournisseurs sont dans Render et testées.")) return;
    setBusy(cle);
    try { await apiControle.modifierConfig({ [cle]: String(v) }); await charger(); toast('Réglage enregistré', 'success'); }
    catch (e) { toast(e.message, 'error'); }
    setBusy('');
  };

  const verser = async ref => {
    setBusy(ref);
    try { const p = await apiPaiements.verser(ref); toast(p.versementStatut === 'VERSE' ? 'Versé au chauffeur' : `Versement : ${p.versementErreur || p.versementStatut}`, p.versementStatut === 'VERSE' ? 'success' : 'error'); await charger(); }
    catch (e) { toast(e.message, 'error'); }
    setBusy('');
  };

  const marquer = async p => {
    const reference = window.prompt(`${p.versementStatut === 'A_REMBOURSER' ? 'Remboursement' : 'Versement'} de ${money(p.montant)} fait à la main.\nRéférence de la transaction Wave / Orange Money :`);
    if (!reference) return;
    setBusy(p.reference);
    try { await apiPaiements.marquerVerse(p.reference, reference); toast('Enregistré', 'success'); await charger(); }
    catch (e) { toast(e.message, 'error'); }
    setBusy('');
  };

  if (!d || !cfg) return null;
  const actif = cfg.PAIEMENT_EN_LIGNE === 'true';
  const m = d.moyens || {};
  const liste = d.paiements || [];

  return (
    <div className="nd-card" style={{ marginBottom: 16 }}>
      <div className="nd-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h3><CreditCard size={16} /> Paiements en ligne (Wave / Orange Money)</h3>
        <button className="nd-btn nd-btn-ghost nd-btn-sm" onClick={charger}><RefreshCw size={14} /> Actualiser</button>
      </div>
      <div className="nd-card-body">
        <p className="nd-cell-sub" style={{ marginTop: 0 }}>
          Le client paie dans l'app ; l'argent est reversé aussitôt au chauffeur sur son numéro. La commission reste prélevée sur son solde, comme pour les espèces.
          {m.simulation && <b> Serveur en simulation : aucun argent réel.</b>}
          {!m.simulation && (m.moyens || []).length === 0 && actif && <b> Aucun fournisseur prêt : ajoutez les clés Wave / Orange Money dans Render.</b>}
        </p>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 12 }}>
          {[['PAIEMENT_EN_LIGNE', 'Paiement en ligne'], ['PAIEMENT_WAVE', 'Wave'], ['PAIEMENT_ORANGE_MONEY', 'Orange Money']].map(([cle, nom]) => (
            <label key={cle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={cfg[cle] === 'true'} disabled={!regles || busy === cle}
                onChange={e => basculer(cle, e.target.checked)} />
              {nom}
            </label>
          ))}
          <span className="nd-cell-sub">Proposés aux clients : {(m.moyens || []).map(x => x === 'WAVE' ? 'Wave' : 'Orange Money').join(', ') || 'aucun'}</span>
        </div>
        {liste.length === 0 ? <p className="nd-cell-sub">Aucun paiement en ligne pour le moment.</p> : (
          <div className="nd-table-wrap"><table className="nd-table">
            <thead><tr><th>Date</th><th>Objet</th><th>Montant</th><th>Moyen</th><th>Statut</th><th>Versement</th><th></th></tr></thead>
            <tbody>{liste.map(p => {
              const [st, stc] = STATUTS[p.statut] || [p.statut, 'badge-secondary'];
              const [ve, vec] = VERSEMENTS[p.versementStatut] || [p.versementStatut, 'badge-secondary'];
              return (
                <tr key={p.reference}>
                  <td><small>{fmtDT(p.creeLe)}</small><div className="nd-cell-sub">{p.reference}{p.simulation ? ' · simulation' : ''}</div></td>
                  <td>{OBJETS[p.objet] || p.objet} #{p.objetId}{p.mois ? ` · ${p.mois} mois` : ''}</td>
                  <td><b>{money(p.montant)}</b></td>
                  <td>{p.moyen === 'WAVE' ? 'Wave' : 'Orange Money'}</td>
                  <td><span className={`nd-badge ${stc}`}>{st}</span></td>
                  <td><span className={`nd-badge ${vec}`}>{ve}</span>
                    {p.versementErreur && <div className="nd-cell-sub">{p.versementErreur}</div>}
                    {p.versementReference && <div className="nd-cell-sub">Réf. {p.versementReference}</div>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {argent && p.statut === 'PAYE' && p.versementStatut === 'ECHEC' && p.beneficiaireId && (
                      <button className="nd-btn nd-btn-outline nd-btn-sm" disabled={busy === p.reference} onClick={() => verser(p.reference)}>
                        <Send size={13} /> Réessayer
                      </button>)}
                    {argent && ['A_FAIRE', 'A_REMBOURSER', 'ECHEC'].includes(p.versementStatut) && (
                      <button className="nd-btn nd-btn-ghost nd-btn-sm" disabled={busy === p.reference} onClick={() => marquer(p)}>
                        <CheckCircle2 size={13} /> Fait à la main
                      </button>)}
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
