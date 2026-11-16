import { useState, useEffect, useMemo } from 'react';
import {
  apiLivraisons, apiTrajets, apiVehicules, apiReservations,
  apiNotifs, apiUsers, fmtDate, fmtDT, Audit, Auth, getBaseUrl, setBaseUrl
} from '../services/api';
import {
  StatusBadge, RoleBadge, Avatar, MiniCard, Modal,
  EmptyRow, LoadingRow, DetailRow
} from '../components/ui';
import { useToast } from '../context/AppContext';
import StatsLivraisons from '../components/StatsLivraisons';

/** Photos du colis (commande, retrait, remise), chargées avec le jeton de l'admin */
function PhotosColis({ id }) {
  const [photos, setPhotos] = useState(null);
  useEffect(() => {
    let urls = [];
    (async () => {
      try {
        const liste = await apiLivraisons.photos(id) || [];
        urls = await Promise.all(liste.map(async p => ({ ...p, src: await apiLivraisons.photo(p.url).catch(() => null) })));
        setPhotos(urls);
      } catch { setPhotos([]); }
    })();
    return () => urls.forEach(p => p.src && URL.revokeObjectURL(p.src));
  }, [id]);
  const ETAPES = { CLIENT: 'À la commande', RETRAIT: 'Au retrait', REMISE: 'À la remise' };
  if (photos === null) return <small className="nd-cell-sub">Chargement des photos…</small>;
  if (!photos.length) return <small className="nd-cell-sub">Aucune photo</small>;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {photos.map(p => (
        <a key={p.id} href={p.src || '#'} target="_blank" rel="noreferrer" style={{ textAlign: 'center', fontSize: 11 }}>
          {p.src ? <img src={p.src} alt={p.etape} style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10, display: 'block' }} /> : '—'}
          {ETAPES[p.etape] || p.etape}
        </a>
      ))}
    </div>
  );
}

/** Livraison (moto) ou Cargo (3 roues, fourgonnette, camion), comme le serveur */
const serviceLivraison = l => (l?.service || (['TROIS_ROUES','FOURGONNETTE','CAMION'].includes(String(l?.vehiculeType||'').toUpperCase()) ? 'CARGO' : 'LIVRAISON'));
const VEHICULES_LIVRAISON = { MOTO: '🏍 Moto', TROIS_ROUES: '🛺 Moto 3 roues', FOURGONNETTE: '🚐 Fourgonnette', CAMION: '🚚 Camion' };
const BadgeService = ({ l }) => serviceLivraison(l)==='CARGO'
  ? <span className="nd-badge" style={{background:'rgba(21,112,239,.12)',color:'#1570EF'}}>🚚 Cargo · {(VEHICULES_LIVRAISON[String(l.vehiculeType).toUpperCase()]||'').replace(/^\S+ /,'')}</span>
  : <span className="nd-badge" style={{background:'rgba(247,144,9,.12)',color:'#B54708'}}>📦 Livraison</span>;

