import { useEffect, useMemo, useState } from 'react';
import { Wallet, RefreshCw, CheckCircle2, XCircle, Phone, Save, Scale, History, AlertTriangle } from 'lucide-react';
import { apiFinances, apiRegions, Audit, Auth, fmtDT } from '../services/api';
import { Spinner } from '../components/ui';
import { useToast } from '../context/AppContext';

/**
 * Modèle économique — phase pilote.
 * Réglages (mode prépayé / dette, commission, régions pilotes, seuils, numéros marchands),
 * recharges déclarées par les chauffeurs à confirmer, soldes, ajustements et journal d'audit.
 * Toute action sur l'argent : super-admin ou admin, motif obligatoire, tracée côté serveur.
 */

const fcfa = n => `${Number(n || 0).toLocaleString('fr-FR')} F`;
const joli = t => (t || '').replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');
const MOYENS = { WAVE: 'Wave', ORANGE_MONEY: 'Orange Money', ESPECES: 'Espèces (agence)' };
const ACTIONS = { REGLAGES: 'Réglages', RECHARGE_CONFIRMEE: 'Recharge confirmée', RECHARGE_REFUSEE: 'Recharge refusée', AJUSTEMENT: 'Ajustement' };
const TYPES = { COMMISSION: 'Commissions', RECHARGE: 'Recharges / règlements', AJUSTEMENT: 'Ajustements' };

function Interrupteur({ actif, onChange }) {
  return (
    <button type="button" className={`cp-switch${actif ? ' on' : ''}`} onClick={() => onChange(!actif)} aria-pressed={actif}>
      <span />
    </button>
  );
}

function demanderMotif(question) {
  const m = window.prompt(`${question}\n\nMotif (obligatoire, gardé dans le journal) :`);
  if (m === null) return null;
  if (m.trim().length < 5) { window.alert('Le motif doit faire au moins 5 caractères.'); return null; }
  return m.trim();
}

