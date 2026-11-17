import { useState } from 'react';
import { apiCommandes, fmtDT, Audit } from '../services/api';
import { StatusBadge, MiniCard, Modal, EmptyRow, LoadingRow } from '../components/ui';
import useAuChargement from '../hooks/useAuChargement';
import { useToast } from '../context/AppContext';

const STATUSES = ['PROGRAMMEE','EN_ATTENTE','ACCEPTEE','EN_COURS','TERMINEE','ANNULEE','EXPIREE'];
const SERVICES = ['VOITURE_COURSE','MOTO_2_ROUES','MOTO_3_ROUES','FOURGONNETTE','TAXI_BOKKO','CAMION','DELIVERY'];

export default function Commandes() {
  const toast = useToast();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterService, setFilterService] = useState('');
  const [detailItem, setDetailItem] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setAll(await apiCommandes.all()); }
    catch(e) { toast(e.message,'error'); }
    finally { setLoading(false); }
  };
  useAuChargement(load);

  const filtered = all.filter(c => {
    const q = search.toLowerCase();
    const mQ = !q || String(c.id).includes(q)||(c.depart||'').toLowerCase().includes(q)||(c.destination||'').toLowerCase().includes(q)||(c.clientId||'').toString().includes(q);
    const mS = !filterStatus || c.status===filterStatus;
    const mSv = !filterService || c.serviceType===filterService;
    return mQ && mS && mSv;
  });

  const changeStatus = async (id, status) => {
    try {
      await apiCommandes.status(id, status);
      toast('Statut mis à jour','success');
      Audit.log('UPDATE_COMMANDE_STATUS',`Commande #${id} → ${status}`);
      load();
    } catch(e) { toast(e.message,'error'); }
  };

  /** Annulation admin : statut ANNULEE, le client et le chauffeur sont notifiés. */
  const annuler = async c => {
    if (!window.confirm(`Annuler la course #${c.id} ? Le client${c.chauffeurId ? ' et le chauffeur seront prévenus' : ' sera prévenu'} par notification.`)) return;
    try {
      await apiCommandes.annuler(c.id);
      toast(`Course #${c.id} annulée`,'success');
      Audit.log('ANNULER_COMMANDE',`Commande #${c.id} annulée par l'admin`);
      load();
    } catch(e) { toast(e.message,'error'); }
  };

  const showDetail = async id => {
    // Fusion : la liste a la date et le service, le détail a client/chauffeur/véhicule
    try { const d = await apiCommandes.detail(id); setDetailItem({ ...all.find(c=>c.id===id), ...d }); }
    catch { const found = all.find(c=>c.id===id); setDetailItem(found||null); }
  };

  const counts = {
    total:all.length, att:all.filter(c=>c.status==='EN_ATTENTE').length,
    cours:all.filter(c=>c.status==='EN_COURS').length, term:all.filter(c=>c.status==='TERMINEE').length,
    ann:all.filter(c=>c.status==='ANNULEE').length
  };

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Gestion des Commandes</h1>
          <p>{loading?'Chargement...':`${filtered.length} / ${all.length} commande(s)`}</p>
        </div>
        <div className="nd-page-header-actions">
          <div className="nd-search-box">
            <span>🔍</span>
            <input placeholder="ID, départ, destination..." value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <select className="nd-input nd-select" style={{width:140}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="">Tous statuts</option>
            {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <select className="nd-input nd-select" style={{width:140}} value={filterService} onChange={e=>setFilterService(e.target.value)}>
            <option value="">Tous services</option>
            {SERVICES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <button className="nd-btn nd-btn-outline" onClick={load}>↺</button>
        </div>
      </div>

      <div className="nd-mini-stats nd-mini-stats-5" style={{marginBottom:22}}>
        <MiniCard color="var(--nd-primary)"  value={counts.total} label="Total" />
        <MiniCard color="var(--nd-amber)"    value={counts.att}   label="En attente" />
        <MiniCard color="var(--nd-blue)"     value={counts.cours} label="En cours" />
        <MiniCard color="var(--nd-green)"    value={counts.term}  label="Terminées" />
        <MiniCard color="var(--nd-text-dim)" value={counts.ann}   label="Annulées" />
      </div>

      <div className="nd-card">
        <div className="nd-card-body-p0">
          <div className="nd-table-wrap">
            <table className="nd-table">
              <thead><tr><th>#</th><th>Départ</th><th>Destination</th><th>Client</th><th>Prix</th><th>Service</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <LoadingRow cols={9}/> : !filtered.length ? <EmptyRow cols={9} msg="Aucune commande"/> :
                  filtered.map(c => (
                    <tr key={c.id}>
                      <td className="nd-table-id">#{c.id}</td>
                      <td style={{maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}><small>{c.depart||'—'}</small></td>
                      <td style={{maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}><small>{c.destination||'—'}</small></td>
                      <td><small className="nd-cell-sub">ID: {c.clientId||'—'}</small></td>
                      <td><strong style={{color:'var(--nd-amber)'}}>{c.price!=null?c.price+' F':'—'}</strong></td>
                      <td><small>{c.serviceType||'—'}</small></td>
                      <td><StatusBadge status={c.status||'EN_ATTENTE'}/></td>
                      <td>
                        <small className="nd-cell-sub">{fmtDT(c.createdAt)}</small>
                        {c.dateProgrammee && <small style={{display:'block',fontWeight:600}}>🗓 Prévue {fmtDT(c.dateProgrammee)}</small>}
                      </td>
                      <td>
                        <div style={{display:'flex',gap:5}}>
                          <button className="nd-btn-icon info" onClick={()=>showDetail(c.id)} title="Détail">👁</button>
                          <select className="nd-input nd-select" style={{width:130,padding:'4px 8px',fontSize:12}} value={c.status||''} onChange={e=>changeStatus(c.id,e.target.value)}>
                            {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                          </select>
                          {!['TERMINEE','ANNULEE','EXPIREE'].includes(c.status) &&
                            <button className="nd-btn-icon danger" onClick={()=>annuler(c)} title="Annuler la course">✕</button>}
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={!!detailItem} title={`Détail Commande #${detailItem?.id}`} onClose={()=>setDetailItem(null)}>
        {detailItem && (
          <div>
            {[
              ['Départ',detailItem.depart],['Destination',detailItem.destination],
              ['Client', detailItem.client
                ? <>{detailItem.client.name} · <a href={`tel:${detailItem.client.telephone}`}>{detailItem.client.telephone}</a></>
                : detailItem.clientId],
              ['Chauffeur', detailItem.chauffeur
                ? <>{detailItem.chauffeur.name} · <a href={`tel:${detailItem.chauffeur.telephone}`}>{detailItem.chauffeur.telephone}</a></>
                : (detailItem.chauffeurId || 'Aucun')],
              ['Véhicule', detailItem.chauffeur?.vehicule
                ? `${detailItem.chauffeur.vehicule.marque||''} ${detailItem.chauffeur.vehicule.modele||''} · ${detailItem.chauffeur.vehicule.numeroImmatriculation||''}`
                : null],
              ['Note chauffeur', detailItem.chauffeur?.nombreNotations
                ? `⭐ ${Number(detailItem.chauffeur.noteMoyenne||0).toFixed(1)} (${detailItem.chauffeur.nombreNotations} avis)` : null],
              ['Distance / durée', [detailItem.distanceInitiale, detailItem.dureeInitiale].filter(Boolean).join(' · ') || null],
              ['Prix',detailItem.price!=null?detailItem.price+' FCFA':'—'],
              ['Client à bord', detailItem.clientRecupere ? 'Oui' : 'Non'],
              ['Service',detailItem.serviceType],['Statut',<StatusBadge status={detailItem.status}/>],
              ['Créé le',fmtDT(detailItem.createdAt)],
            ].filter(([,v]) => v !== null && v !== undefined).map(([l,v])=>(
              <div key={l} className="nd-detail-row">
                <span className="nd-detail-label">{l}</span><span className="nd-detail-val">{v||'—'}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