// ─── LIVRAISONS ──────────────────────────────────────────────────
export function Livraisons() {
  const toast = useToast();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterService, setFilterService] = useState('');
  const [voirStats, setVoirStats] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setAll(await apiLivraisons.all()); }
    catch(e) { toast(e.message,'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = all.filter(l => {
    const q = search.toLowerCase();
    const mQ = !q || String(l.id).includes(q)||(l.departAdresse||'').toLowerCase().includes(q)||(l.destination||'').toLowerCase().includes(q);
    const mS = !filterStatus || l.status===filterStatus;
    const mV = !filterService || serviceLivraison(l)===filterService;
    return mQ && mS && mV;
  });

  const counts = {
    total:all.length, att:all.filter(l=>l.status==='EN_ATTENTE').length,
    cours:all.filter(l=>l.status==='EN_COURS').length, livrees:all.filter(l=>l.status==='LIVREE').length,
    ann:all.filter(l=>l.status==='ANNULEE').length
  };

  const showDetail = async id => {
    const base = all.find(l=>l.id===id) || {};
    try { const d = await apiLivraisons.detail(id); setDetailItem({ ...base, ...d }); }
    catch { setDetailItem(base); }
  };

  /** Annulation admin : statut ANNULEE, le client et le livreur sont notifiés. */
  const annuler = async l => {
    if (!window.confirm(`Annuler la livraison #${l.id} ? Le client${l.chauffeurId ? ' et le livreur seront prévenus' : ' sera prévenu'} par notification.`)) return;
    try {
      await apiLivraisons.annuler(l.id);
      toast(`Livraison #${l.id} annulée`,'success');
      Audit.log('ANNULER_LIVRAISON',`Livraison #${l.id} annulée par l'admin`);
      load();
    } catch(e) { toast(e.message,'error'); }
  };

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Gestion des Livraisons</h1>
          <p>{loading?'Chargement...':`${filtered.length} / ${all.length} livraison(s)`}</p>
        </div>
        <div className="nd-page-header-actions">
          <div className="nd-search-box"><span>🔍</span><input placeholder="Rechercher..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
          <select className="nd-input nd-select" style={{width:150}} value={filterService} onChange={e=>setFilterService(e.target.value)}>
            <option value="">Livraison + Cargo</option>
            <option value="LIVRAISON">📦 Livraison (moto)</option>
            <option value="CARGO">🚚 Cargo</option>
          </select>
          <select className="nd-input nd-select" style={{width:140}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="">Tous statuts</option>
            {['EN_ATTENTE','ACCEPTEE','EN_COURS','LIVREE','ANNULEE','EXPIREE'].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <button className={`nd-btn ${voirStats ? 'nd-btn-primary' : 'nd-btn-outline'}`} onClick={() => setVoirStats(v => !v)}>📊 Tableau de bord</button>
          <button className="nd-btn nd-btn-outline" onClick={load}>↺</button>
        </div>
      </div>
      {voirStats && <StatsLivraisons />}
      <div className="nd-mini-stats nd-mini-stats-5" style={{marginBottom:22}}>
        <MiniCard color="var(--nd-primary)" value={counts.total} label="Total"/>
        <MiniCard color="var(--nd-amber)"   value={counts.att}   label="En attente"/>
        <MiniCard color="var(--nd-blue)"    value={counts.cours} label="En cours"/>
        <MiniCard color="var(--nd-green)"   value={counts.livrees} label="Livrées"/>
        <MiniCard color="var(--nd-text-dim)"value={counts.ann}   label="Annulées"/>
      </div>
      <div className="nd-card"><div className="nd-card-body-p0"><div className="nd-table-wrap">
        <table className="nd-table">
          <thead><tr><th>#</th><th>Service</th><th>Départ</th><th>Destination</th><th>Colis</th><th>Client</th><th>Statut</th><th>Créé le</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <LoadingRow cols={9}/> : !filtered.length ? <EmptyRow cols={9} msg="Aucune livraison"/> :
              filtered.map(l => (
                <tr key={l.id}>
                  <td className="nd-table-id">#{l.id}</td>
                  <td><BadgeService l={l}/></td>
                  <td style={{maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}><small>{l.departAdresse||'—'}</small></td>
                  <td style={{maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}><small>{l.destination||'—'}</small></td>
                  <td><small>{serviceLivraison(l)==='CARGO' ? (l.descriptionColis||'Cargo') : (l.tailleColis||'—')}</small>{l.aideChargement && <div className="nd-cell-sub">🤝 aide au chargement</div>}</td>
                  <td><small className="nd-cell-sub">ID: {l.clientId||'—'}</small></td>
                  <td><StatusBadge status={l.status||'EN_ATTENTE'}/></td>
                  <td><small className="nd-cell-sub">{fmtDT(l.createdAt)}</small></td>
                  <td>
                    <div style={{display:'flex',gap:5}}>
                      <button className="nd-btn-icon info" onClick={()=>showDetail(l.id)} title="Détail">👁</button>
                      {!['LIVREE','ANNULEE','EXPIREE'].includes(l.status) &&
                        <button className="nd-btn-icon danger" onClick={()=>annuler(l)} title="Annuler la livraison">✕</button>}
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div></div></div>
      <Modal open={!!detailItem} title={`Détail Livraison #${detailItem?.id}`} onClose={()=>setDetailItem(null)}>
        {detailItem && [
          ['Retrait', detailItem.pickupAddress || detailItem.departAdresse],
          ['Livraison', detailItem.recipientAddress || detailItem.destination],
          ['Destinataire', [detailItem.recipientName, detailItem.recipientPhone].filter(Boolean).join(' · ')],
          ['Colis', [detailItem.packageDescription, detailItem.colisSize, detailItem.colisWeight && `${detailItem.colisWeight} kg`].filter(Boolean).join(' · ')],
          ['Client', detailItem.client ? `${detailItem.client.name} · ${detailItem.client.telephone}` : detailItem.clientId],
          ['Livreur', detailItem.chauffeur ? `${detailItem.chauffeur.name} · ${detailItem.chauffeur.telephone}` : (detailItem.chauffeurId || 'Aucun')],
          ['Service', <BadgeService l={detailItem}/>],
          ['Véhicule', VEHICULES_LIVRAISON[String(detailItem.vehiculeType||'MOTO').toUpperCase()] || detailItem.vehiculeType],
          ['Aide au chargement', serviceLivraison(detailItem)==='CARGO' ? (detailItem.aideChargement ? 'Oui' : 'Non') : null],
          ['Prix', detailItem.prix != null ? `${Number(detailItem.prix).toLocaleString('fr-FR')} FCFA`
            + (detailItem.prixAides ? ` (dont manutention ${Number(detailItem.prixAides).toLocaleString('fr-FR')} F)` : '')
            + (detailItem.fraisArrets ? ` (dont arrêts ${Number(detailItem.fraisArrets).toLocaleString('fr-FR')} F)` : '') : null],
          ['Manutentionnaires', detailItem.nombreAides ? `${detailItem.nombreAides}` : null],
          ['Programmée pour', detailItem.dateProgrammee ? fmtDT(detailItem.dateProgrammee) : null],
          ['Code de remise', detailItem.codeRemise ? `${detailItem.codeRemise} (donné au destinataire)` : null],
          ['Arrêts de la tournée', detailItem.arrets?.length ? (
            <div>{detailItem.arrets.map(a => (
              <div key={a.id}>{a.statut === 'LIVRE' ? '✅' : '⏳'} {a.ordre}. {a.adresse} — {a.nomDestinataire} {a.telephoneDestinataire}{a.codeRemise ? ` · code ${a.codeRemise}` : ''}</div>
            ))}</div>) : null],
          ['Paiement du destinataire', detailItem.paiementConfirme
            ? `Confirmé par le livreur (${{ ESPECE: 'espèces', WAVE: 'Wave', ORANGE_MONEY: 'Orange Money' }[detailItem.modePaiementRecu] || detailItem.modePaiementRecu})` : null],
          ['Photos du colis', <PhotosColis id={detailItem.id}/>],

          ['Colis récupéré', detailItem.colisRecupere ? 'Oui' : 'Non'],
          ['Statut', <StatusBadge status={detailItem.status}/>],
          ['Créée le', fmtDT(detailItem.createdAt)],
        ].map(([l,v]) => <DetailRow key={l} label={l} value={v || '—'}/>)}
      </Modal>
    </div>
  );
}

// ─── TRAJETS ──────────────────────────────────────────────────
export function Trajets() {
  const toast = useToast();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ chauffeurId:'',lieuDepart:'',lieuDestination:'',dateHeureDepart:'',nombrePlacesTotal:'',prixParPlace:'',statut:'ACTIF' });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [resasModal, setResasModal] = useState(false);
  const [resas, setResas] = useState([]);

  const load = async () => {
    setLoading(true);
    try { setAll(await apiTrajets.all()); }
    catch(e) { toast(e.message,'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = all.filter(t => {
    const q = search.toLowerCase();
    return !q || (t.lieuDepart||'').toLowerCase().includes(q)||(t.lieuDestination||'').toLowerCase().includes(q)||(t.nomChauffeur||'').toLowerCase().includes(q);
  });

  const openModal = (item=null) => {
    setEditId(item?.id||null); setErr('');
    if (item) setForm({ chauffeurId:item.chauffeurId||'',lieuDepart:item.lieuDepart||'',lieuDestination:item.lieuDestination||'',dateHeureDepart:item.dateHeureDepart||'',nombrePlacesTotal:item.nombrePlacesTotal||'',prixParPlace:item.prixParPlace||'',statut:item.statut||'ACTIF' });
    else setForm({ chauffeurId:'',lieuDepart:'',lieuDestination:'',dateHeureDepart:'',nombrePlacesTotal:'',prixParPlace:'',statut:'ACTIF' });
    setModal(true);
  };

  const submit = async () => {
    setErr(''); setSubmitting(true);
    try {
      const payload = { ...form, nombrePlacesTotal:Number(form.nombrePlacesTotal), prixParPlace:Number(form.prixParPlace) };
      if (editId) { await apiTrajets.update(editId, payload); toast('Trajet modifié','success'); }
      else { await apiTrajets.create(payload); toast('Trajet créé','success'); }
      Audit.log(editId?'UPDATE_TRAJET':'CREATE_TRAJET',`Trajet ${form.lieuDepart}→${form.lieuDestination}`);
      setModal(false); load();
    } catch(e) { setErr(e.message); }
    finally { setSubmitting(false); }
  };

  const del = async id => {
    if (!window.confirm('Supprimer ce trajet ?')) return;
    try { await apiTrajets.del(id); toast('Supprimé','success'); load(); }
    catch(e) { toast(e.message,'error'); }
  };

  const showResas = async id => {
    try { const r = await apiReservations.byTrajet(id); setResas(r||[]); setResasModal(true); }
    catch(e) { toast(e.message,'error'); }
  };

  const inp = (field,props={}) => <input {...props} className="nd-input" value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}/>;

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Gestion des Trajets</h1>
          <p>{loading?'Chargement...':`${filtered.length} / ${all.length} trajet(s)`}</p>
        </div>
        <div className="nd-page-header-actions">
          <div className="nd-search-box"><span>🔍</span><input placeholder="Départ, dest., chauffeur..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
          <button className="nd-btn nd-btn-outline" onClick={load}>↺</button>
          <button className="nd-btn nd-btn-primary" onClick={()=>openModal()}>+ Nouveau Trajet</button>
        </div>
      </div>
      <div className="nd-card"><div className="nd-card-body-p0"><div className="nd-table-wrap">
        <table className="nd-table">
          <thead><tr><th>#</th><th>Chauffeur</th><th>Départ</th><th>Destination</th><th>Date départ</th><th>Places</th><th>Prix/place</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {loading?<LoadingRow cols={9}/>:!filtered.length?<EmptyRow cols={9} msg="Aucun trajet"/>:
              filtered.map(t=>(
                <tr key={t.id}>
                  <td className="nd-table-id">#{t.id}</td>
                  <td><div className="nd-cell-name">{t.nomChauffeur||'—'}</div><div className="nd-cell-sub">{t.telephone||`ID: ${t.chauffeurId||'—'}`}</div></td>
                  <td><small>{t.lieuDepart||'—'}</small></td>
                  <td><small>{t.lieuDestination||'—'}</small></td>
                  <td><small className="nd-cell-sub">{fmtDT(t.dateHeureDepart)}</small></td>
                  <td><span style={{fontWeight:700,color:(t.nombrePlacesDisponibles||0)>0?'var(--nd-green)':'var(--nd-primary)'}}>{t.nombrePlacesDisponibles||0}</span><small style={{color:'var(--nd-text-dim)'}}>/{t.nombrePlacesTotal||0}</small></td>
                  <td><strong style={{color:'var(--nd-teal)'}}>{t.prixParPlace?t.prixParPlace+' F':'—'}</strong></td>
                  <td><StatusBadge status={t.statut||'ACTIF'}/></td>
                  <td><div style={{display:'flex',gap:5}}>
                    <button className="nd-btn-icon" onClick={()=>openModal(t)}>✏</button>
                    <button className="nd-btn-icon info" onClick={()=>showResas(t.id)}>📅</button>
                    <button className="nd-btn-icon danger" onClick={()=>del(t.id)}>🗑</button>
                  </div></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div></div></div>

      <Modal open={modal} title={editId?'Modifier Trajet':'Nouveau Trajet'} onClose={()=>setModal(false)}
        footer={<><button className="nd-btn nd-btn-outline" onClick={()=>setModal(false)}>Annuler</button>
          <button className="nd-btn nd-btn-primary" onClick={submit} disabled={submitting}>{submitting?<><div className="nd-spinner-sm"/>...</>:'Enregistrer'}</button></>}>
        {inp('chauffeurId',{placeholder:'ID du Chauffeur *'})}
        <div className="nd-form-row">
          {inp('lieuDepart',{placeholder:'Lieu de départ *'})}
          {inp('lieuDestination',{placeholder:'Destination *'})}
        </div>
        <div className="nd-form-group"><label>Date et heure de départ</label>{inp('dateHeureDepart',{type:'datetime-local'})}</div>
        <div className="nd-form-row">
          {inp('nombrePlacesTotal',{type:'number',placeholder:'Nb places',min:1})}
          {inp('prixParPlace',{type:'number',placeholder:'Prix/place FCFA',min:0})}
        </div>
        <select className="nd-input nd-select" value={form.statut} onChange={e=>setForm(f=>({...f,statut:e.target.value}))}>
          {['ACTIF','COMPLET','TERMINE','ANNULE'].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        {err && <div className="nd-alert nd-alert-danger">⚠ {err}</div>}
      </Modal>

      <Modal open={resasModal} title="Réservations du trajet" onClose={()=>setResasModal(false)}>
        {!resas.length ? <div style={{textAlign:'center',color:'var(--nd-text-dim)',padding:20}}>Aucune réservation</div> :
          resas.map(r=>(
            <div key={r.id} className="nd-detail-row">
              <span className="nd-detail-label">#{r.id} - Client {r.clientId}</span>
              <span><StatusBadge status={r.statut||'CONFIRMEE'}/></span>
            </div>
          ))
        }
      </Modal>
    </div>
  );
}

// ─── VEHICULES ──────────────────────────────────────────────────
export function Vehicules() {
  const toast = useToast();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const typeIcon = { VOITURE:'🚗',MOTO:'🏍',CAMION:'🚚',FOURGONNETTE:'🚐',TAXI:'🚕' };

  const load = async () => {
    setLoading(true);
    try { setAll(await apiVehicules.all()); }
    catch(e) { toast(e.message,'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = all.filter(v => {
    const q = search.toLowerCase();
    return !q || (v.marque||'').toLowerCase().includes(q)||(v.modele||'').toLowerCase().includes(q)||(v.immatriculation||'').toLowerCase().includes(q)||(v.type||'').toLowerCase().includes(q);
  });

  const getIcon = t => {
    const k = Object.keys(typeIcon).find(k=>(t||'').toUpperCase().includes(k));
    return typeIcon[k]||'🚘';
  };

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Gestion des Véhicules</h1>
          <p>{loading?'Chargement...':`${filtered.length} / ${all.length} véhicule(s)`}</p>
        </div>
        <div className="nd-page-header-actions">
          <div className="nd-search-box"><span>🔍</span><input placeholder="Marque, modèle, immat..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
          <button className="nd-btn nd-btn-outline" onClick={load}>↺</button>
        </div>
      </div>
      <div className="nd-card"><div className="nd-card-body-p0"><div className="nd-table-wrap">
        <table className="nd-table">
          <thead><tr><th>#</th><th>Type</th><th>Marque / Modèle</th><th>Couleur</th><th>Immat.</th><th>Propriétaire</th><th>Enregistré le</th></tr></thead>
          <tbody>
            {loading?<LoadingRow cols={7}/>:!filtered.length?<EmptyRow cols={7} msg="Aucun véhicule"/>:
              filtered.map(v=>(
                <tr key={v.id}>
                  <td className="nd-table-id">#{v.id}</td>
                  <td><span style={{fontSize:22}}>{getIcon(v.type)}</span> <small>{v.type||'—'}</small></td>
                  <td><div className="nd-cell-name">{v.marque||'—'}</div><div className="nd-cell-sub">{v.modele||'—'}</div></td>
                  <td><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:18,height:18,borderRadius:'50%',background:v.couleur||'#64748b',border:'1px solid rgba(255,255,255,.2)'}}/><small>{v.couleur||'—'}</small></div></td>
                  <td><code style={{background:'var(--nd-surface2)',padding:'3px 8px',borderRadius:6,fontSize:12}}>{v.immatriculation||'—'}</code></td>
                  <td><small className="nd-cell-sub">ID: {v.userId||v.chauffeurId||'—'}</small></td>
                  <td><small className="nd-cell-sub">{fmtDate(v.createdAt)}</small></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div></div></div>
    </div>
  );
}

// ─── RESERVATIONS ──────────────────────────────────────────────────
export function Reservations() {
  const toast = useToast();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const ts = await apiTrajets.all();
      const all2 = [];
      for (const t of ts.slice(0,20)) {
        try {
          const resas = await apiReservations.byTrajet(t.id);
          (resas||[]).forEach(r => all2.push({ ...r, _trajet:t }));
        } catch {}
      }
      setAll(all2);
    } catch(e) { toast(e.message,'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const del = async id => {
    if (!window.confirm('Supprimer cette réservation ?')) return;
    try { await apiReservations.del(id); toast('Supprimé','success'); load(); }
    catch(e) { toast(e.message,'error'); }
  };

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Gestion des Réservations</h1>
          <p>{loading?'Chargement...':`${all.length} réservation(s)`}</p>
        </div>
        <div className="nd-page-header-actions">
          <button className="nd-btn nd-btn-outline" onClick={load}>↺</button>
        </div>
      </div>
      <div className="nd-card"><div className="nd-card-body-p0"><div className="nd-table-wrap">
        <table className="nd-table">
          <thead><tr><th>#Resa</th><th>Client</th><th>Trajet</th><th>Départ → Dest.</th><th>Date départ</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {loading?<LoadingRow cols={7}/>:!all.length?<EmptyRow cols={7} msg="Aucune réservation"/>:
              all.map(r=>(
                <tr key={r.id}>
                  <td className="nd-table-id">#{r.id}</td>
                  <td><small>ID: {r.clientId||'—'}</small></td>
                  <td><small className="nd-table-id">T#{r.trajetId||r._trajet?.id||'—'}</small></td>
                  <td><small>{r._trajet?.lieuDepart||'—'} → {r._trajet?.lieuDestination||'—'}</small></td>
                  <td><small className="nd-cell-sub">{fmtDT(r._trajet?.dateHeureDepart)}</small></td>
                  <td><StatusBadge status={r.statut||'CONFIRMEE'}/></td>
                  <td><button className="nd-btn-icon danger" onClick={()=>del(r.id)}>🗑</button></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div></div></div>
    </div>
  );
}

// ─── NOTIFICATIONS ──────────────────────────────────────────────────
export function Notifications() {
  const toast = useToast();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const [userType, setUserType] = useState('CLIENT');

  const load = async () => {
    if (!userId) { toast('Entrez un ID utilisateur','warning'); return; }
    setLoading(true);
    try { setNotifs(await apiNotifs.get(userId, userType)); }
    catch(e) { toast(e.message,'error'); }
    finally { setLoading(false); }
  };

  const markAllRead = async () => {
    if (!userId) return;
    try { await apiNotifs.markAllRead(userId, userType); toast('Toutes marquées comme lues','success'); load(); }
    catch(e) { toast(e.message,'error'); }
  };

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left"><h1>Notifications</h1></div>
      </div>
      <div className="nd-card" style={{marginBottom:20}}>
        <div className="nd-card-body">
          <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
            <div className="nd-form-group" style={{flex:1}}>
              <label>ID Utilisateur</label>
              <input className="nd-input" placeholder="Ex: 12" value={userId} onChange={e=>setUserId(e.target.value)}/>
            </div>
            <div className="nd-form-group" style={{width:140}}>
              <label>Type</label>
              <select className="nd-input nd-select" value={userType} onChange={e=>setUserType(e.target.value)}>
                <option value="CLIENT">Client</option>
                <option value="CHAUFFEUR">Chauffeur</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <button className="nd-btn nd-btn-primary" onClick={load}>Charger</button>
            {notifs.length>0 && <button className="nd-btn nd-btn-outline" onClick={markAllRead}>Tout marquer lu</button>}
          </div>
        </div>
      </div>
      {loading ? <div style={{textAlign:'center',padding:40}}><div className="nd-spinner"/></div> :
        <div className="nd-card"><div className="nd-card-body">
          {!notifs.length ? <div style={{textAlign:'center',color:'var(--nd-text-dim)',padding:30}}>
            {userId?'Aucune notification trouvée':'Entrez un ID utilisateur et cliquez sur Charger'}
          </div> :
            notifs.map(n=>(
              <div key={n.id} className="nd-activity-item" style={{opacity:n.lue?0.5:1}}>
                <div className="nd-activity-icon" style={{background:n.lue?'rgba(100,116,139,.1)':'rgba(230,57,70,.15)',color:n.lue?'#64748b':'#e63946',fontSize:20}}>
                  {n.lue?'📭':'🔔'}
                </div>
                <div>
                  <div className="nd-activity-text"><strong>{n.titre||n.title||'Notification'}</strong></div>
                  <div style={{fontSize:12,color:'var(--nd-text-muted)',marginTop:2}}>{n.message||n.contenu||'—'}</div>
                  <div className="nd-activity-time">{fmtDT(n.createdAt||n.dateCreation)} {n.lue && '· Lu'}</div>
                </div>
              </div>
            ))
          }
        </div></div>
      }
    </div>
  );
}

// ─── ADMINS ──────────────────────────────────────────────────
export function Admins() {
  const toast = useToast();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name:'',email:'',password:'',role:'ADMIN' });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    try { setAll(await apiUsers.admins()); }
    catch(e) { toast(e.message,'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const del = async id => {
    if (!window.confirm('Supprimer cet admin ?')) return;
    try { await apiUsers.del(id); toast('Supprimé','success'); load(); }
    catch(e) { toast(e.message,'error'); }
  };

  const submit = async () => {
    setErr(''); setSubmitting(true);
    try {
      await apiUsers.registerAdmin(form);
      toast('Admin créé','success'); Audit.log('CREATE_ADMIN',`Admin ${form.email} créé`);
      setModal(false); load();
    } catch(e) { setErr(e.message); }
    finally { setSubmitting(false); }
  };

  const inp = (field,props={}) => <input {...props} className="nd-input" value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}/>;

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Administrateurs</h1>
          <p>{loading?'Chargement...':`${all.length} admin(s)`}</p>
        </div>
        <div className="nd-page-header-actions">
          <button className="nd-btn nd-btn-outline" onClick={load}>↺</button>
          <button className="nd-btn nd-btn-primary" onClick={()=>{setErr('');setForm({name:'',email:'',password:'',role:'ADMIN'});setModal(true);}}>+ Nouvel Admin</button>
        </div>
      </div>
      <div className="nd-card"><div className="nd-card-body-p0"><div className="nd-table-wrap">
        <table className="nd-table">
          <thead><tr><th>#</th><th>Admin</th><th>Email</th><th>Rôle</th><th>Inscrit le</th><th>Actions</th></tr></thead>
          <tbody>
            {loading?<LoadingRow cols={6}/>:!all.length?<EmptyRow cols={6} msg="Aucun admin"/>:
              all.map(a=>(
                <tr key={a.id}>
                  <td className="nd-table-id">#{a.id}</td>
                  <td><div className="nd-cell-user"><Avatar name={a.name||a.email||'A'} size={32}/><div className="nd-cell-name">{a.name||a.email||'—'}</div></div></td>
                  <td><small>{a.email||'—'}</small></td>
                  <td><RoleBadge role={a.role}/></td>
                  <td><small className="nd-cell-sub">{fmtDate(a.dateInscription||a.createdAt)}</small></td>
                  <td>
                    {a.id !== Auth.user()?.id && (
                      <button className="nd-btn-icon danger" onClick={()=>del(a.id)}>🗑</button>
                    )}
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div></div></div>

      <Modal open={modal} title="Nouvel Administrateur" onClose={()=>setModal(false)}
        footer={<><button className="nd-btn nd-btn-outline" onClick={()=>setModal(false)}>Annuler</button>
          <button className="nd-btn nd-btn-primary" onClick={submit} disabled={submitting}>{submitting?<><div className="nd-spinner-sm"/>...</>:'Créer'}</button></>}>
        {inp('name',{placeholder:'Nom complet *'})}
        {inp('email',{type:'email',placeholder:'Email *'})}
        {inp('password',{type:'password',placeholder:'Mot de passe *'})}
        <select className="nd-input nd-select" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
          {['ADMIN','ADMIN1','ADMIN2','MODERATEUR','SUPER_ADMIN'].map(r=><option key={r} value={r}>{r}</option>)}
        </select>
        {err && <div className="nd-alert nd-alert-danger">⚠ {err}</div>}
      </Modal>
    </div>
  );
}

// ─── AUDIT LOG ──────────────────────────────────────────────────
// Calqué fidèlement sur journal.png : header info, filtres search+select×3, tableau DATE/UTILISATEUR/ACTION/MODULE/DÉTAILS/IP/STATUT
const ACTION_COLORS = {
  CREATE:'var(--nd-blue)', UPDATE:'var(--nd-amber)', DELETE:'var(--nd-primary)',
  LOGIN:'var(--nd-green)', VIEW:'var(--nd-teal)', DASHBOARD:'var(--nd-purple)'
};
const getActionColor = action => ACTION_COLORS[(action||'').split('_')[0]] || 'var(--nd-text-dim)';

export function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [filterStatut, setFilterStatut] = useState('');

  const load = () => setLogs(Audit.all());
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => logs.filter(l => {
    const q = search.toLowerCase();
    const mQ = !q || (l.action||'').toLowerCase().includes(q)||(l.details||'').toLowerCase().includes(q)||(l.admin||'').toLowerCase().includes(q);
    const mA = !filterAction || (l.action||'').startsWith(filterAction);
    const mM = !filterModule || (l.details||'').toLowerCase().includes(filterModule.toLowerCase());
    const mS = !filterStatut || filterStatut === 'success';
    return mQ && mA && mM && mS;
  }), [logs, search, filterAction, filterModule, filterStatut]);

  const clear = () => {
    if (!window.confirm('Effacer tout le journal ?')) return;
    Audit.clear(); load();
  };

  const user = Auth.user();

  return (
    <div className="fade-in">
      {/* En-tête page */}
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Journal d'Audit</h1>
          <p>Consulter l'historique des actions et modifications dans le système</p>
        </div>
        <div className="nd-page-header-actions">
          <button className="nd-btn nd-btn-outline" onClick={load}>↺ Actualiser</button>
          {logs.length > 0 && (
            <button className="nd-btn nd-btn-outline" style={{color:'var(--nd-primary)',borderColor:'var(--nd-primary)'}} onClick={clear}>
              🗑 Effacer
            </button>
          )}
        </div>
      </div>

      {/* Bannière info — comme dans journal.png */}
      <div className="nd-card" style={{marginBottom:20}}>
        <div className="nd-card-body" style={{display:'flex',alignItems:'center',gap:14,padding:'14px 20px'}}>
          <div style={{
            width:42, height:42, borderRadius:10,
            background:'rgba(34,197,94,.12)', display:'flex',
            alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0
          }}>📄</div>
          <div>
            <div style={{fontWeight:700,fontSize:14}}>Historique des activités</div>
            <div style={{fontSize:12,color:'var(--nd-text-muted)',marginTop:2}}>
              Traçabilité complète des opérations effectuées par les utilisateurs
            </div>
          </div>
        </div>
      </div>

      {/* Tableau principal */}
      <div className="nd-card">
        {/* Header avec titre + boutons */}
        <div className="nd-card-header" style={{flexWrap:'wrap',gap:10}}>
          <div>
            <div className="nd-card-title">Journal d'Audit</div>
            <div style={{fontSize:12,color:'var(--nd-text-muted)',marginTop:2}}>
              Historique des actions et événements du système
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="nd-btn nd-btn-outline nd-btn-sm">⊞ Filtres Avancés</button>
            <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={load}>↺ Actualiser</button>
            <button className="nd-btn nd-btn-outline nd-btn-sm">⬇ Exporter</button>
          </div>
        </div>

        {/* Filtres — exactement comme journal.png */}
        <div style={{
          padding:'14px 20px', borderBottom:'1px solid var(--nd-border)',
          display:'flex', gap:10, flexWrap:'wrap', alignItems:'center'
        }}>
          <div className="nd-search-box" style={{flex:1,minWidth:200}}>
            <span>🔍</span>
            <input
              placeholder="Rechercher par utilisateur, action, détails..."
              value={search} onChange={e=>setSearch(e.target.value)}
            />
          </div>
          <select className="nd-input nd-select" style={{width:130}}
            value={filterAction} onChange={e=>setFilterAction(e.target.value)}>
            <option value="">Tous</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="LOGIN">LOGIN</option>
            <option value="VIEW">VIEW</option>
          </select>
          <select className="nd-input nd-select" style={{width:130}}
            value={filterModule} onChange={e=>setFilterModule(e.target.value)}>
            <option value="">Tous</option>
            <option value="Système">Système</option>
            <option value="Chauffeur">Chauffeurs</option>
            <option value="Client">Clients</option>
            <option value="Commande">Commandes</option>
          </select>
          <select className="nd-input nd-select" style={{width:130}}
            value={filterStatut} onChange={e=>setFilterStatut(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="success">Succès</option>
          </select>
        </div>

        {/* Tableau — colonnes: DATE/HEURE · UTILISATEUR · ACTION · MODULE · DÉTAILS · ADRESSE IP · STATUT */}
        <div className="nd-table-wrap">
          <table className="nd-table">
            <thead>
              <tr>
                <th>DATE / HEURE</th>
                <th>UTILISATEUR</th>
                <th>ACTION</th>
                <th>MODULE</th>
                <th>DÉTAILS</th>
                <th>ADRESSE IP</th>
                <th>STATUT</th>
              </tr>
            </thead>
            <tbody>
              {!filtered.length ? (
                <tr><td colSpan={7} style={{textAlign:'center',padding:30,color:'var(--nd-text-dim)'}}>
                  {logs.length===0 ? "Aucune entrée d'audit. Les actions effectuées apparaîtront ici." : 'Aucun résultat pour ces filtres.'}
                </td></tr>
              ) : filtered.map(l => (
                <tr key={l.id}>
                  <td>
                    <div style={{fontSize:12,fontWeight:500}}>{fmtDate(l.at)}</div>
                    <div style={{fontSize:11,color:'var(--nd-text-dim)'}}>{l.at ? new Date(l.at).toLocaleTimeString('fr-FR') : '—'}</div>
                  </td>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{
                        width:30, height:30, borderRadius:'50%',
                        background:'var(--nd-green)', color:'#fff',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontWeight:700, fontSize:12, flexShrink:0
                      }}>
                        {(l.admin||'A')[0].toUpperCase()}
                      </div>
                      <span style={{fontSize:13}}>{l.admin||'—'}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{color:getActionColor(l.action),fontWeight:600,fontSize:12}}>
                      {(l.action||'—').split('_')[0]}
                    </span>
                  </td>
                  <td><small style={{color:'var(--nd-text-muted)'}}>
                    {(l.details||'').includes('Trajet') ? 'Trajets' :
                     (l.details||'').includes('Admin') ? 'Admins' :
                     (l.details||'').includes('Chauffeur') ? 'Chauffeurs' :
                     (l.details||'').includes('Client') ? 'Clients' :
                     (l.details||'').includes('Commande') ? 'Commandes' : 'Système'}
                  </small></td>
                  <td style={{maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    <small>{l.details||'—'}</small>
                  </td>
                  <td>
                    <span style={{fontSize:12,color:'var(--nd-text-muted)'}}>🌐 0.0.0.0</span>
                  </td>
                  <td>
                    <span style={{
                      display:'inline-flex',alignItems:'center',gap:5,
                      padding:'3px 9px',borderRadius:20,
                      fontSize:11,fontWeight:600,
                      background:'rgba(34,197,94,.12)',color:'var(--nd-green)'
                    }}>✓ Succès</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── RAPPORTS & ANALYSES ──────────────────────────────────────────────────
// Calqué fidèlement sur rapport.png
const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

export function Rapports() {
  const [activeTab, setActiveTab] = useState('cotisations');
  const [annee, setAnnee] = useState('2026');

  // Données mock — à remplacer par appels API
  const stats = { cotisations:82, pensions:0, adherents:82, demissions:0 };
  const mensuel = [0,0,82,0,0,0,0,0,0,0,0,0];
  const montants = [0,0,1720000,0,0,0,0,0,0,0,0,0];
  const maxMensuel = Math.max(...mensuel, 1);

  const TABS = [
    { id:'cotisations', label:'Cotisations' },
    { id:'pensions',    label:'Pensions' },
    { id:'adhesions',   label:'Adhésions' },
    { id:'analyses',    label:'Analyses & Ratios' },
    { id:'annuel',      label:'Rapport Annuel' },
    { id:'adhoc',       label:'Rapport Ad Hoc' },
  ];

  return (
    <div className="fade-in">
      {/* Header — exactement comme rapport.png */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:42,height:42,borderRadius:10,background:'rgba(34,197,94,.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>📊</div>
          <div>
            <h2 style={{fontFamily:'var(--nd-font-display)',fontWeight:700,fontSize:18}}>Rapports &amp; Analyses</h2>
            <p style={{fontSize:12,color:'var(--nd-text-muted)',marginTop:2}}>Rapports standard, analyses et rapports personnalisés</p>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:13,color:'var(--nd-text-muted)'}}>Annee :</span>
          <select className="nd-input nd-select" style={{width:90}} value={annee} onChange={e=>setAnnee(e.target.value)}>
            <option>2026</option><option>2025</option><option>2024</option>
          </select>
          <button className="nd-btn nd-btn-outline">↺ Rafraîchir</button>
        </div>
      </div>

      {/* Onglets — style de rapport.png (ligne verte soulignée) */}
      <div style={{display:'flex',borderBottom:'1px solid var(--nd-border)',marginBottom:22,gap:0}}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
            padding:'10px 18px', border:'none', background:'none',
            color: activeTab===t.id ? 'var(--nd-teal)' : 'var(--nd-text-muted)',
            fontWeight: activeTab===t.id ? 600 : 400,
            fontSize:13, cursor:'pointer',
            borderBottom: activeTab===t.id ? '2px solid var(--nd-teal)' : '2px solid transparent',
            fontFamily:'var(--nd-font)', transition:'.15s', whiteSpace:'nowrap'
          }}>{t.label}</button>
        ))}
      </div>

      {/* Résumé rapide — "Cotisations: 82 · Pensions: 0 · Adherents: 82 · Demissions: 0" */}
      <div style={{fontSize:13,color:'var(--nd-text-muted)',marginBottom:20,display:'flex',gap:16,flexWrap:'wrap'}}>
        <span>Cotisations: <strong style={{color:'var(--nd-text)'}}>{stats.cotisations}</strong></span>
        <span style={{color:'var(--nd-border)'}}>•</span>
        <span>Pensions: <strong style={{color:'var(--nd-text)'}}>{stats.pensions}</strong></span>
        <span style={{color:'var(--nd-border)'}}>•</span>
        <span>Adherents: <strong style={{color:'var(--nd-text)'}}>{stats.adherents}</strong></span>
        <span style={{color:'var(--nd-border)'}}>•</span>
        <span>Demissions: <strong style={{color:'var(--nd-text)'}}>{stats.demissions}</strong></span>
      </div>

      {/* ── COTISATIONS ── */}
      {activeTab === 'cotisations' && (
        <>
          {/* Titre + boutons Imprimer/Exporter — rapport.png */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18,flexWrap:'wrap',gap:10}}>
            <h3 style={{fontFamily:'var(--nd-font-display)',fontWeight:700,fontSize:15}}>
              Rapport mensuel des cotisations - {annee}
            </h3>
            <div style={{display:'flex',gap:10}}>
              <button className="nd-btn nd-btn-outline">🖨 Imprimer</button>
              <button className="nd-btn nd-btn-primary" style={{background:'var(--nd-teal)',borderColor:'var(--nd-teal)'}}>⬇ Exporter</button>
            </div>
          </div>

          {/* 4 stat cards — rapport.png */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:24}}>
            {[
              { icon:'$', val:'1 720 000 F CFA', label:'Total des cotisations', color:'var(--nd-teal)' },
              { icon:'💳', val:'82', label:'Nombre de cotisations', color:'var(--nd-blue)' },
              { icon:'📈', val:'100.0%', label:'Taux de collecte', color:'var(--nd-amber)' },
              { icon:'👥', val:'0', label:'En attente de paiement', color:'var(--nd-text-muted)' },
            ].map((s,i) => (
              <div key={i} style={{
                background:'var(--nd-surface)',border:'1px solid var(--nd-border)',
                borderRadius:12,padding:'20px 22px'
              }}>
                <div style={{fontSize:22,marginBottom:10,color:s.color}}>{s.icon}</div>
                <div style={{fontSize:24,fontWeight:800,fontFamily:'var(--nd-font-display)',marginBottom:4}}>{s.val}</div>
                <div style={{fontSize:12,color:'var(--nd-text-muted)'}}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            {/* Evolution mensuelle — rapport.png */}
            <div className="nd-card">
              <div className="nd-card-header"><span className="nd-card-title">Evolution mensuelle</span></div>
              <div className="nd-card-body">
                {MOIS.map((m,i) => (
                  <div key={m} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                    <span style={{fontSize:12,color:'var(--nd-text-muted)',width:28,flexShrink:0}}>{m}</span>
                    <div style={{flex:1,height:10,background:'var(--nd-surface2)',borderRadius:5,overflow:'hidden',position:'relative'}}>
                      <div style={{
                        width:`${(mensuel[i]/maxMensuel)*100}%`,
                        height:'100%',background:'var(--nd-teal)',
                        borderRadius:5,transition:'width 1s ease',
                        display:'flex',alignItems:'center',paddingLeft:6
                      }}>
                        {mensuel[i]>0 && (
                          <span style={{fontSize:10,color:'#fff',fontWeight:600,whiteSpace:'nowrap'}}>
                            {(montants[i]/1000).toFixed(0)}k F CFA
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{fontSize:12,color:'var(--nd-text-muted)',width:20,textAlign:'right'}}>{mensuel[i]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Répartition par catégorie — rapport.png */}
            <div className="nd-card">
              <div className="nd-card-header"><span className="nd-card-title">Repartition par categorie</span></div>
              <div className="nd-card-body">
                {[
                  { nom:'Non défini', pct:100, montant:'1 720 000 F CFA', count:82, color:'var(--nd-teal)' },
                  { nom:'VOITURE_COURSE', pct:0, montant:'0 F CFA', count:0, color:'var(--nd-blue)' },
                  { nom:'MOTO_2_ROUES',   pct:0, montant:'0 F CFA', count:0, color:'var(--nd-amber)' },
                  { nom:'CAMION',         pct:0, montant:'0 F CFA', count:0, color:'var(--nd-purple)' },
                ].map((c,i) => (
                  <div key={i} style={{marginBottom:16}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                      <span style={{fontSize:13,fontWeight:500}}>{c.nom}</span>
                      <span style={{fontSize:13,fontWeight:700,color:c.color}}>{c.pct.toFixed(1)}%</span>
                    </div>
                    <div style={{height:6,background:'var(--nd-surface2)',borderRadius:3,overflow:'hidden',marginBottom:4}}>
                      <div style={{width:`${c.pct}%`,height:'100%',background:c.color,borderRadius:3}}/>
                    </div>
                    <div style={{fontSize:11,color:'var(--nd-text-dim)'}}>{c.montant} – {c.count} cotisations</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── PENSIONS ── */}
      {activeTab === 'pensions' && (
        <div className="nd-card"><div className="nd-card-body" style={{textAlign:'center',padding:'50px 20px',color:'var(--nd-text-dim)'}}>
          📭 Aucune pension active pour cette période
        </div></div>
      )}

      {/* ── ADHÉSIONS ── */}
      {activeTab === 'adhesions' && (
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:20}}>
            {[
              {val:'82',label:'Total adhérents',color:'var(--nd-blue)'},
              {val:'82',label:'Actifs',color:'var(--nd-green)'},
              {val:'0', label:'Retraités',color:'var(--nd-amber)'},
              {val:'100%',label:"Taux d'activité",color:'var(--nd-teal)'},
            ].map((s,i)=>(
              <div key={i} style={{background:'var(--nd-surface)',border:'1px solid var(--nd-border)',borderRadius:12,padding:'18px 20px',borderTop:`3px solid ${s.color}`}}>
                <div style={{fontSize:22,fontWeight:800,fontFamily:'var(--nd-font-display)',color:s.color,marginBottom:4}}>{s.val}</div>
                <div style={{fontSize:12,color:'var(--nd-text-muted)'}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div className="nd-card"><div className="nd-card-body" style={{padding:'40px 20px',textAlign:'center',color:'var(--nd-text-dim)'}}>
            82 adhérents enregistrés en mars {annee}
          </div></div>
        </>
      )}

      {/* ── ANALYSES & RATIOS ── */}
      {activeTab === 'analyses' && (
        <div className="nd-card"><div className="nd-card-body">
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
            {[
              {label:'Ratio Actifs/Retraités',val:'0.00',color:'var(--nd-primary)'},
              {label:'Ratio Cotisations/Pensions',val:'0.00',color:'var(--nd-amber)'},
              {label:'Âge moyen départ',val:'—',color:'var(--nd-cyan)'},
              {label:'Taux de couverture',val:'0.0%',color:'var(--nd-green)'},
            ].map((s,i)=>(
              <div key={i} style={{background:'var(--nd-surface2)',borderRadius:10,padding:'14px 16px',textAlign:'center'}}>
                <div style={{fontSize:22,fontWeight:800,fontFamily:'var(--nd-font-display)',color:s.color}}>{s.val}</div>
                <div style={{fontSize:11,color:'var(--nd-text-muted)',marginTop:4}}>{s.label}</div>
              </div>
            ))}
          </div>
          <p style={{fontSize:13,color:'var(--nd-text-muted)',lineHeight:1.7}}>
            Les indicateurs actuariels seront disponibles dès l'enregistrement de premiers retraités dans le système.
          </p>
        </div></div>
      )}

      {/* ── RAPPORT ANNUEL ── */}
      {activeTab === 'annuel' && (
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:20}}>
            {[
              {val:'1 720 000 F',label:`Total cotisations ${annee}`,color:'var(--nd-teal)'},
              {val:'0 F',label:`Total pensions ${annee}`,color:'var(--nd-purple)'},
              {val:'82',label:`Adhérents ${annee}`,color:'var(--nd-blue)'},
              {val:'+82',label:'Nouvelles adhésions',color:'var(--nd-green)'},
            ].map((s,i)=>(
              <div key={i} style={{background:'var(--nd-surface)',border:'1px solid var(--nd-border)',borderRadius:12,padding:'18px 20px',borderTop:`3px solid ${s.color}`}}>
                <div style={{fontSize:20,fontWeight:800,fontFamily:'var(--nd-font-display)',color:s.color,marginBottom:4}}>{s.val}</div>
                <div style={{fontSize:12,color:'var(--nd-text-muted)'}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div className="nd-card">
            <div className="nd-card-header">
              <span className="nd-card-title">Rapport Annuel {annee}</span>
              <button className="nd-btn nd-btn-primary nd-btn-sm" style={{background:'var(--nd-teal)',borderColor:'var(--nd-teal)'}}>⬇ Télécharger PDF</button>
            </div>
            <div className="nd-card-body" style={{color:'var(--nd-text-muted)',fontSize:13,lineHeight:1.8}}>
              Ce rapport consolidé présente l'ensemble des activités du système pour l'année {annee}.
              Les données sont mises à jour en temps réel à partir des modules Cotisations, Pensions et Adhésions.
            </div>
          </div>
        </>
      )}

      {/* ── AD HOC ── */}
      {activeTab === 'adhoc' && (
        <div className="nd-card"><div className="nd-card-body" style={{textAlign:'center',padding:'50px 20px',color:'var(--nd-text-dim)'}}>
          🔧 Rapport personnalisé — Fonctionnalité à venir
        </div></div>
      )}
    </div>
  );
}

// ─── AIDE & SUPPORT ──────────────────────────────────────────────────
// Calqué fidèlement sur aide.png
const FAQ_ITEMS = [
  { q:'Comment modifier mon mot de passe ?', a:"Paramètres > Sécurité > Changer le mot de passe. Au moins 8 caractères, une majuscule, un chiffre et un caractère spécial." },
  { q:'Comment ajouter un nouveau chauffeur ?', a:"Section Chauffeurs > + Nouveau Chauffeur. Remplissez le formulaire (prénom, nom, téléphone, type de service, numéro de permis)." },
  { q:'Comment exporter les données ?', a:"Bouton \"Exporter\" en haut à droite de la page Rapports. Les données peuvent être exportées en CSV ou PDF." },
  { q:'Comment gérer les notifications ?', a:"Onglet Notifications > saisir l'ID utilisateur et le type (Client/Chauffeur/Admin) > Charger." },
  { q:'Quels sont les rôles disponibles ?', a:"5 rôles : SUPER_ADMIN, ADMIN, ADMIN1, ADMIN2 et MODERATEUR, chacun avec des permissions différentes." },
  { q:"Comment configurer l'URL du backend ?", a:"Paramètres > Connexion Backend > entrer l'URL Spring Boot (ex: http://localhost:8080) > Sauvegarder." },
];

function FaqAccordion({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{border:'1px solid var(--nd-border)',borderRadius:10,marginBottom:8,overflow:'hidden'}}>
      <div onClick={()=>setOpen(!open)} style={{
        display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'12px 16px',cursor:'pointer',fontWeight:500,fontSize:13,
        background:open?'var(--nd-surface2)':'transparent',transition:'.15s'
      }}>
        <span>{q}</span>
        <span style={{color:'var(--nd-text-dim)',fontSize:11,transform:open?'rotate(180deg)':'rotate(0deg)',transition:'transform .3s'}}>▼</span>
      </div>
      {open && <div style={{padding:'0 16px 14px',fontSize:13,color:'var(--nd-text-muted)',lineHeight:1.7}}>{a}</div>}
    </div>
  );
}

export function Aide() {
  const [activeTab, setActiveTab] = useState('recherche');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="fade-in">
      {/* Header — comme aide.png */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:22}}>
        <div style={{width:42,height:42,borderRadius:10,background:'rgba(42,157,143,.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>❓</div>
        <div>
          <h2 style={{fontFamily:'var(--nd-font-display)',fontWeight:700,fontSize:18}}>Centre d'aide et Support</h2>
          <p style={{fontSize:12,color:'var(--nd-text-muted)',marginTop:2}}>Documents, FAQ, guides et assistance</p>
        </div>
      </div>

      {/* Tabs — style aide.png */}
      <div style={{display:'flex',borderBottom:'1px solid var(--nd-border)',marginBottom:22}}>
        {[
          {id:'recherche',label:'🔍 Recherche'},
          {id:'faq',label:'💬 FAQ'},
          {id:'guide',label:'📖 Guide d\'utilisation'},
        ].map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
            padding:'10px 18px',border:'none',background:'none',
            color:activeTab===t.id?'var(--nd-teal)':'var(--nd-text-muted)',
            fontWeight:activeTab===t.id?600:400,fontSize:13,cursor:'pointer',
            borderBottom:activeTab===t.id?'2px solid var(--nd-teal)':'2px solid transparent',
            fontFamily:'var(--nd-font)',transition:'.15s'
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── RECHERCHE ── */}
      {activeTab === 'recherche' && (
        <>
          {/* Bannière verte — aide.png */}
          <div style={{
            background:'var(--nd-teal)',borderRadius:12,
            padding:'30px 32px',marginBottom:22,
            position:'relative',overflow:'hidden'
          }}>
            <div style={{position:'absolute',right:20,top:'50%',transform:'translateY(-50%)',fontSize:80,opacity:.08}}>❓</div>
            <h3 style={{color:'#fff',fontSize:18,fontWeight:700,marginBottom:6}}>Rechercher dans le Centre d'Aide</h3>
            <p style={{color:'rgba(255,255,255,.8)',fontSize:13,marginBottom:16}}>
              Trouvez rapidement des réponses dans les FAQ, documents et questions de la communauté.
            </p>
            <div style={{
              display:'flex',alignItems:'center',gap:10,
              background:'rgba(255,255,255,.2)',borderRadius:8,
              padding:'10px 14px',border:'1px solid rgba(255,255,255,.3)'
            }}>
              <span style={{color:'rgba(255,255,255,.7)',fontSize:16}}>🔍</span>
              <input
                style={{background:'none',border:'none',outline:'none',color:'#fff',fontSize:13,flex:1,fontFamily:'var(--nd-font)'}}
                placeholder="Tapez votre recherche (min. 2 caractères)..."
                value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            {/* Recherches populaires — aide.png */}
            <div className="nd-card">
              <div className="nd-card-header"><span className="nd-card-title" style={{color:'var(--nd-teal)'}}>⏱ Recherches populaires</span></div>
              <div className="nd-card-body">
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {['pension','cotisation','retraite','avance','mot de passe','simulation','beneficiaire','assurance','paiement','compte'].map(t=>(
                    <span key={t} onClick={()=>setSearchQuery(t)} style={{
                      background:'var(--nd-surface2)',border:'1px solid var(--nd-border)',
                      borderRadius:20,padding:'5px 12px',fontSize:12,
                      color:'var(--nd-text-muted)',cursor:'pointer',transition:'.15s'
                    }}
                    onMouseEnter={e=>e.currentTarget.style.color='var(--nd-teal)'}
                    onMouseLeave={e=>e.currentTarget.style.color='var(--nd-text-muted)'}
                    >{t}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Par catégorie — aide.png (grille 2 col colorée) */}
            <div className="nd-card">
              <div className="nd-card-header"><span className="nd-card-title" style={{color:'var(--nd-teal)'}}>🏷 Par catégorie</span></div>
              <div className="nd-card-body" style={{padding:'8px 12px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                  {[
                    {label:'Cotisations',   color:'var(--nd-teal)',   bg:'rgba(42,157,143,.1)'},
                    {label:'Pensions',       color:'var(--nd-blue)',   bg:'rgba(59,130,246,.1)'},
                    {label:'Adhesions',      color:'var(--nd-amber)',  bg:'rgba(245,158,11,.1)'},
                    {label:'Portail',        color:'var(--nd-teal)',   bg:'rgba(42,157,143,.1)'},
                    {label:'Investissements',color:'var(--nd-green)',  bg:'rgba(34,197,94,.1)'},
                    {label:'Assurances',     color:'var(--nd-primary)',bg:'rgba(230,57,70,.1)'},
                    {label:'Reglementation', color:'var(--nd-teal)',   bg:'transparent'},
                    {label:'General',        color:'var(--nd-text-muted)',bg:'transparent'},
                  ].map(c=>(
                    <div key={c.label} style={{
                      padding:'10px 14px',borderRadius:8,cursor:'pointer',
                      background:c.bg,transition:'.15s'
                    }}>
                      <span style={{fontSize:13,fontWeight:600,color:c.color}}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Contact support */}
          <div className="nd-card" style={{marginTop:18}}>
            <div className="nd-card-header"><span className="nd-card-title">Contacter le Support</span></div>
            <div className="nd-card-body">
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
                {[
                  {icon:'📧',titre:'Email Support',val:'contact@nudemm.sn',sub:'Réponse sous 24h'},
                  {icon:'📱',titre:'Téléphone',val:'+221 33 800 00 00',sub:'Lun-Ven 8h-18h'},
                  {icon:'💬',titre:'Chat en Direct',val:'Disponible',sub:'Temps de réponse: 5 min'},
                ].map(c=>(
                  <div key={c.titre} style={{background:'var(--nd-surface2)',borderRadius:10,padding:'16px',textAlign:'center',border:'1px solid var(--nd-border)'}}>
                    <div style={{fontSize:26,marginBottom:8}}>{c.icon}</div>
                    <div style={{fontWeight:600,fontSize:13}}>{c.titre}</div>
                    <div style={{fontSize:12,color:'var(--nd-teal)',margin:'4px 0'}}>{c.val}</div>
                    <div style={{fontSize:11,color:'var(--nd-text-dim)'}}>{c.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── FAQ ── */}
      {activeTab === 'faq' && (
        <>
          <div className="nd-search-box" style={{marginBottom:18}}>
            <span>🔍</span><input placeholder="Rechercher dans les FAQ..."/>
          </div>
          {FAQ_ITEMS.map((item,i)=><FaqAccordion key={i} q={item.q} a={item.a}/>)}
        </>
      )}

      {/* ── GUIDE ── */}
      {activeTab === 'guide' && (
        <div className="nd-card">
          <div className="nd-card-header"><span className="nd-card-title">Guide d'utilisation Nu-Demm Admin v3</span></div>
          <div className="nd-card-body">
            {[
              {icon:'🏠',titre:'Tableau de bord',desc:"Vue d'ensemble avec statistiques en temps réel, dernières commandes, activité récente et indicateurs clés."},
              {icon:'🏍',titre:'Gestion des Chauffeurs',desc:"Créer, modifier et supprimer des chauffeurs. Gérer leurs types de services, permis et coordonnées."},
              {icon:'👤',titre:'Gestion des Clients',desc:"Administrer la base clients avec leurs coordonnées et historique de commandes."},
              {icon:'🛒',titre:'Gestion des Commandes',desc:"Suivre toutes les commandes avec mise à jour des statuts en temps réel via l'API."},
              {icon:'🚚',titre:'Livraisons',desc:"Suivi des livraisons avec détails des colis, adresses de départ/destination et statuts."},
              {icon:'📊',titre:'Rapports & Analyses',desc:"Générer des rapports mensuels, analyser les tendances et exporter les données en CSV/PDF."},
              {icon:'📋',titre:"Journal d'Audit",desc:"Traçabilité complète de toutes les actions admin: CREATE, UPDATE, DELETE, LOGIN."},
              {icon:'⚙',titre:'Paramètres',desc:"Configurer les paramètres système (Général/Sécurité) et l'URL de connexion backend."},
            ].map((g,i)=>(
              <div key={i} style={{display:'flex',gap:14,padding:'12px 0',borderBottom:i<7?'1px solid var(--nd-border)':'none'}}>
                <span style={{fontSize:22,flexShrink:0}}>{g.icon}</span>
                <div>
                  <div style={{fontWeight:600,marginBottom:2,fontSize:13}}>{g.titre}</div>
                  <div style={{fontSize:12,color:'var(--nd-text-muted)'}}>{g.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS ──────────────────────────────────────────────────
// Calqué fidèlement sur param.png et param_securite.png
// Tableau avec colonnes: Clé · Nom · Valeur · Description · Actions (✏🗑)

const PARAMS_GENERAL = [
  {key:'SYSTEM_NAME',       nom:'Nom du Système',          val:'Nu-Demm Admin Panel',    desc:'Nom complet du système'},
  {key:'ORGANIZATION_NAME', nom:'Organisation',             val:'Nu-Demm Transport',      desc:"Nom de l'organisation"},
  {key:'CONTACT_EMAIL',     nom:'Email de Contact',         val:'contact@nudemm.sn',      desc:'Adresse email principale'},
  {key:'SUPPORT_PHONE',     nom:'Téléphone Support',        val:'+221 33 800 00 00',      desc:'Numéro de téléphone du support'},
  {key:'DEFAULT_LANGUAGE',  nom:'Langue par Défaut',        val:'fr',                     desc:'Code langue par défaut (fr, en, etc.)'},
  {key:'DEFAULT_CURRENCY',  nom:'Devise par Défaut',        val:'XOF',                    desc:'Code devise (XOF, EUR, etc.)'},
  {key:'TIMEZONE',          nom:'Fuseau Horaire',           val:'Africa/Dakar',           desc:'Fuseau horaire du système'},
  {key:'DATE_FORMAT',       nom:'Format Date',              val:'DD/MM/YYYY',             desc:"Format d'affichage des dates"},
];

const PARAMS_SECURITE = [
  {key:'PASSWORD_MIN_LENGTH',        nom:'Longueur Minimale Mot de Passe',          val:'8',      valColor:'var(--nd-teal)',  desc:'Nombre minimum de caractères pour les mots de passe'},
  {key:'PASSWORD_REQUIRE_UPPERCASE', nom:'Mot de Passe Majuscule Requise',          val:'✓ Oui',  valColor:'var(--nd-teal)',  desc:'Exiger au moins une majuscule'},
  {key:'PASSWORD_REQUIRE_NUMBER',    nom:'Mot de Passe Chiffre Requis',             val:'✓ Oui',  valColor:'var(--nd-teal)',  desc:'Exiger au moins un chiffre'},
  {key:'PASSWORD_REQUIRE_SPECIAL',   nom:'Mot de Passe Caractère Spécial Requis',   val:'✓ Oui',  valColor:'var(--nd-teal)',  desc:'Exiger au moins un caractère spécial'},
  {key:'PASSWORD_EXPIRY_DAYS',       nom:'Expiration Mot de Passe (jours)',          val:'90',     valColor:'var(--nd-teal)',  desc:'Nombre de jours avant expiration du mot de passe'},
  {key:'SESSION_TIMEOUT_MINUTES',    nom:'Durée Session Application Web (minutes)', val:'30',     valColor:'var(--nd-teal)',  desc:"Durée de validité d'une session en minutes sur l'application web en minutes"},
  {key:'MAX_LOGIN_ATTEMPTS',         nom:'Tentatives Connexion Maximum',            val:'5',      valColor:'var(--nd-teal)',  desc:'Nombre de tentatives de connexion avant blocage'},
  {key:'MFA_ADMIN_ENABLED',          nom:'Double Authentification Administration',  val:'X\nNon', valColor:'var(--nd-primary)',desc:"Authentification multifacteur (MFA) pour l'administration"},
  {key:'MFA_ADHERANT_ENABLED',       nom:'Double Authentification Adherants',       val:'X\nNon', valColor:'var(--nd-primary)',desc:'Authentification multifacteur (MFA) pour les adhérants'},
  {key:'MFA_OTP_EXPIRATION_SEC',     nom:'Durée de validité OTP (MFA)',             val:'300',    valColor:'var(--nd-teal)',  desc:'Durée du code de vérification (MFA)'},
];

function ParamTable({ section, params }) {
  return (
    <div className="nd-card" style={{marginBottom:16}}>
      <div style={{padding:'14px 20px',borderBottom:'1px solid var(--nd-border)'}}>
        <div style={{fontFamily:'var(--nd-font-display)',fontWeight:700,fontSize:15}}>{section}</div>
      </div>
      {/* En-tête colonnes — param.png */}
      <div style={{
        display:'grid',gridTemplateColumns:'180px 1fr 140px 1fr 80px',
        padding:'10px 20px',borderBottom:'1px solid var(--nd-border)',
        fontSize:12,color:'var(--nd-text-dim)',fontWeight:600
      }}>
        <span>Clé</span><span>Nom</span><span style={{textAlign:'right'}}>Valeur</span><span style={{paddingLeft:16}}>Description</span><span style={{textAlign:'right'}}>Actions</span>
      </div>
      {params.map((p,i)=>(
        <div key={p.key} style={{
          display:'grid',gridTemplateColumns:'180px 1fr 140px 1fr 80px',
          padding:'13px 20px',
          borderBottom:i<params.length-1?'1px solid var(--nd-border)':'none',
          alignItems:'center',gap:8
        }}>
          <code style={{fontSize:11,color:'var(--nd-text-dim)',fontFamily:'monospace'}}>{p.key}</code>
          <span style={{fontWeight:600,fontSize:13}}>{p.nom}</span>
          <span style={{fontWeight:700,fontSize:13,color:p.valColor||'var(--nd-teal)',textAlign:'right',whiteSpace:'pre-line'}}>
            {p.val}
          </span>
          <span style={{fontSize:12,color:'var(--nd-text-muted)',paddingLeft:16}}>{p.desc}</span>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button className="nd-btn-icon" title="Modifier" style={{color:'var(--nd-teal)',borderColor:'rgba(42,157,143,.3)'}}>✏</button>
            <button className="nd-btn-icon danger" title="Supprimer">🗑</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Settings() {
  const toast = useToast();
  const [baseUrl, setBaseUrlState] = useState(getBaseUrl());
  const [saved, setSaved] = useState(false);

  const save = () => {
    setBaseUrl(baseUrl.trim());
    Audit.log('UPDATE_SETTINGS','URL backend modifiée');
    toast('Paramètres sauvegardés','success');
    setSaved(true); setTimeout(()=>setSaved(false),3000);
  };

  const clearAudit = () => {
    if (!window.confirm("Effacer tout le journal d'audit ?")) return;
    Audit.clear(); toast('Journal effacé','success');
  };

  const clearCache = () => {
    ['nd2_token','nd2_user','nd2_base_url','nd2_audit'].forEach(k=>localStorage.removeItem(k));
    toast('Cache vidé — rechargement...','info');
    setTimeout(()=>window.location.reload(),1500);
  };

  return (
    <div className="fade-in">
      {/* Header — param.png */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <h2 style={{fontFamily:'var(--nd-font-display)',fontWeight:700,fontSize:18}}>Paramètres Système</h2>
          <p style={{fontSize:12,color:'var(--nd-text-muted)',marginTop:4}}>Configuration des paramètres système de l'application</p>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className="nd-btn nd-btn-outline" onClick={()=>toast('Actualisé','success')}>↺</button>
          <button className="nd-btn nd-btn-primary" style={{background:'var(--nd-teal)',borderColor:'var(--nd-teal)'}}>+ Ajouter</button>
        </div>
      </div>

      {/* Général — param.png */}
      <ParamTable section="Général" params={PARAMS_GENERAL} />

      {/* Sécurité — param_securite.png */}
      <ParamTable section="Sécurité" params={PARAMS_SECURITE} />

      {/* Connexion Backend */}
      <div className="nd-card" style={{marginBottom:16}}>
        <div className="nd-card-header"><span className="nd-card-title">Connexion Backend</span></div>
        <div className="nd-card-body">
          <div className="nd-settings-group">
            <div className="nd-settings-label">URL du serveur backend</div>
            <div style={{display:'flex',gap:10}}>
              <input className="nd-input" value={baseUrl} onChange={e=>setBaseUrlState(e.target.value)} placeholder="http://localhost:8080"/>
              <button className="nd-btn nd-btn-primary" style={{background:'var(--nd-teal)',borderColor:'var(--nd-teal)'}} onClick={save}>Sauvegarder</button>
            </div>
            {saved && <div className="nd-alert nd-alert-success" style={{marginTop:10}}>✓ Sauvegardé avec succès</div>}
            <div style={{marginTop:10,fontSize:12,color:'var(--nd-text-muted)'}}>
              URL actuelle: <code style={{background:'var(--nd-surface2)',padding:'2px 6px',borderRadius:4}}>{getBaseUrl()}</code>
            </div>
          </div>
        </div>
      </div>

      {/* Session & Sécurité */}
      <div className="nd-card" style={{marginBottom:16}}>
        <div className="nd-card-header"><span className="nd-card-title">Session &amp; Sécurité</span></div>
        <div className="nd-card-body">
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <button className="nd-btn nd-btn-outline" onClick={clearAudit}>🗑 Effacer l'audit</button>
            <button className="nd-btn nd-btn-outline" style={{color:'var(--nd-primary)',borderColor:'var(--nd-primary)'}} onClick={clearCache}>⚠ Vider le cache (déconnexion)</button>
          </div>
        </div>
      </div>

      {/* À propos */}
      <div className="nd-card">
        <div className="nd-card-header"><span className="nd-card-title">ℹ À propos</span></div>
        <div className="nd-card-body">
          {[['Application','Nu-Demm Admin Panel'],['Version','3.0.0 (React)'],['Framework','React 18 + React Router v6'],['Backend','Spring Boot / Java'],['Auth','JWT Bearer Token']].map(([l,v])=>(
            <div key={l} className="nd-detail-row">
              <span className="nd-detail-label">{l}</span>
              <span className="nd-detail-val">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}