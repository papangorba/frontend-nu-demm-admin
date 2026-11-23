import { useEffect, useState } from 'react';
import { Scale, RefreshCw, Plus, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { apiLitiges, Audit, Auth, fmtDT } from '../services/api';
import { Spinner } from '../components/ui';
import { useToast } from '../context/AppContext';

/**
 * Litiges et remboursements. Le support ouvre un litige ; la finance (super-admin, admin) décide avec un motif ;
 * au-delà du seuil, un AUTRE super-administrateur approuve. Les effets (commission rendue, crédit ou
 * remboursement externe, retenue) sont des écritures compensatoires faites par le serveur.
 */

const fcfa = n => `${Number(n || 0).toLocaleString('fr-FR')} F`;
const SOURCES = { COURSE: 'Course', LIVRAISON: 'Livraison', RESERVATION: 'Réservation', COLIS: 'Envoi de colis' };
const CATEGORIES = { PRIX: 'Prix', COMPORTEMENT: 'Comportement', ANNULATION: 'Annulation', ACCIDENT: 'Accident', OBJET: 'Objet perdu', AUTRE: 'Autre' };
const STATUTS = {
  OUVERT: ['badge-warn', 'Ouvert'], A_APPROUVER: ['badge-info', 'À approuver'],
  ACCEPTE: ['badge-success', 'Accepté'], REFUSE: ['badge-secondary', 'Refusé'],
};
const VIDE = { source: 'COURSE', sourceId: '', categorie: 'PRIX', description: '', justificatif: '' };
const DECISION = { remboursement: '', mode: 'CREDIT', referenceExterne: '', ajusterCommission: true, retenueChauffeur: '', decision: '' };

export default function Litiges() {
  const toast = useToast();
  const role = Auth.role();
  const finance = ['SUPER_ADMIN', 'ADMIN'].includes(role);
  const [d, setD] = useState(null);
  const [filtre, setFiltre] = useState('EN_COURS');
  const [nouveau, setNouveau] = useState(null);
  const [decision, setDecision] = useState(null); // { id, ...DECISION }
  const [busy, setBusy] = useState(false);

  const charger = async () => {
    try { setD(await apiLitiges.liste()); } catch (e) { toast(e.message, 'error'); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const ouvrir = async () => {
    setBusy(true);
    try {
      const l = await apiLitiges.ouvrir(nouveau);
      Audit.log('LITIGE_OUVERT', `#${l.id} ${SOURCES[l.source]} #${l.sourceId}`);
      toast(`Litige #${l.id} ouvert`, 'success');
      setNouveau(null);
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const decider = async () => {
    setBusy(true);
    try {
      const { id, ...corps } = decision;
      const l = await apiLitiges.decider(id, corps);
      Audit.log('LITIGE_DECISION', `#${id} : ${corps.decision}`);
      toast(l.statut === 'A_APPROUVER' ? 'Au-delà du seuil : en attente d\'un super-administrateur' : 'Décision appliquée', 'success');
      setDecision(null);
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const approuver = async l => {
    if (!window.confirm(`Approuver le remboursement de ${fcfa(l.remboursement)} (litige #${l.id}) décidé par ${l.decidePar} ?`)) return;
    try {
      await apiLitiges.approuver(l.id);
      Audit.log('LITIGE_APPROUVE', `#${l.id}`);
      toast('Approuvé et appliqué', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
  };

  const refuser = async l => {
    const motif = window.prompt(`Refuser la réclamation #${l.id} ?\nMotif (envoyé au client) :`);
    if (motif === null) return;
    try {
      await apiLitiges.refuser(l.id, motif);
      Audit.log('LITIGE_REFUSE', `#${l.id} : ${motif}`);
      toast('Réclamation refusée : le client est prévenu', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
  };

  if (!d) return <Spinner center />;
  const liste = (d.litiges || []).filter(l => filtre === 'TOUS' || (filtre === 'EN_COURS' ? ['OUVERT', 'A_APPROUVER'].includes(l.statut) : ['ACCEPTE', 'REFUSE'].includes(l.statut)));
  const setN = (k, v) => setNouveau(n => ({ ...n, [k]: v }));
  const setD2 = (k, v) => setDecision(x => ({ ...x, [k]: v }));

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Litiges & remboursements</h1>
          <p>Le support ouvre la réclamation ; la finance décide avec un motif. Au-delà de {fcfa(d.seuil)}, un autre super-administrateur
            doit approuver. Rien n'est effacé : le serveur écrit des corrections.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="nd-btn nd-btn-primary" onClick={() => setNouveau({ ...VIDE })}><Plus size={15} /> Ouvrir un litige</button>
          <button className="nd-btn nd-btn-ghost" onClick={charger}><RefreshCw size={15} /></button>
        </div>
      </div>

      {nouveau && (
        <div className="nd-card" style={{ marginBottom: 16 }}>
          <div className="nd-card-header"><h3><Plus size={16} /> Nouveau litige</h3></div>
          <div className="nd-card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div className="nd-form-group"><label>Objet</label>
              <select className="nd-input nd-select" value={nouveau.source} onChange={e => setN('source', e.target.value)}>
                {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div className="nd-form-group"><label>Numéro</label>
              <input className="nd-input" value={nouveau.sourceId} onChange={e => setN('sourceId', e.target.value)} placeholder="ex. 1245" /></div>
            <div className="nd-form-group"><label>Catégorie</label>
              <select className="nd-input nd-select" value={nouveau.categorie} onChange={e => setN('categorie', e.target.value)}>
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div className="nd-form-group"><label>Justificatif (référence, capture, appel…)</label>
              <input className="nd-input" value={nouveau.justificatif} onChange={e => setN('justificatif', e.target.value)} /></div>
            <div className="nd-form-group" style={{ gridColumn: '1 / -1' }}><label>Description</label>
              <textarea className="nd-input" rows={3} value={nouveau.description} onChange={e => setN('description', e.target.value)} placeholder="Ce que dit le client, ce qui s'est passé…" /></div>
          </div>
          <div className="nd-card-body" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 0 }}>
            <button className="nd-btn nd-btn-ghost" onClick={() => setNouveau(null)}>Annuler</button>
            <button className="nd-btn nd-btn-primary" disabled={busy} onClick={ouvrir}>Ouvrir</button>
          </div>
        </div>
      )}

      {decision && (
        <div className="nd-card" style={{ marginBottom: 16, borderColor: 'var(--nd-primary)' }}>
          <div className="nd-card-header"><h3><Scale size={16} /> Décision · litige #{decision.id}</h3></div>
          <div className="nd-card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div className="nd-form-group"><label>Remboursement au client (F)</label>
              <input className="nd-input" value={decision.remboursement} onChange={e => setD2('remboursement', e.target.value)} placeholder="0 = aucun" /></div>
            <div className="nd-form-group"><label>Mode</label>
              <select className="nd-input nd-select" value={decision.mode} onChange={e => setD2('mode', e.target.value)}>
                <option value="CREDIT">Crédit Ñu Demm (réserve)</option>
                <option value="EXTERNE">Externe (Wave, Orange Money, espèces)</option>
              </select></div>
            {decision.mode === 'EXTERNE' && (
              <div className="nd-form-group"><label>Référence du remboursement</label>
                <input className="nd-input" value={decision.referenceExterne} onChange={e => setD2('referenceExterne', e.target.value)} /></div>
            )}
            <div className="nd-form-group"><label>Retenue sur le chauffeur (F)</label>
              <input className="nd-input" value={decision.retenueChauffeur} onChange={e => setD2('retenueChauffeur', e.target.value)} placeholder="0 = aucune" /></div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={decision.ajusterCommission} onChange={e => setD2('ajusterCommission', e.target.checked)} />
              Rendre la commission au chauffeur (à proportion du remboursement)
            </label>
            <div className="nd-form-group" style={{ gridColumn: '1 / -1' }}><label>Motif de la décision (obligatoire)</label>
              <textarea className="nd-input" rows={2} value={decision.decision} onChange={e => setD2('decision', e.target.value)} /></div>
          </div>
          <div className="nd-card-body" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 0 }}>
            <button className="nd-btn nd-btn-ghost" onClick={() => setDecision(null)}>Annuler</button>
            <button className="nd-btn nd-btn-primary" disabled={busy} onClick={decider}><CheckCircle2 size={15} /> Appliquer</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[['EN_COURS', 'En cours'], ['CLOS', 'Clos'], ['TOUS', 'Tous']].map(([k, l]) => (
          <button key={k} className={`nd-btn nd-btn-sm ${filtre === k ? 'nd-btn-primary' : 'nd-btn-outline'}`} onClick={() => setFiltre(k)}>{l}</button>
        ))}
      </div>

      <div className="nd-card">
        {liste.length === 0 ? <div className="nd-card-body nd-cell-sub">Aucun litige dans cette rubrique.</div> : (
          <div className="nd-table-wrap"><table className="nd-table">
            <thead><tr><th>Litige</th><th>Objet</th><th>Réclamation</th><th>Décision</th><th>Statut</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {liste.map(l => {
                const [cls, label] = STATUTS[l.statut] || ['badge-secondary', l.statut];
                return (
                  <tr key={l.id}>
                    <td><b>#{l.id}</b><div className="nd-cell-sub">{fmtDT(l.creeLe)}</div><div className="nd-cell-sub">par {l.ouvertPar}</div></td>
                    <td>{SOURCES[l.source]} #{l.sourceId}<div className="nd-cell-sub">{fcfa(l.prix)} · client {l.clientId ?? '—'} · chauffeur {l.chauffeurId ?? '—'}</div></td>
                    <td style={{ maxWidth: 280 }}><b>{CATEGORIES[l.categorie]}</b> · {l.description}
                      {l.justificatif && <div className="nd-cell-sub">Justificatif : {l.justificatif}</div>}</td>
                    <td style={{ maxWidth: 260 }}>
                      {l.decision && <div>{l.decision}</div>}
                      {l.remboursement > 0 && <div className="nd-cell-sub">Remboursé {fcfa(l.remboursement)} ({l.modeRemboursement === 'CREDIT' ? 'crédit' : `externe, réf. ${l.referenceExterne}`})</div>}
                      {l.commissionAnnulee > 0 && <div className="nd-cell-sub">Commission rendue {fcfa(l.commissionAnnulee)}</div>}
                      {l.retenueChauffeur > 0 && <div className="nd-cell-sub">Retenue {fcfa(l.retenueChauffeur)}</div>}
                      {l.decidePar && <div className="nd-cell-sub">par {l.decidePar}{l.approuvePar ? `, approuvé par ${l.approuvePar}` : ''}</div>}
                    </td>
                    <td><span className={`nd-badge ${cls}`}>{label}</span></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {l.statut === 'OUVERT' && finance && <>
                        <button className="nd-btn nd-btn-primary nd-btn-sm" onClick={() => setDecision({ id: l.id, ...DECISION })}><Scale size={14} /> Décider</button>{' '}
                        <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={() => refuser(l)}><XCircle size={14} /> Refuser</button>
                      </>}
                      {l.statut === 'A_APPROUVER' && role === 'SUPER_ADMIN' && <>
                        <button className="nd-btn nd-btn-primary nd-btn-sm" onClick={() => approuver(l)}><ShieldCheck size={14} /> Approuver</button>{' '}
                        <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={() => refuser(l)}><XCircle size={14} /> Refuser</button>
                      </>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
