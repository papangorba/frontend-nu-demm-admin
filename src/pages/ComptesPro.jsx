import { useEffect, useState } from 'react';
import { Store, CheckCircle2, XCircle, FileText, Printer, RefreshCw } from 'lucide-react';
import { apiComptesPro, Audit, fmtDT } from '../services/api';
import { Spinner, Modal } from '../components/ui';
import { useToast } from '../context/AppContext';

/**
 * Clients professionnels (boutiques, restaurants, entreprises) : demandes à valider,
 * puis relevé mensuel des livraisons payées par facture (imprimable).
 */
const STATUTS = {
  DEMANDE: ['badge-warn', 'À valider'],
  VALIDE: ['badge-success', 'Actif'],
  REFUSE: ['badge-secondary', 'Refusé'],
};
const SERVICES = { LIVRAISON: '📦 Livraison', CARGO: '🚚 Cargo' };
const MODES = { ESPECE: 'Espèces', WAVE: 'Wave', ORANGE_MONEY: 'Orange Money', FACTURE: 'Facture' };
const f = n => `${Number(n || 0).toLocaleString('fr-FR')} F`;
const moisCourant = () => new Date().toISOString().slice(0, 7);

export default function ComptesPro() {
  const toast = useToast();
  const [liste, setListe] = useState(null);
  const [releve, setReleve] = useState(null);
  const [mois, setMois] = useState(moisCourant());
  const [client, setClient] = useState(null);

  const charger = async () => {
    try { setListe(await apiComptesPro.liste() || []); }
    catch (e) { toast(e.message, 'error'); setListe(l => l || []); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const decider = async (c, statut) => {
    if (statut === 'REFUSE' && !window.confirm(`Refuser le compte professionnel de ${c.entreprise} ?`)) return;
    try {
      await apiComptesPro.decider(c.userId, statut);
      Audit.log('COMPTE_PRO', `${c.entreprise} : ${statut}`);
      toast(statut === 'VALIDE' ? 'Compte professionnel activé' : 'Demande refusée', 'success');
      charger();
    } catch (e) { toast(e.message, 'error'); }
  };

  const ouvrirReleve = async (c, m = mois) => {
    setClient(c);
    setReleve(null);
    try { setReleve(await apiComptesPro.releve(c.userId, m)); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Clients professionnels</h1>
          <p>Boutiques, restaurants et entreprises : livraisons payées par facture mensuelle. Validez les demandes et imprimez les relevés.</p>
        </div>
        <button className="nd-btn nd-btn-ghost" onClick={charger}><RefreshCw size={15} /> Actualiser</button>
      </div>

      {liste === null ? <Spinner center /> : !liste.length ? (
        <div className="nd-card"><div className="nd-card-body" style={{ textAlign: 'center', padding: 40 }}>
          <Store size={40} /><p className="nd-cell-sub">Aucune demande pour le moment</p>
        </div></div>
      ) : (
        <div className="nd-card"><div className="nd-table-wrap">
          <table className="nd-table">
            <thead><tr><th>Entreprise</th><th>Contact</th><th>Statut</th><th>Ce mois</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {liste.map(c => {
                const [cls, lib] = STATUTS[c.statut] || ['badge-secondary', c.statut];
                return (
                  <tr key={c.userId}>
                    <td><b>{c.entreprise}</b>
                      {c.ninea && <div className="nd-cell-sub">NINEA {c.ninea}</div>}
                      {c.adresse && <div className="nd-cell-sub">{c.adresse}</div>}
                    </td>
                    <td>{c.nom}<div className="nd-cell-sub">{c.telephone}</div><div className="nd-cell-sub">Demande du {fmtDT(c.demandeLe)}</div></td>
                    <td><span className={`nd-badge ${cls}`}>{lib}</span></td>
                    <td>{c.livraisonsDuMois} livraison(s)<div className="nd-cell-sub">{f(c.totalDuMois)} livrées</div></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {c.statut === 'DEMANDE' && <>
                        <button className="nd-btn nd-btn-primary nd-btn-sm" onClick={() => decider(c, 'VALIDE')}><CheckCircle2 size={14} /> Valider</button>{' '}
                        <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={() => decider(c, 'REFUSE')}><XCircle size={14} /> Refuser</button>{' '}
                      </>}
                      {c.statut === 'VALIDE' && (
                        <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={() => decider(c, 'REFUSE')}>Suspendre</button>
                      )}{' '}
                      <button className="nd-btn nd-btn-ghost nd-btn-sm" onClick={() => ouvrirReleve(c)}><FileText size={14} /> Relevé</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div></div>
      )}

      <Modal wide open={!!client} title={`Relevé — ${client?.entreprise || ''}`} onClose={() => setClient(null)}>
        <div className="cp-releve">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }} className="cp-pas-imprime">
            <input type="month" className="nd-input" style={{ maxWidth: 180 }} value={mois}
              onChange={e => { setMois(e.target.value); if (client) ouvrirReleve(client, e.target.value); }} />
            <button className="nd-btn nd-btn-primary nd-btn-sm" onClick={() => window.print()}><Printer size={14} /> Imprimer</button>
          </div>
          {!releve ? <Spinner center /> : <>
            <h3 style={{ margin: '4px 0' }}>Ñu Demm · relevé de {releve.mois}</h3>
            <p className="nd-cell-sub" style={{ margin: 0 }}>
              {releve.client.entreprise}{releve.client.ninea ? ` · NINEA ${releve.client.ninea}` : ''} · {releve.client.telephone}
            </p>
            <table className="nd-table" style={{ marginTop: 10 }}>
              <thead><tr><th>Date</th><th>Service</th><th>Trajet</th><th>Statut</th><th>Paiement</th><th style={{ textAlign: 'right' }}>Prix</th></tr></thead>
              <tbody>
                {releve.lignes.map(l => (
                  <tr key={l.id}>
                    <td>{fmtDT(l.date)}<div className="nd-cell-sub">#{l.id}</div></td>
                    <td>{SERVICES[l.service] || l.service}</td>
                    <td><small>{l.depart} → {l.destination}{l.destinataire ? ` (${l.destinataire})` : ''}</small></td>
                    <td><small>{l.statut}</small></td>
                    <td><small>{MODES[l.modePaiement] || l.modePaiement}</small></td>
                    <td style={{ textAlign: 'right' }}>{f(l.prix)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: 'right', marginTop: 10 }}>
              <div className="nd-cell-sub">{releve.nombreLivrees} livraison(s) livrée(s) · déjà payé à la course : {f(releve.dejaPaye)}</div>
              <b style={{ fontSize: 18 }}>Total à facturer : {f(releve.totalAFacturer)}</b>
            </div>
          </>}
        </div>
      </Modal>
    </div>
  );
}
