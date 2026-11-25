import { useEffect, useState } from 'react';
import { CreditCard, RefreshCw, Send, CheckCircle2 } from 'lucide-react';
import { apiPaiements, apiControle, Auth, fmtDT, money } from '../services/api';
import { useToast } from '../context/AppContext';

/**
 * Paiements Wave / Orange Money faits dans les apps : interrupteurs, liste, versements aux chauffeurs.
 * L'argent est encaissé par PayTech sur le compte Ñu Demm, puis crédité sur le solde du chauffeur (modèle Yango) ;
 * et les remboursements se font à la main (référence obligatoire).
 */
const STATUTS = {
  PAYE: ['Payé', 'badge-success'], EN_ATTENTE: ['En attente', 'badge-warning'], CREE: ['En attente', 'badge-warning'],
  ECHEC: ['Échec', 'badge-danger'], EXPIRE: ['Abandonné', 'badge-secondary'],
};
const VERSEMENTS = {
  VERSE: ['Versé', 'badge-success'], EN_ATTENTE: ['À verser', 'badge-warning'], EN_COURS: ['En cours', 'badge-warning'],
  APRES_TRAJET: ['Après le trajet', 'badge-secondary'],
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

  /** Remboursement lancé chez PayTech (paiement entier) ; confirmé automatiquement à la fin */
  const rembourserPaytech = async p => {
    if (!window.confirm(`Rembourser ${money(p.montantRembourse)} au client par PayTech ?`)) return;
    setBusy(p.reference);
    try { await apiPaiements.rembourserPaytech(p.reference); toast('Remboursement lancé chez PayTech', 'success'); await charger(); }
    catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  const rembourser = async p => {
    const reference = window.prompt(`Remboursement de ${money(p.montantRembourse)} au client fait par ${p.moyen === 'WAVE' ? 'Wave' : 'Orange Money'}.\nRéférence de la transaction :`);
    if (!reference) return;
    setBusy(p.reference);
    try { await apiPaiements.marquerRembourse(p.reference, reference); toast('Remboursement enregistré', 'success'); await charger(); }
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

  const enregistrerTesteurs = async () => {
    const v = window.prompt('Numéros testeurs (9 chiffres, séparés par des virgules) :', cfg.MODE_TEST_TELEPHONES || '');
    if (v === null) return;
    setBusy('MODE_TEST_TELEPHONES');
    try { await apiControle.modifierConfig({ MODE_TEST_TELEPHONES: v }); await charger(); toast('Testeurs enregistrés', 'success'); }
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
          Le client paie dans l'app (PayTech) ; l'argent est crédité sur le solde Ñu Demm du chauffeur, qui le retire quand il veut. La commission est retirée de son solde, comme pour les espèces.
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
        {/* Réservations de trajets quand le paiement en ligne de l'acompte n'est pas possible */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <b>Réservation sans paiement en ligne :</b>
          {[['SANS_ACOMPTE', 'Accepter sans acompte (tout payé au chauffeur)'], ['REFUS', 'Refuser la réservation']].map(([v, l]) => (
            <button key={v} type="button" disabled={!regles || busy === 'RESERVATION_SANS_PAIEMENT'}
              className={`nd-btn nd-btn-sm ${(cfg.RESERVATION_SANS_PAIEMENT || 'SANS_ACOMPTE') === v ? 'nd-btn-primary' : 'nd-btn-outline'}`}
              onClick={() => basculer('RESERVATION_SANS_PAIEMENT', v)}>{l}</button>
          ))}
          <small className="nd-cell-sub">Un acompte jamais payé (échec, annulation) libère la place aussitôt.</small>
        </div>
        {/* Mode test : tout le parcours (paiement simulé, commissions, solde, recharges) pour quelques numéros seulement */}
        <div style={{ background: '#FFF4E5', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
            <input type="checkbox" checked={cfg.MODE_TEST_ACTIF === 'true'} disabled={!regles || busy === 'MODE_TEST_ACTIF'}
              onChange={e => basculer('MODE_TEST_ACTIF', e.target.checked)} />
            🧪 Mode test (paiement simulé, pour les numéros testeurs)
          </label>
          <p className="nd-cell-sub" style={{ margin: '6px 0' }}>
            Pour les numéros testeurs seulement : paiement simulé (aucun argent réel), commissions prélevées, Mon solde et recharges ouverts,
            dans toutes les régions. Les autres clients et chauffeurs ne voient aucun changement. Pour une entreprise, mettez le numéro de l'entreprise.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Testeurs : <b>{cfg.MODE_TEST_TELEPHONES || 'aucun'}</b></span>
            {regles && <button className="nd-btn nd-btn-outline nd-btn-sm" disabled={busy === 'MODE_TEST_TELEPHONES'} onClick={enregistrerTesteurs}>Modifier</button>}
          </div>
        </div>
        {liste.length === 0 ? <p className="nd-cell-sub">Aucun paiement en ligne pour le moment.</p> : (
          <div className="nd-table-wrap"><table className="nd-table">
            <thead><tr><th>Date</th><th>Objet</th><th>Montant</th><th>Moyen</th><th>Statut</th><th>Versement</th><th>Remboursement</th><th></th></tr></thead>
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
                    {p.versementReference && <div className="nd-cell-sub">{p.versementReference === 'SOLDE' ? 'Crédité sur le solde du chauffeur' : `Réf. ${p.versementReference}`}</div>}
                    {p.montantVerse != null && p.montantVerse !== p.montant && <div className="nd-cell-sub">Part chauffeur : {money(p.montantVerse)}</div>}</td>
                  <td>{p.montantRembourse > 0 ? (
                    <><span className={`nd-badge ${p.remboursementStatut === 'FAIT' ? 'badge-success' : p.remboursementStatut === 'EN_COURS' ? 'badge-warning' : 'badge-danger'}`}>
                      {p.remboursementStatut === 'FAIT' ? 'Remboursé' : p.remboursementStatut === 'EN_COURS' ? 'Remboursement en cours (PayTech)' : 'À rembourser'} {money(p.montantRembourse)}</span>
                      {p.remboursementReference && <div className="nd-cell-sub">Réf. {p.remboursementReference}</div>}</>
                  ) : <span className="nd-cell-sub">—</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {argent && p.statut === 'PAYE' && p.versementStatut === 'ECHEC' && p.beneficiaireId && (
                      <button className="nd-btn nd-btn-outline nd-btn-sm" disabled={busy === p.reference} onClick={() => verser(p.reference)}>
                        <Send size={13} /> Réessayer
                      </button>)}
                    {argent && p.remboursementStatut === 'A_FAIRE' && p.montantRembourse === p.montant && (
                      <><button className="nd-btn nd-btn-primary nd-btn-sm" disabled={busy === p.reference} onClick={() => rembourserPaytech(p)}>
                        Rembourser par PayTech
                      </button>{' '}</>
                    )}
                    {argent && p.remboursementStatut === 'A_FAIRE' && (
                      <button className="nd-btn nd-btn-outline nd-btn-sm" disabled={busy === p.reference} onClick={() => rembourser(p)}>
                        <CheckCircle2 size={13} /> Remboursé
                      </button>)}
                    {argent && ['A_FAIRE', 'ECHEC'].includes(p.versementStatut) && (
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
