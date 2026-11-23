import { useEffect, useState } from 'react';
import { FileBarChart, Download, Printer, RefreshCw } from 'lucide-react';
import { apiRapports } from '../services/api';
import { Spinner } from '../components/ui';
import { useToast } from '../context/AppContext';

/**
 * Rapports financiers d'une période : chiffre d'affaires, commissions, récompenses, litiges, marge estimée,
 * par service et par région ; exports CSV (Excel) et impression PDF. Les totaux sont ceux des écritures exportées.
 */

const fcfa = n => `${Number(n || 0).toLocaleString('fr-FR')} F`;
const SERVICES = { COURSE: 'Courses', LIVRAISON: 'Livraisons', RESERVATION: 'Covoiturage (réservations)', COLIS: 'Colis Allô Sénégal' };
const TYPES = {
  COMMISSION: 'Commissions', RECHARGE: 'Recharges / règlements', AJUSTEMENT: 'Ajustements', BONUS: 'Bonus des défis',
  REMISE_CLIENT: 'Crédits clients remboursés', ANNULATION_COMMISSION: 'Commissions rendues (litiges)', RETENUE: 'Retenues (litiges)',
  GAIN: 'Crédits émis', UTILISATION: 'Crédits utilisés', EXPIRATION: 'Crédits expirés',
};
const iso = d => d.toISOString().slice(0, 10);

export default function RapportsFinance() {
  const toast = useToast();
  const maintenant = new Date();
  const [debut, setDebut] = useState(iso(new Date(maintenant.getFullYear(), maintenant.getMonth(), 1, 12)));
  const [fin, setFin] = useState(iso(new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate(), 12)));
  const [r, setR] = useState(null);
  const [charge, setCharge] = useState(false);

  const charger = async () => {
    setCharge(true);
    try { setR(await apiRapports.rapport(debut, fin)); } catch (e) { toast(e.message, 'error'); }
    finally { setCharge(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const exporter = async quoi => {
    try {
      const url = await apiRapports.exporter(quoi, debut, fin);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quoi === 'credits' ? 'credits-clients' : 'ecritures-chauffeurs'}-${debut}-au-${fin}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { toast(e.message, 'error'); }
  };

  const tableau = (lignes, ventes, libelles = {}) => (
    <div className="nd-table-wrap"><table className="nd-table">
      <thead><tr><th>{ventes ? 'Service / région' : 'Type'}</th><th>Nombre</th>{ventes ? <><th>Chiffre d'affaires</th><th>Commission</th></> : <th>Total</th>}</tr></thead>
      <tbody>
        {(lignes || []).map(l => (
          <tr key={l.cle}><td>{libelles[l.cle] || l.cle}</td><td>{l.nombre}</td>
            {ventes ? <><td>{fcfa(l.chiffreAffaires)}</td><td><b>{fcfa(l.commission)}</b></td></> : <td>{fcfa(l.total)}</td>}</tr>
        ))}
        {(lignes || []).length === 0 && <tr><td colSpan={4} className="nd-cell-sub">Rien sur la période.</td></tr>}
      </tbody>
    </table></div>
  );

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Rapports financiers</h1>
          <p>Hors frais des opérateurs de paiement (connus quand les API Wave / Orange Money seront branchées).</p>
        </div>
      </div>

      <div className="nd-card" style={{ marginBottom: 16 }}>
        <div className="nd-card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="nd-form-group"><label>Du</label><input type="date" className="nd-input" value={debut} onChange={e => setDebut(e.target.value)} /></div>
          <div className="nd-form-group"><label>Au</label><input type="date" className="nd-input" value={fin} onChange={e => setFin(e.target.value)} /></div>
          <button className="nd-btn nd-btn-primary" disabled={charge} onClick={charger}><RefreshCw size={15} /> Afficher</button>
          <div style={{ flex: 1 }} />
          <button className="nd-btn nd-btn-outline" onClick={() => exporter('ecritures')}><Download size={15} /> CSV écritures chauffeurs</button>
          <button className="nd-btn nd-btn-outline" onClick={() => exporter('credits')}><Download size={15} /> CSV crédits clients</button>
          <button className="nd-btn nd-btn-ghost" onClick={() => window.print()}><Printer size={15} /> Imprimer / PDF</button>
        </div>
      </div>

      {!r ? <Spinner center /> : (
        <>
          <div className="nd-stat-grid">
            {[
              ['Chiffre d\'affaires (courses commissionnées)', r.chiffreAffaires],
              ['Commissions', r.commissions],
              ['Marge estimée', r.margeEstimee],
              ['Litiges ouverts sur la période', null, r.litiges],
            ].map(([l, v, n]) => (
              <div key={l} className="nd-card"><div className="nd-card-body">
                <div className="nd-cell-sub">{l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: l === 'Marge estimée' && v < 0 ? '#ef4444' : undefined }}>{v === null ? n : fcfa(v)}</div>
              </div></div>
            ))}
          </div>

          <div className="nd-card" style={{ marginBottom: 16 }}>
            <div className="nd-card-header"><h3><FileBarChart size={16} /> Calcul de la marge</h3></div>
            <div className="nd-card-body">
              <table className="nd-table"><tbody>
                <tr><td>Commissions</td><td style={{ textAlign: 'right' }}>{fcfa(r.commissions)}</td></tr>
                <tr><td>− Commissions rendues (litiges)</td><td style={{ textAlign: 'right' }}>{fcfa(r.commissionsRendues)}</td></tr>
                <tr><td>− Bonus des défis</td><td style={{ textAlign: 'right' }}>{fcfa(r.bonus)}</td></tr>
                <tr><td>− Crédits clients remboursés aux chauffeurs</td><td style={{ textAlign: 'right' }}>{fcfa(r.remisesClients)}</td></tr>
                <tr><td>− Remboursements externes (litiges)</td><td style={{ textAlign: 'right' }}>{fcfa(r.remboursementsExternes)}</td></tr>
                <tr><td>+ Retenues sur chauffeurs (litiges)</td><td style={{ textAlign: 'right' }}>{fcfa(r.retenues)}</td></tr>
                <tr><td><b>= Marge estimée</b></td><td style={{ textAlign: 'right' }}><b>{fcfa(r.margeEstimee)}</b></td></tr>
              </tbody></table>
              <small className="nd-cell-sub">Recharges confirmées : {fcfa(r.recharges)} · ajustements : {fcfa(r.ajustements)} · {r.nombreEcritures} écritures (total {fcfa(r.totalEcritures)}).</small>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
            <div className="nd-card"><div className="nd-card-header"><h3>Par service</h3></div>{tableau(r.parService, true, SERVICES)}</div>
            <div className="nd-card"><div className="nd-card-header"><h3>Par région</h3></div>{tableau(r.parRegion, true)}</div>
            <div className="nd-card"><div className="nd-card-header"><h3>Écritures des chauffeurs</h3></div>{tableau(r.parType, false, TYPES)}</div>
            <div className="nd-card"><div className="nd-card-header"><h3>Crédits des clients</h3></div>
              {tableau(r.creditsParType, false, TYPES)}
              <div className="nd-card-body nd-cell-sub" style={{ fontSize: 12 }}>
                Émis par enveloppe : {Object.entries(r.creditsEmisParEnveloppe || {}).map(([k, v]) => `${k.toLowerCase()} ${fcfa(v)}`).join(' · ') || '—'}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
