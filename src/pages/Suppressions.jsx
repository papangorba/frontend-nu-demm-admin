import { useEffect, useState } from 'react';
import { UserX, Phone, CheckCircle2, XCircle, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { apiSuppressions, Audit, fmtDT, getBaseUrl } from '../services/api';
import { Spinner } from '../components/ui';
import { useToast } from '../context/AppContext';

/**
 * Demandes de suppression de compte envoyées depuis la page web publique /supprimer-compte
 * (exigée par Google Play). La connexion aux apps se fait avec le seul numéro : avant de supprimer,
 * appelez le numéro pour vérifier que la demande vient bien du titulaire du compte.
 * (Depuis les apps, la suppression est immédiate et n'apparaît pas ici.)
 */

const STATUTS = {
  EN_ATTENTE: ['badge-warn',      'À traiter'],
  TRAITEE:    ['badge-success',   'Traitée'],
  REJETEE:    ['badge-secondary', 'Rejetée'],
};
const APPS = { CLIENT: 'Ñu Demm (client)', CHAUFFEUR: 'Ñu Demm Pro (chauffeur)' };

const joli = t => (t || '').replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');

export default function Suppressions() {
  const toast = useToast();
  const [demandes, setDemandes] = useState(null);
  const [filtre, setFiltre] = useState('EN_ATTENTE');
  const [busy, setBusy] = useState(null);

  const charger = async () => {
    try { setDemandes(await apiSuppressions.liste() || []); }
    catch (e) { toast(e.message, 'error'); setDemandes(d => d || []); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const supprimer = async d => {
    const qui = d.compteTrouve ? `le compte de ${d.nom}` : 'cette demande (aucun compte trouvé)';
    if (!window.confirm(`Avez-vous appelé le ${joli(d.telephone)} pour confirmer ?\n\nSupprimer ${qui} ? C'est définitif.`)) return;
    setBusy(d.id);
    try {
      const r = await apiSuppressions.traiter(d.id);
      Audit.log('COMPTE_SUPPRIME', `Demande #${d.id} — ${d.telephone}${d.nom ? ' (' + d.nom + ')' : ''}`);
      toast(r?.message || 'Demande traitée', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  const rejeter = async d => {
    const note = window.prompt('Motif du rejet (ex. numéro injoignable, demande non confirmée) :', 'Demande non confirmée');
    if (note === null) return;
    setBusy(d.id);
    try {
      await apiSuppressions.rejeter(d.id, note);
      Audit.log('SUPPRESSION_REJETEE', `Demande #${d.id} — ${d.telephone}`);
      toast('Demande rejetée', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  const liste = (demandes || []).filter(d => filtre === 'TOUTES' || d.statut === filtre);
  const enAttente = (demandes || []).filter(d => d.statut === 'EN_ATTENTE').length;

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Suppressions de compte</h1>
          <p>Demandes reçues sur la page web <a href={`${getBaseUrl()}/supprimer-compte`} target="_blank" rel="noreferrer">/supprimer-compte <ExternalLink size={12} /></a>.
            Appelez toujours le numéro avant de supprimer : la connexion aux apps se fait sans mot de passe.
            Les suppressions faites depuis les apps sont immédiates et n'apparaissent pas ici.</p>
        </div>
        <button className="nd-btn nd-btn-ghost" onClick={charger}><RefreshCw size={15} /> Actualiser</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['EN_ATTENTE', `À traiter${enAttente ? ` (${enAttente})` : ''}`], ['TOUTES', 'Historique']].map(([k, l]) => (
          <button key={k} className={`nd-btn nd-btn-sm ${filtre === k ? 'nd-btn-primary' : 'nd-btn-outline'}`} onClick={() => setFiltre(k)}>{l}</button>
        ))}
      </div>

      {demandes === null ? <Spinner center /> : liste.length === 0 ? (
        <div className="nd-card"><div className="nd-card-body" style={{ textAlign: 'center', padding: 40 }}>
          <CheckCircle2 size={40} color="var(--nd-green)" />
          <p className="nd-cell-sub">{filtre === 'EN_ATTENTE' ? 'Aucune demande à traiter' : 'Aucune demande pour le moment'}</p>
        </div></div>
      ) : (
        <div className="nd-card"><div className="nd-table-wrap">
          <table className="nd-table">
            <thead><tr>
              <th>Demande</th><th>Téléphone</th><th>Compte</th><th>Motif</th><th>Statut</th><th style={{ textAlign: 'right' }}>Actions</th>
            </tr></thead>
            <tbody>
              {liste.map(d => {
                const [cls, label] = STATUTS[d.statut] || ['badge-secondary', d.statut];
                return (
                  <tr key={d.id}>
                    <td><b>#{d.id}</b><div className="nd-cell-sub">{fmtDT(d.creeLe)}</div><div className="nd-cell-sub">{APPS[d.application] || d.application}</div></td>
                    <td><a href={`tel:+221${d.telephone}`} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Phone size={13} />{joli(d.telephone)}</a></td>
                    <td>
                      {d.compteTrouve ? <>
                        <b>{d.nom}</b>
                        <div className="nd-cell-sub">{d.role === 'CHAUFFEUR' ? 'Chauffeur' : 'Client'} · inscrit le {fmtDT(d.dateInscription)}</div>
                        {d.empechement && <div className="nd-cell-sub" style={{ color: 'var(--nd-orange, #c77700)', display: 'flex', gap: 4, alignItems: 'center' }}>
                          <AlertTriangle size={13} /> {d.empechement}</div>}
                      </> : <span className="nd-cell-sub">{d.statut === 'EN_ATTENTE' ? 'Aucun compte avec ce numéro' : '—'}</span>}
                    </td>
                    <td style={{ maxWidth: 260 }}>{d.motif || <span className="nd-cell-sub">—</span>}</td>
                    <td><span className={`nd-badge ${cls}`}>{label}</span>
                      {d.traiteLe && <div className="nd-cell-sub">{fmtDT(d.traiteLe)}</div>}
                      {d.note && <div className="nd-cell-sub">{d.note}</div>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {d.statut === 'EN_ATTENTE' && <>
                        <button className="nd-btn nd-btn-danger nd-btn-sm" disabled={busy === d.id || !!d.empechement} onClick={() => supprimer(d)}
                          title={d.empechement || ''}>
                          <UserX size={14} /> {d.compteTrouve ? 'Supprimer le compte' : 'Clore'}
                        </button>{' '}
                        <button className="nd-btn nd-btn-outline nd-btn-sm" disabled={busy === d.id} onClick={() => rejeter(d)}>
                          <XCircle size={14} /> Rejeter
                        </button>
                      </>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div></div>
      )}
    </div>
  );
}
