import { useState } from 'react';
import { apiHistorique, apiTrajets, apiReservations, apiUsers, fmtDate, fmtDT, Auth, Audit } from '../services/api';
import { StatusBadge, Modal, EmptyRow, LoadingRow, MiniCard, usePagination } from '../components/ui';
import useAuChargement from '../hooks/useAuChargement';
import { useToast } from '../context/AppContext';

/**
 * Historique complet : trajets (passés compris), réservations, véhicules avec leur propriétaire.
 * Avant : seuls les trajets « disponibles » et les réservations de 20 d'entre eux étaient visibles ;
 * les véhicules affichaient des champs vides (immatriculation, date, propriétaire).
 */

const fcfa = n => `${Number(n || 0).toLocaleString('fr-FR')} F`;
const joli = t => (t || '').replace(/^(\d{2})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4');
const contient = (q, ...v) => !q || v.some(x => String(x ?? '').toLowerCase().includes(q));
const peutModifier = () => ['SUPER_ADMIN', 'ADMIN', 'ADMIN1', 'SUPPORT'].includes(Auth.role());

function Onglets({ valeur, onChange, options }) {
  return (
    <div className="sv-chips" style={{ padding: '0 0 12px' }}>
      {options.map(([k, l]) => (
        <button key={k} type="button" className={`sv-chip ${valeur === k ? 'active' : ''}`} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  );
}

/** Rubrique de l'app client (même calcul que le serveur) */
const CATEGORIES = {
  PARTICULIER: ['🚕', 'Taxi-Bokko', '#0E9384'],
  BUS: ['🚌', 'Bus (entreprises)', '#1570EF'],
  ALLO: ['🚐', 'Allô Sénégal', '#DC6803'],
};
const BadgeCategorie = ({ c }) => {
  const [i, l, couleur] = CATEGORIES[c] || ['❔', c || '—', '#667085'];
  return <span className="nd-badge" style={{ background: `${couleur}1a`, color: couleur, whiteSpace: 'nowrap' }}>{i} {l}</span>;
};
/** Filtre Toutes / Taxi-Bokko / Bus / Allô Sénégal, avec le nombre de lignes */
function FiltreCategorie({ valeur, onChange, lignes }) {
  const n = k => lignes.filter(x => x.categorie === k).length;
  return (
    <div className="sv-chips" style={{ padding: '0 0 10px' }}>
      <button type="button" className={`sv-chip ${!valeur ? 'active' : ''}`} onClick={() => onChange('')}>Toutes rubriques ({lignes.length})</button>
      {Object.entries(CATEGORIES).map(([k, [i, l]]) => (
        <button key={k} type="button" className={`sv-chip ${valeur === k ? 'active' : ''}`} onClick={() => onChange(k)}>{i} {l} ({n(k)})</button>
      ))}
    </div>
  );
}

const PAIEMENT = {
  PAYE: ['badge-success', 'Avance payée'],
  EN_ATTENTE: ['badge-warn', 'Avance à payer'],
  SANS_ACOMPTE: ['badge-info', 'À payer au chauffeur'],
  ECHEC: ['badge-danger', 'Paiement échoué'],
};
const BadgePaiement = ({ s }) => {
  const [c, l] = PAIEMENT[s] || ['badge-secondary', s || '—'];
  return <span className={`nd-badge ${c}`}>{l}</span>;
};

// ─── TRAJETS ────────────────────────────────────────────────────
export function Trajets() {
  const toast = useToast();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [periode, setPeriode] = useState('A_VENIR');
  const [categorie, setCategorie] = useState('');
  const [masques, setMasques] = useState(false);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const vide = { chauffeurId: '', lieuDepart: '', lieuDestination: '', dateHeureDepart: '', nombrePlacesTotal: '', prixParPlace: '', statut: 'ACTIF' };
  const [form, setForm] = useState(vide);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [resas, setResas] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setAll(await apiHistorique.trajets()); }
    catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  };
  useAuChargement(load);

  const q = search.trim().toLowerCase();
  const arrete = t => ['ANNULE', 'SUPPRIME'].includes(t.statut);
  const dansPeriode = (t, p = periode) => p === 'TOUS' ? true
    : p === 'A_VENIR' ? !t.passe && !arrete(t)
    : p === 'PASSES' ? t.passe && !arrete(t)
    : arrete(t);
  const filtered = all.filter(t => dansPeriode(t) && (!categorie || t.categorie === categorie) && (!masques || !t.visibleApp) && contient(q, t.id, t.lieuDepart, t.lieuDestination, t.nomChauffeur, t.telephone, t.entreprise, t.vehicule?.numeroImmatriculation));
  // Trajets à venir : le plus proche d'abord ; historique : le plus récent d'abord
  const tries = periode === 'A_VENIR' ? [...filtered].sort((a, b) => String(a.dateHeureDepart).localeCompare(String(b.dateHeureDepart))) : filtered;
  const { visibles, barre } = usePagination(tries);
  const compte = k => all.filter(t => dansPeriode(t, k) && (!categorie || t.categorie === categorie)).length;
  // Trajets à venir que les clients ne voient pas (abonnement expiré, complet…)
  const caches = all.filter(t => dansPeriode(t, 'A_VENIR') && !t.visibleApp && (!categorie || t.categorie === categorie)).length;

  const openModal = (item = null) => {
    setEditId(item?.id || null); setErr('');
    setForm(item ? { chauffeurId: item.chauffeurId || '', lieuDepart: item.lieuDepart || '', lieuDestination: item.lieuDestination || '',
      dateHeureDepart: (item.dateHeureDepart || '').slice(0, 16), nombrePlacesTotal: item.nombrePlacesTotal || '', prixParPlace: item.prixParPlace || '', statut: item.statut || 'ACTIF' } : vide);
    setModal(true);
  };
  const submit = async () => {
    setErr(''); setSubmitting(true);
    try {
      const payload = { ...form, nombrePlacesTotal: Number(form.nombrePlacesTotal), prixParPlace: Number(form.prixParPlace) };
      if (editId) { await apiTrajets.update(editId, payload); toast('Trajet modifié', 'success'); }
      else { await apiTrajets.create(payload); toast('Trajet créé', 'success'); }
      Audit.log(editId ? 'UPDATE_TRAJET' : 'CREATE_TRAJET', `Trajet ${form.lieuDepart}→${form.lieuDestination}`);
      setModal(false); load();
    } catch (e) { setErr(e.message); }
    finally { setSubmitting(false); }
  };
  const del = async id => {
    if (!window.confirm('Supprimer ce trajet ?')) return;
    try { await apiTrajets.del(id); toast('Supprimé', 'success'); load(); }
    catch (e) { toast(e.message, 'error'); }
  };
  const voirResas = async t => {
    try {
      const r = await apiHistorique.reservations();
      setResas({ trajet: t, liste: (r || []).filter(x => x.trajetId === t.id) });
    } catch (e) { toast(e.message, 'error'); }
  };
  const inp = (field, props = {}) => <input {...props} className="nd-input" value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />;

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Trajets</h1>
          <p>{loading ? 'Chargement...' : `${filtered.length} / ${all.length} trajet(s), passés compris`}</p>
        </div>
        <div className="nd-page-header-actions">
          <div className="nd-search-box"><span>🔍</span><input placeholder="Ville, chauffeur, entreprise, plaque..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <button className="nd-btn nd-btn-outline" onClick={load}>↺</button>
          <button className="nd-btn nd-btn-primary" onClick={() => openModal()}>+ Nouveau trajet</button>
        </div>
      </div>
      <Onglets valeur={periode} onChange={setPeriode} options={[
        ['A_VENIR', `À venir (${compte('A_VENIR')})`], ['PASSES', `Historique (${compte('PASSES')})`],
        ['ANNULES', `Annulés (${compte('ANNULES')})`], ['TOUS', `Tous (${all.filter(t => !categorie || t.categorie === categorie).length})`]]} />
      <FiltreCategorie valeur={categorie} onChange={setCategorie} lignes={all.filter(t => dansPeriode(t))} />
      {periode === 'A_VENIR' && caches > 0 && (
        <div className="nd-alert nd-alert-warn" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>⚠ <b>{caches}</b> trajet(s) à venir ne sont pas visibles par les clients (abonnement expiré, complet…).</span>
          <button type="button" className="nd-btn nd-btn-outline nd-btn-sm" onClick={() => setMasques(m => !m)}>{masques ? 'Voir tous les trajets' : 'Voir lesquels'}</button>
        </div>
      )}
      <div className="nd-card"><div className="nd-card-body-p0"><div className="nd-table-wrap">
        <table className="nd-table">
          <thead><tr><th>#</th><th>Dans l'app</th><th>Chauffeur / entreprise</th><th>Trajet</th><th>Départ</th><th>Véhicule</th><th>Places</th><th>Réservations</th><th>Prix/place</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <LoadingRow cols={11} /> : !filtered.length ? <EmptyRow cols={11} msg="Aucun trajet" /> :
              visibles.map(t => (
                <tr key={t.id}>
                  <td className="nd-table-id">#{t.id}</td>
                  <td><BadgeCategorie c={t.categorie} />
                    {!t.passe && !['ANNULE', 'SUPPRIME'].includes(t.statut) && (t.visibleApp
                      ? <div className="nd-cell-sub" style={{ color: 'var(--nd-green)' }}>✓ visible par les clients</div>
                      : <div className="nd-cell-sub" style={{ color: 'var(--nd-red)', fontWeight: 600 }}>✕ caché : {t.raisonCache}</div>)}</td>
                  <td><div className="nd-cell-name">{t.nomChauffeur || '—'}</div>
                    <div className="nd-cell-sub">{t.entreprise ? `🏢 ${t.entreprise}` : joli(t.telephone) || `ID ${t.chauffeurId || '—'}`}{t.chauffeurId ? ` · ID ${t.chauffeurId}` : ''}</div></td>
                  <td><small>{t.lieuDepart || '—'} → {t.lieuDestination || '—'}</small></td>
                  <td><small className="nd-cell-sub">{fmtDT(t.dateHeureDepart)}</small>{t.passe && <div><span className="nd-badge badge-secondary">passé</span></div>}</td>
                  <td>{t.vehicule ? <><code style={{ fontSize: 12 }}>{t.vehicule.numeroImmatriculation || '—'}</code><div className="nd-cell-sub">{[t.vehicule.marque, t.vehicule.modele].filter(Boolean).join(' ')}</div></> : <small className="nd-cell-sub">—</small>}</td>
                  <td><b>{t.placesVendues}</b><small className="nd-cell-sub"> vendues / {t.nombrePlacesTotal || 0}</small></td>
                  <td><button className="nd-btn nd-btn-ghost nd-btn-sm" onClick={() => voirResas(t)}>📅 {t.reservations}{t.reservationsAnnulees ? ` (+${t.reservationsAnnulees} annulée(s))` : ''}</button>
                    {t.montantReservations > 0 && <div className="nd-cell-sub">{fcfa(t.montantReservations)}</div>}</td>
                  <td><strong style={{ color: 'var(--nd-teal)' }}>{t.prixParPlace ? fcfa(t.prixParPlace) : '—'}</strong></td>
                  <td><StatusBadge status={t.statut || 'ACTIF'} /></td>
                  <td><div style={{ display: 'flex', gap: 5 }}>
                    <button className="nd-btn-icon" onClick={() => openModal(t)} title="Modifier">✏</button>
                    <button className="nd-btn-icon danger" onClick={() => del(t.id)} title="Supprimer">🗑</button>
                  </div></td>
                </tr>
              ))}
          </tbody>
        </table>
        {barre}
      </div></div></div>

      <Modal open={modal} title={editId ? 'Modifier le trajet' : 'Nouveau trajet'} onClose={() => setModal(false)}
        footer={<><button className="nd-btn nd-btn-outline" onClick={() => setModal(false)}>Annuler</button>
          <button className="nd-btn nd-btn-primary" onClick={submit} disabled={submitting}>{submitting ? <><div className="nd-spinner-sm" />...</> : 'Enregistrer'}</button></>}>
        {inp('chauffeurId', { placeholder: 'ID du chauffeur *' })}
        <div className="nd-form-row">{inp('lieuDepart', { placeholder: 'Lieu de départ *' })}{inp('lieuDestination', { placeholder: 'Destination *' })}</div>
        <div className="nd-form-group"><label>Date et heure de départ</label>{inp('dateHeureDepart', { type: 'datetime-local' })}</div>
        <div className="nd-form-row">{inp('nombrePlacesTotal', { type: 'number', placeholder: 'Nb places', min: 1 })}{inp('prixParPlace', { type: 'number', placeholder: 'Prix/place FCFA', min: 0 })}</div>
        <select className="nd-input nd-select" value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
          {['ACTIF', 'COMPLET', 'TERMINE', 'ANNULE'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {err && <div className="nd-alert nd-alert-danger">⚠ {err}</div>}
      </Modal>

      <Modal open={!!resas} title={resas ? `Réservations du trajet #${resas.trajet.id} · ${resas.trajet.lieuDepart} → ${resas.trajet.lieuDestination}` : ''} onClose={() => setResas(null)}>
        {resas && (!resas.liste.length ? <div style={{ textAlign: 'center', color: 'var(--nd-text-dim)', padding: 20 }}>Aucune réservation</div> :
          resas.liste.map(r => (
            <div key={r.id} className="nd-detail-row" style={{ alignItems: 'flex-start' }}>
              <span className="nd-detail-label">
                <b>#{r.id}</b> {r.codeBillet && <code>{r.codeBillet}</code>} · {r.nomClient || `Client ${r.clientId}`} {r.telephoneClient && `(${joli(r.telephoneClient)})`}
                <div className="nd-cell-sub">{r.nombrePlaces} place(s) · {fcfa(r.montantTotal)}{r.embarque ? ' · ✅ embarqué' : ''}</div>
              </span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}><BadgePaiement s={r.paiementStatut} /><StatusBadge status={r.statut} /></span>
            </div>
          )))}
      </Modal>
    </div>
  );
}

// ─── RÉSERVATIONS ───────────────────────────────────────────────
export function Reservations() {
  const toast = useToast();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onglet, setOnglet] = useState('A_VENIR');
  const [categorie, setCategorie] = useState('');

  const load = async () => {
    setLoading(true);
    try { setAll(await apiHistorique.reservations()); }
    catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  };
  useAuChargement(load);

  const annulee = r => r.statut === 'ANNULEE';
  const dans = (r, k) => k === 'TOUTES' ? true : k === 'ANNULEES' ? annulee(r) : k === 'A_VENIR' ? !annulee(r) && !r.passe : !annulee(r) && r.passe;
  const q = search.trim().toLowerCase();
  const filtered = all.filter(r => dans(r, onglet) && (!categorie || r.categorie === categorie) && contient(q, r.id, r.codeBillet, r.nomClient, r.telephoneClient, r.clientId, r.lieuDepart, r.lieuDestination, r.nomChauffeur, r.entreprise));
  const { visibles, barre } = usePagination(filtered);
  const nb = k => all.filter(r => dans(r, k) && (!categorie || r.categorie === categorie)).length;
  const actives = all.filter(r => !annulee(r) && (!categorie || r.categorie === categorie));
  const encaisse = actives.filter(r => r.paiementStatut === 'PAYE').reduce((s, r) => s + (r.montantPaye || 0), 0);

  const del = async id => {
    if (!window.confirm('Supprimer cette réservation ?')) return;
    try { await apiReservations.del(id); toast('Supprimée', 'success'); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Réservations</h1>
          <p>{loading ? 'Chargement...' : `${filtered.length} / ${all.length} réservation(s), historique compris`}</p>
        </div>
        <div className="nd-page-header-actions">
          <div className="nd-search-box"><span>🔍</span><input placeholder="Billet, client, téléphone, ville..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <button className="nd-btn nd-btn-outline" onClick={load}>↺</button>
        </div>
      </div>
      <div className="nd-mini-stats" style={{ marginBottom: 16 }}>
        <MiniCard color="var(--nd-primary)" value={actives.length} label="Réservations actives" />
        <MiniCard color="var(--nd-blue)" value={actives.reduce((s, r) => s + (r.nombrePlaces || 0), 0)} label="Places réservées" />
        <MiniCard color="var(--nd-green)" value={fcfa(encaisse)} label="Avances payées en ligne" />
        <MiniCard color="var(--nd-teal)" value={actives.filter(r => r.embarque).length} label="Passagers embarqués" />
      </div>
      <Onglets valeur={onglet} onChange={setOnglet} options={[
        ['A_VENIR', `À venir (${nb('A_VENIR')})`], ['PASSEES', `Historique (${nb('PASSEES')})`],
        ['ANNULEES', `Annulées (${nb('ANNULEES')})`], ['TOUTES', `Toutes (${nb('TOUTES')})`]]} />
      <FiltreCategorie valeur={categorie} onChange={setCategorie} lignes={all.filter(r => dans(r, onglet))} />
      <div className="nd-card"><div className="nd-card-body-p0"><div className="nd-table-wrap">
        <table className="nd-table">
          <thead><tr><th>#</th><th>Rubrique</th><th>Billet</th><th>Client</th><th>Trajet</th><th>Départ</th><th>Chauffeur</th><th>Places</th><th>Montant</th><th>Paiement</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {loading ? <LoadingRow cols={12} /> : !filtered.length ? <EmptyRow cols={12} msg="Aucune réservation" /> :
              visibles.map(r => (
                <tr key={r.id}>
                  <td className="nd-table-id">#{r.id}</td>
                  <td><BadgeCategorie c={r.categorie} /></td>
                  <td>{r.codeBillet ? <code style={{ fontSize: 12 }}>{r.codeBillet}</code> : '—'}{r.embarque && <div><span className="nd-badge badge-success">embarqué</span></div>}</td>
                  <td><div className="nd-cell-name">{r.nomClient || '—'}</div><div className="nd-cell-sub">{joli(r.telephoneClient)} · ID {r.clientId || '—'}</div></td>
                  <td><small>{r.lieuDepart || '—'} → {r.lieuDestination || '—'}</small><div className="nd-cell-sub">T#{r.trajetId}</div></td>
                  <td><small className="nd-cell-sub">{fmtDT(r.dateHeureDepart)}</small><div className="nd-cell-sub">réservé le {fmtDate(r.dateReservation)}</div></td>
                  <td><small>{r.nomChauffeur || '—'}</small>{r.entreprise && <div className="nd-cell-sub">🏢 {r.entreprise}</div>}</td>
                  <td><b>{r.nombrePlaces || 0}</b></td>
                  <td><b>{fcfa(r.montantTotal)}</b>{r.paiementStatut === 'PAYE' && r.montantPaye ? <div className="nd-cell-sub">payé {fcfa(r.montantPaye)}</div> : null}</td>
                  <td><BadgePaiement s={r.paiementStatut} /></td>
                  <td><StatusBadge status={r.statut || 'CONFIRMEE'} /></td>
                  <td><button className="nd-btn-icon danger" onClick={() => del(r.id)} title="Supprimer">🗑</button></td>
                </tr>
              ))}
          </tbody>
        </table>
        {barre}
      </div></div></div>
    </div>
  );
}