export default function Finances() {
  const toast = useToast();
  const habilite = ['SUPER_ADMIN', 'ADMIN'].includes(Auth.role());
  const [d, setD] = useState(null);
  const [regions, setRegions] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(null);
  const [fiche, setFiche] = useState(null);
  const [recherche, setRecherche] = useState('');

  const charger = async () => {
    try {
      const v = await apiFinances.vue();
      setD(v);
      setForm({ ...v.reglages });
    } catch (e) { toast(e.message, 'error'); }
  };
  useEffect(() => {
    charger();
    apiRegions.liste().then(r => setRegions(Array.isArray(r) ? r : [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pilotes = useMemo(() => (form?.ECO_REGIONS_PILOTE || '').split(',').filter(Boolean), [form]);
  const modifie = d && form && JSON.stringify(d.reglages) !== JSON.stringify(form);
  const set = (k, v) => setForm(f => ({ ...f, [k]: String(v) }));
  const basculerRegion = code => set('ECO_REGIONS_PILOTE', pilotes.includes(code) ? pilotes.filter(c => c !== code).join(',') : [...pilotes, code].join(','));

  const enregistrer = async () => {
    const motif = demanderMotif('Enregistrer les réglages du modèle économique ?');
    if (!motif) return;
    setBusy('reglages');
    try {
      await apiFinances.reglages(form, motif);
      Audit.log('FINANCES_REGLAGES', motif);
      toast('Réglages enregistrés', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  const confirmer = async r => {
    if (!window.confirm(`Confirmer ${fcfa(r.montant)} ${MOYENS[r.moyen]} (réf. ${r.referenceTransaction}) pour ${r.nom} ?\nVérifiez d'abord que la somme est bien arrivée.`)) return;
    setBusy(`r${r.id}`);
    try {
      await apiFinances.confirmer(r.id);
      Audit.log('FINANCES_RECHARGE', `${r.nom} +${r.montant} F réf. ${r.referenceTransaction}`);
      toast('Recharge confirmée : le chauffeur est prévenu', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  const refuser = async r => {
    const motif = demanderMotif(`Refuser ${fcfa(r.montant)} (réf. ${r.referenceTransaction}) de ${r.nom} ?`);
    if (!motif) return;
    setBusy(`r${r.id}`);
    try {
      await apiFinances.refuser(r.id, motif);
      Audit.log('FINANCES_RECHARGE_REFUS', `${r.nom} réf. ${r.referenceTransaction} : ${motif}`);
      toast('Recharge refusée : le chauffeur est prévenu', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  const ouvrirFiche = async c => {
    try { setFiche(await apiFinances.chauffeur(c.id)); } catch (e) { toast(e.message, 'error'); }
  };

  const ajuster = async () => {
    const brut = window.prompt(`Ajustement du solde de ${fiche.nom}\nMontant en FCFA (négatif pour retirer, ex. -500) :`);
    if (brut === null) return;
    const montant = parseInt(String(brut).replace(/\s/g, ''), 10);
    if (!montant) { toast('Montant invalide', 'error'); return; }
    const motif = demanderMotif(`${montant > 0 ? 'Ajouter' : 'Retirer'} ${fcfa(Math.abs(montant))} ${montant > 0 ? 'au' : 'du'} solde de ${fiche.nom} ?`);
    if (!motif) return;
    setBusy('ajuster');
    try {
      await apiFinances.ajuster(fiche.id ?? fiche.chauffeurId, montant, motif);
      Audit.log('FINANCES_AJUSTEMENT', `${fiche.nom} ${montant} F : ${motif}`);
      toast('Ajustement enregistré', 'success');
      setFiche(await apiFinances.chauffeur(fiche.id ?? fiche.chauffeurId));
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  if (!d || !form) return <Spinner center />;
  const prepaye = form.ECO_MODE !== 'DETTE';
  const actif = form.ECO_ACTIF === 'true';
  const q = recherche.trim().toLowerCase();
  const chauffeurs = (d.chauffeurs || []).filter(c => !q || `${c.nom} ${c.telephone}`.toLowerCase().includes(q));

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Finances</h1>
          <p>Modèle économique, phase pilote : commission sur les courses et livraisons terminées des régions choisies,
            solde prépayé ou commissions à régler. Le serveur fait tous les calculs ; rien n'est jamais effacé.</p>
        </div>
        <button className="nd-btn nd-btn-ghost" onClick={charger}><RefreshCw size={15} /> Actualiser</button>
      </div>

      <div className="nd-stat-grid">
        {[
          ['Commissions prélevées', fcfa(-(d.totaux?.COMMISSION?.total || 0)), `${d.totaux?.COMMISSION?.nombre || 0} courses / livraisons`],
          ['Recharges confirmées', fcfa(d.totaux?.RECHARGE?.total || 0), `${d.totaux?.RECHARGE?.nombre || 0} opérations`],
          [prepaye ? 'Soldes négatifs (à recharger)' : 'Commissions à régler', fcfa(d.totalARegler), `${d.chauffeursBloques || 0} chauffeur(s) bloqué(s)`],
          ['Soldes positifs des chauffeurs', fcfa(d.totalAvoirs), `${(d.chauffeurs || []).length} chauffeurs concernés`],
        ].map(([l, v, s]) => (
          <div key={l} className="nd-card"><div className="nd-card-body">
            <div className="nd-cell-sub">{l}</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div>
            <div className="nd-cell-sub">{s}</div>
          </div></div>
        ))}
      </div>

      {/* ─── Réglages ─── */}
      <div className="nd-card" style={{ marginBottom: 16 }}>
        <div className="nd-card-header"><h3><Wallet size={16} /> Réglages du pilote</h3></div>
        <div className="nd-card-body" style={{ display: 'grid', gap: 16 }}>
          <div className="cp-ligne">
            <div>
              <b>Modèle économique activé</b>
              <small className="nd-cell-sub">Coupé : aucune commission, aucun chauffeur bloqué. Les écritures déjà faites restent.</small>
            </div>
            <Interrupteur actif={actif} onChange={v => habilite && set('ECO_ACTIF', v)} />
          </div>

          <div>
            <b>Mode</b>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              {[['PREPAYE', 'Solde prépayé', 'Le chauffeur recharge ; la commission est retirée de son solde'],
                ['DETTE', 'Commissions à régler', 'La commission s\'ajoute à ce qu\'il doit ; il règle ensuite']].map(([k, l, aide]) => (
                <button key={k} type="button" disabled={!habilite} onClick={() => set('ECO_MODE', k)}
                  className={`nd-btn ${form.ECO_MODE === k ? 'nd-btn-primary' : 'nd-btn-outline'}`} title={aide}>{l}</button>
              ))}
            </div>
            <small className="nd-cell-sub">{prepaye ? 'Prépayé : sous le solde minimum, le chauffeur ne reçoit plus de demandes.'
              : 'Dette : au-delà du plafond, le chauffeur ne reçoit plus de demandes.'}</small>
          </div>

          <div>
            <b>Régions pilotes</b> <small className="nd-cell-sub">la commission ne s'applique qu'aux courses qui partent de ces régions</small>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {regions.map(r => (
                <button key={r.code} type="button" disabled={!habilite} onClick={() => basculerRegion(r.code)}
                  className={`nd-btn nd-btn-sm ${pilotes.includes(r.code) ? 'nd-btn-primary' : 'nd-btn-outline'}`}>{r.nom}</button>
              ))}
            </div>
            {actif && pilotes.length === 0 && <small style={{ color: 'var(--nd-orange, #f59e0b)' }}>Aucune région choisie : aucune commission ne sera prélevée.</small>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[
              ['ECO_COMMISSION_POURCENT', 'Commission (%)', '0 à 30'],
              prepaye ? ['ECO_SOLDE_MINIMUM', 'Solde minimum (F)', 'ex. -1000 : peut descendre jusqu\'à -1 000 F'] : ['ECO_DETTE_MAX', 'Plafond de dette (F)', 'au-delà : plus de demandes'],
              ['ECO_RECHARGE_MIN', 'Recharge minimum (F)', ''],
              ['ECO_NUMERO_WAVE', 'Numéro marchand Wave', 'où les chauffeurs envoient'],
              ['ECO_NUMERO_OM', 'Numéro marchand Orange Money', 'où les chauffeurs envoient'],
            ].map(([k, l, aide]) => (
              <div key={k} className="nd-form-group">
                <label>{l}</label>
                <input className="nd-input" value={form[k] ?? ''} disabled={!habilite} onChange={e => set(k, e.target.value)} />
                {aide && <small className="nd-cell-sub">{aide}</small>}
              </div>
            ))}
          </div>

          {habilite ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="nd-btn nd-btn-primary" disabled={!modifie || busy === 'reglages'} onClick={enregistrer}>
                <Save size={15} /> Enregistrer (avec motif)
              </button>
            </div>
          ) : <small className="nd-cell-sub">Lecture seule : seuls le super-administrateur et l'administrateur peuvent modifier.</small>}
        </div>
      </div>

      {/* ─── Recharges à confirmer ─── */}
      <div className="nd-card" style={{ marginBottom: 16 }}>
        <div className="nd-card-header"><h3><CheckCircle2 size={16} /> Recharges à confirmer ({(d.rechargesEnAttente || []).length})</h3></div>
        {(d.rechargesEnAttente || []).length === 0 ? (
          <div className="nd-card-body nd-cell-sub">Aucune recharge en attente.</div>
        ) : (
          <div className="nd-table-wrap"><table className="nd-table">
            <thead><tr><th>Chauffeur</th><th>Montant</th><th>Moyen / référence</th><th>Déclarée</th><th>Solde actuel</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {d.rechargesEnAttente.map(r => (
                <tr key={r.id}>
                  <td><b>{r.nom}</b><div className="nd-cell-sub"><Phone size={11} /> {joli(r.telephone)}</div></td>
                  <td><b>{fcfa(r.montant)}</b></td>
                  <td>{MOYENS[r.moyen]}<div className="nd-cell-sub" style={{ fontFamily: 'monospace' }}>{r.referenceTransaction}</div></td>
                  <td className="nd-cell-sub">{fmtDT(r.creeLe)}</td>
                  <td style={{ color: r.soldeActuel < 0 ? '#ef4444' : undefined }}>{fcfa(r.soldeActuel)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {habilite && <>
                      <button className="nd-btn nd-btn-primary nd-btn-sm" disabled={busy === `r${r.id}`} onClick={() => confirmer(r)}><CheckCircle2 size={14} /> Confirmer</button>{' '}
                      <button className="nd-btn nd-btn-outline nd-btn-sm" disabled={busy === `r${r.id}`} onClick={() => refuser(r)}><XCircle size={14} /> Refuser</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* ─── Soldes ─── */}
      <div className="nd-card" style={{ marginBottom: 16 }}>
        <div className="nd-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h3><Scale size={16} /> Soldes des chauffeurs</h3>
          <input className="nd-input" style={{ maxWidth: 260 }} placeholder="Rechercher (nom, numéro)" value={recherche} onChange={e => setRecherche(e.target.value)} />
        </div>
        {chauffeurs.length === 0 ? <div className="nd-card-body nd-cell-sub">Aucun chauffeur avec des écritures pour l'instant.</div> : (
          <div className="nd-table-wrap"><table className="nd-table">
            <thead><tr><th>Chauffeur</th><th>{prepaye ? 'Solde' : 'Solde (négatif = à régler)'}</th><th>État</th><th style={{ textAlign: 'right' }}>Détail</th></tr></thead>
            <tbody>
              {chauffeurs.map(c => (
                <tr key={c.id}>
                  <td><b>{c.nom}</b><div className="nd-cell-sub">{joli(c.telephone)}</div></td>
                  <td style={{ fontWeight: 700, color: c.solde < 0 ? '#ef4444' : '#16a34a' }}>{fcfa(c.solde)}</td>
                  <td>{c.bloque ? <span className="nd-badge badge-danger"><AlertTriangle size={12} /> Bloqué</span> : <span className="nd-badge badge-success">Actif</span>}</td>
                  <td style={{ textAlign: 'right' }}><button className="nd-btn nd-btn-ghost nd-btn-sm" onClick={() => ouvrirFiche(c)}><History size={14} /> Historique</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* ─── Historique d'un chauffeur ─── */}
      {fiche && (
        <div className="nd-card" style={{ marginBottom: 16 }}>
          <div className="nd-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h3><History size={16} /> {fiche.nom} · {fcfa(fiche.solde)}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {habilite && <button className="nd-btn nd-btn-outline nd-btn-sm" disabled={busy === 'ajuster'} onClick={ajuster}>Ajuster (avec motif)</button>}
              <button className="nd-btn nd-btn-ghost nd-btn-sm" onClick={() => setFiche(null)}>Fermer</button>
            </div>
          </div>
          <div className="nd-table-wrap"><table className="nd-table">
            <thead><tr><th>Date</th><th>Opération</th><th style={{ textAlign: 'right' }}>Montant</th></tr></thead>
            <tbody>
              {(fiche.historique || []).map(e => (
                <tr key={e.id}>
                  <td className="nd-cell-sub">{fmtDT(e.creeLe)}</td>
                  <td>{e.motif}<div className="nd-cell-sub" style={{ fontFamily: 'monospace' }}>{e.reference}</div></td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: e.montant < 0 ? '#ef4444' : '#16a34a' }}>{e.montant > 0 ? '+' : ''}{fcfa(e.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* ─── Journal ─── */}
      <div className="nd-card">
        <div className="nd-card-header"><h3><History size={16} /> Journal des actions financières</h3></div>
        {(d.journal || []).length === 0 ? <div className="nd-card-body nd-cell-sub">Aucune action pour l'instant.</div> : (
          <div className="nd-table-wrap"><table className="nd-table">
            <thead><tr><th>Date</th><th>Action</th><th>Par</th><th>Motif</th><th>Avant → après</th></tr></thead>
            <tbody>
              {d.journal.map(j => (
                <tr key={j.id}>
                  <td className="nd-cell-sub">{fmtDT(j.creeLe)}</td>
                  <td><b>{ACTIONS[j.action] || j.action}</b></td>
                  <td className="nd-cell-sub">{j.auteur}{j.roleAuteur ? ` (${j.roleAuteur})` : ''}</td>
                  <td>{j.motif}</td>
                  <td className="nd-cell-sub" style={{ maxWidth: 360, wordBreak: 'break-word' }}>{j.avant || j.apres ? `${j.avant ?? '—'} → ${j.apres ?? '—'}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <div className="nd-card-body nd-cell-sub" style={{ fontSize: 12 }}>
          {Object.entries(d.totaux || {}).map(([k, v]) => `${TYPES[k] || k} : ${v.nombre} · ${fcfa(v.total)}`).join('  ·  ')}
        </div>
      </div>
    </div>
  );
}