// ─── VÉHICULES ──────────────────────────────────────────────────
const ICONES = [[/camion/i, '🚚'], [/fourgon/i, '🚐'], [/3 roues|trois/i, '🛺'], [/jakarta|moto/i, '🏍'], [/bokko|taxi/i, '🚕'], [/bus|car\b/i, '🚌']];
const icone = t => (ICONES.find(([r]) => r.test(t || '')) || [null, '🚗'])[1];

export function Vehicules() {
  const toast = useToast();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtre, setFiltre] = useState('TOUS');
  const [assoc, setAssoc] = useState(null); // véhicule à associer
  const [chauffeurs, setChauffeurs] = useState([]);
  const [choix, setChoix] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setAll(await apiHistorique.vehicules()); }
    catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  };
  useAuChargement(load);

  const q = search.trim().toLowerCase();
  const filtered = all.filter(v => (filtre === 'TOUS' || (filtre === 'SANS' ? !v.proprietaire && !v.entreprise : filtre === 'ENTREPRISE' ? !!v.entreprise : !!v.proprietaire && !v.entreprise))
    && contient(q, v.id, v.type, v.marque, v.modele, v.numeroImmatriculation, v.couleur, v.proprietaire?.nom, v.proprietaire?.telephone, v.proprietaire?.id, v.entreprise));
  const { visibles, barre } = usePagination(filtered);
  const nb = f => all.filter(v => f === 'SANS' ? !v.proprietaire && !v.entreprise : f === 'ENTREPRISE' ? !!v.entreprise : !!v.proprietaire && !v.entreprise).length;

  const ouvrirAssoc = async v => {
    setAssoc(v); setChoix(v.proprietaire?.id ? String(v.proprietaire.id) : '');
    if (!chauffeurs.length) {
      try { setChauffeurs(((await apiUsers.chauffeurs()) || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''))); } catch {}
    }
  };
  const associer = async (chauffeurId) => {
    setBusy(true);
    try {
      await apiHistorique.associer(assoc.id, chauffeurId || null);
      Audit.log('VEHICULE_ASSOCIE', `Véhicule #${assoc.id} ${assoc.numeroImmatriculation || ''} → ${chauffeurId ? `chauffeur #${chauffeurId}` : 'aucun chauffeur'}`);
      toast(chauffeurId ? 'Véhicule associé au chauffeur' : 'Véhicule détaché', 'success');
      setAssoc(null); load();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Véhicules</h1>
          <p>{loading ? 'Chargement...' : `${filtered.length} / ${all.length} véhicule(s)`}</p>
        </div>
        <div className="nd-page-header-actions">
          <div className="nd-search-box"><span>🔍</span><input placeholder="Plaque, marque, propriétaire, téléphone..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <button className="nd-btn nd-btn-outline" onClick={load}>↺</button>
        </div>
      </div>
      <Onglets valeur={filtre} onChange={setFiltre} options={[
        ['TOUS', `Tous (${all.length})`], ['CHAUFFEUR', `Chauffeurs indépendants (${nb('CHAUFFEUR')})`],
        ['ENTREPRISE', `Entreprises (${nb('ENTREPRISE')})`], ['SANS', `Sans propriétaire (${nb('SANS')})`]]} />
      <div className="nd-card"><div className="nd-card-body-p0"><div className="nd-table-wrap">
        <table className="nd-table">
          <thead><tr><th>#</th><th>Type</th><th>Marque / modèle</th><th>Immatriculation</th><th>Couleur · année</th><th>Propriétaire</th><th>Enregistré le</th><th></th></tr></thead>
          <tbody>
            {loading ? <LoadingRow cols={8} /> : !filtered.length ? <EmptyRow cols={8} msg="Aucun véhicule" /> :
              visibles.map(v => (
                <tr key={v.id}>
                  <td className="nd-table-id">#{v.id}</td>
                  <td><span style={{ fontSize: 20 }}>{icone(v.type)}</span> <small>{v.type || '—'}</small>{v.nombrePlaces ? <div className="nd-cell-sub">{v.nombrePlaces} places</div> : null}</td>
                  <td><div className="nd-cell-name">{v.marque || '—'}</div><div className="nd-cell-sub">{v.modele || '—'}</div></td>
                  <td><code style={{ background: 'var(--nd-surface2)', padding: '3px 8px', borderRadius: 6, fontSize: 13, fontWeight: 700 }}>{v.numeroImmatriculation || '—'}</code></td>
                  <td><small>{v.couleur || '—'}</small><div className="nd-cell-sub">{v.anneeFabrication || ''}</div></td>
                  <td>{v.proprietaire ? <>
                      <div className="nd-cell-name">{v.proprietaire.nom || '—'}</div>
                      <div className="nd-cell-sub">ID {v.proprietaire.id} · {joli(v.proprietaire.telephone)}</div>
                    </> : null}
                    {v.entreprise && <div className="nd-cell-sub">🏢 {v.entreprise}</div>}
                    {!v.proprietaire && !v.entreprise && <span className="nd-badge badge-warn">Sans propriétaire</span>}</td>
                  <td><small className="nd-cell-sub">{v.creeLe ? fmtDate(v.creeLe) : '—'}</small></td>
                  <td>{peutModifier() && <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={() => ouvrirAssoc(v)}>🔗 Chauffeur</button>}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {barre}
      </div></div></div>

      <Modal open={!!assoc} title={assoc ? `Associer le véhicule ${assoc.numeroImmatriculation || `#${assoc.id}`} à un chauffeur` : ''} onClose={() => setAssoc(null)}
        footer={<>
          {assoc?.proprietaire && <button className="nd-btn nd-btn-outline" disabled={busy} onClick={() => associer(null)}>Détacher</button>}
          <button className="nd-btn nd-btn-primary" disabled={busy || !choix} onClick={() => associer(choix)}>Associer</button>
        </>}>
        {assoc && <>
          <p className="nd-cell-sub">{[assoc.type, assoc.marque, assoc.modele, assoc.couleur].filter(Boolean).join(' · ')}</p>
          <div className="nd-form-group">
            <label>Chauffeur</label>
            <select className="nd-input nd-select" value={choix} onChange={e => setChoix(e.target.value)}>
              <option value="">— Choisir un chauffeur —</option>
              {chauffeurs.map(c => <option key={c.id} value={c.id}>{c.name || '—'} · {joli(c.telephone)} · ID {c.id}</option>)}
            </select>
            <small className="nd-cell-sub">Un chauffeur indépendant n'a qu'un véhicule : son ancien véhicule est détaché (il reste dans la liste).</small>
          </div>
        </>}
      </Modal>
    </div>
  );
}
