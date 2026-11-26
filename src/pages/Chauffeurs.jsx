
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiUsers, apiFiche, apiHistorique, serviceIcon, serviceDuVehicule, categorieService, fmtDate, fmtDT, Audit } from '../services/api';
import FicheUtilisateur, { BadgeInactivite, ilYa, joursInactif } from '../components/FicheUtilisateur';
import { Avatar, MiniCard, Modal, EmptyRow, LoadingRow, usePagination } from '../components/ui';
import useAuChargement from '../hooks/useAuChargement';
import { useToast } from '../context/AppContext';

const TYPES = ['VOITURE_COURSE','MOTO_TAXI','TAXI_BOKKO','MOTO_2_ROUES','MOTO_3_ROUES','FOURGONNETTE','CAMION'];
const LABELS = { VOITURE_COURSE:'🚗 Voiture Course',MOTO_TAXI:'🛵 Moto-taxi (Jakarta)',MOTO_2_ROUES:'🏍 Moto 2 roues',MOTO_3_ROUES:'🛺 Moto 3 roues',FOURGONNETTE:'🚐 Fourgonnette',TAXI_BOKKO:'🚕 Taxi Bokko',CAMION:'🚚 Camion' };

export default function Chauffeurs() {
  const toast = useToast();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ prenom:'',nom:'',telephone:'',password:'',email:'',typeService:'MOTO_2_ROUES',numeroPermis:'',dateExpirationPermis:'' });
  // Véhicule du chauffeur (créé ou modifié avec la fiche)
  const VIDE_V = { type:'', marque:'', modele:'', couleur:'', anneeFabrication:'', numeroImmatriculation:'' };
  const [veh, setVeh] = useState(VIDE_V);
  const [vehInitial, setVehInitial] = useState(VIDE_V);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const [activite, setActivite] = useState('');
  const [ficheId, setFicheId] = useState(null);
  const [seuil, setSeuil] = useState(30);
  const [nbEntreprise, setNbEntreprise] = useState(0);
  useEffect(() => { apiFiche.activite().then(a => setSeuil(a?.seuilAlerteJours || 30)).catch(() => {}); }, []);
  const filtreActivite = c => {
    const j = joursInactif(c);
    if (activite === 'INACTIFS') return j != null && j >= seuil;
    if (activite === 'ACTIFS7') return j != null && j < 7 && !!c.derniereConnexion;
    if (activite === 'JAMAIS') return !c.derniereConnexion;
    return true;
  };

  const load = async () => {
    setLoading(true);
    try {
      // Le service se lit sur le véhicule déclaré dans l'app (le champ du compte est souvent vide)
      const [chauffeurs, vehicules] = await Promise.all([apiUsers.chauffeurs(), apiHistorique.vehicules().catch(() => [])]);
      const parChauffeur = {};
      (vehicules || []).forEach(v => {
        const proprio = v.proprietaire?.id;
        if (proprio != null && !parChauffeur[proprio]) parChauffeur[proprio] = v;
      });
      // Les chauffeurs d'une entreprise de transport sont dans le dossier de leur entreprise, pas ici
      const liste = chauffeurs || [];
      setNbEntreprise(liste.filter(c => c.flotteId != null).length);
      setAll(liste.filter(c => c.flotteId == null).map(c => {
        const v = parChauffeur[c.id];
        return { ...c, vehicule: v || null, service: serviceDuVehicule(v?.type, c.typeService) };
      }));
    }
    catch(e) { toast(e.message,'error'); }
    finally { setLoading(false); }
  };
  useAuChargement(load);

  const filtered = all.filter(c => {
    const q = search.toLowerCase();
    const mQ = !q || (c.name||'').toLowerCase().includes(q) || (c.telephone||'').includes(q) || (c.email||'').toLowerCase().includes(q);
    const mT = !filterType || (filterType === 'AUCUN' ? !c.vehicule : c.service===filterType);
    return mQ && mT && filtreActivite(c);
  });
  // 50 lignes par page à l'écran ; la recherche et les filtres portent sur toute la liste
  const { visibles: lignesPage, barre: barrePages } = usePagination(filtered);

  const openModal = (item=null) => {
    setEditId(item?.id||null);
    setErr('');
    if (item) {
      const [prenom,...rest] = (item.name||'').split(' ');
      // Noms des champs du backend : numeroDePermis / dateExpirationDuPermis
      setForm({ prenom, nom:rest.join(' '), telephone:item.telephone||'', password:'', email:item.email||'', typeService:item.typeService||'MOTO_2_ROUES', numeroPermis:item.numeroDePermis||'', dateExpirationPermis:item.dateExpirationDuPermis||'' });
      const v = item.vehicule || {};
      const init = { type:v.type||'', marque:v.marque||'', modele:v.modele||'', couleur:v.couleur||'', anneeFabrication:v.anneeFabrication||'', numeroImmatriculation:v.numeroImmatriculation||'' };
      setVeh(init); setVehInitial(init);
    } else {
      setVeh(VIDE_V); setVehInitial(VIDE_V);
      setForm({ prenom:'',nom:'',telephone:'',password:'',email:'',typeService:'MOTO_2_ROUES',numeroPermis:'',dateExpirationPermis:'' });
    }
    setModal(true);
  };

  const submit = async () => {
    setErr(''); setSubmitting(true);
    try {
      const name = `${form.prenom} ${form.nom}`.trim();
      const profil = {
        email: form.email || null,
        typeService: form.typeService,
        numeroDePermis: form.numeroPermis,
        dateExpirationDuPermis: form.dateExpirationPermis,
      };
      const vehModifie = JSON.stringify(veh) !== JSON.stringify(vehInitial) && (veh.type || veh.numeroImmatriculation);
      if (editId) {
        await apiUsers.update(editId, { name, telephone:form.telephone, ...profil });
        if (vehModifie) {
          await apiHistorique.vehiculeChauffeur(editId, veh);
          Audit.log('VEHICULE_CHAUFFEUR', `Chauffeur #${editId} : ${veh.type} ${veh.numeroImmatriculation}`);
        }
        toast('Chauffeur modifié','success');
        Audit.log('UPDATE_CHAUFFEUR',`Chauffeur #${editId} modifié`);
      } else {
        // Champs attendus par /api/auth/chauffeur/register, puis le reste du profil
        const res = await apiUsers.registerChauffeur({
          name, telephone:form.telephone,
          numeroDePermis:form.numeroPermis, dateExpirationDuPermis:form.dateExpirationPermis,
        });
        if (res?.userId) await apiUsers.update(res.userId, profil);
        if (res?.userId && vehModifie) await apiHistorique.vehiculeChauffeur(res.userId, veh);
        toast('Chauffeur créé','success');
        Audit.log('CREATE_CHAUFFEUR',`Chauffeur ${name} créé`);
      }
      setModal(false); load();
    } catch(e) { setErr(e.message); }
    finally { setSubmitting(false); }
  };

  /** Suspendre / réactiver : le chauffeur est prévenu et déconnecté immédiatement. */
  const toggleActif = async c => {
    const suspendre = c.compteActif !== false;
    let motif = '';
    if (suspendre) {
      motif = window.prompt(`Suspendre ${c.name} ? Il ne pourra plus se connecter ni recevoir de courses.\n\nMotif (envoyé au chauffeur, facultatif) :`, '');
      if (motif === null) return;
    } else if (!window.confirm(`Réactiver le compte de ${c.name} ?`)) return;
    try {
      await apiUsers.setActif(c.id, !suspendre, motif);
      toast(suspendre ? 'Compte suspendu' : 'Compte réactivé', 'success');
      Audit.log(suspendre ? 'SUSPEND_CHAUFFEUR' : 'REACTIVATE_CHAUFFEUR', `Chauffeur #${c.id} ${c.name}${motif ? ` — ${motif}` : ''}`);
      load();
    } catch(e) { toast(e.message,'error'); }
  };

  const del = async id => {
    if (!window.confirm('Supprimer définitivement ce chauffeur ? (préférez la suspension, réversible)')) return;
    try { await apiUsers.del(id); toast('Supprimé','success'); Audit.log('DELETE_CHAUFFEUR',`Chauffeur #${id} supprimé`); load(); }
    catch(e) { toast(e.message,'error'); }
  };

  const nb = (...s) => all.filter(c => s.includes(c.service)).length;
  const counts = { total:all.length, course:nb('VOITURE_COURSE'), motoTaxi:nb('MOTO_TAXI'), taxi:nb('TAXI_BOKKO'),
    livraison:nb('MOTO_2_ROUES'), cargo:nb('MOTO_3_ROUES','FOURGONNETTE','CAMION'), sansVehicule:all.filter(c => !c.vehicule).length };

  const inp = (field,props={}) => <input {...props} className="nd-input" value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} />;

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Gestion des Chauffeurs</h1>
          <p>{loading?'Chargement...':`${filtered.length} / ${all.length} chauffeur(s)`}</p>
        </div>
        <div className="nd-page-header-actions">
          <div className="nd-search-box">
            <span>🔍</span>
            <input placeholder="Rechercher..." value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <select className="nd-input nd-select" style={{width:160}} value={filterType} onChange={e=>setFilterType(e.target.value)}>
            <option value="">Tous les types</option>
            {TYPES.map(t=><option key={t} value={t}>{LABELS[t]}</option>)}
            <option value="AUCUN">❔ Sans véhicule</option>
          </select>
          <select className="nd-input nd-select" style={{width:180}} value={activite} onChange={e=>setActivite(e.target.value)}>
            <option value="">Toute activité</option>
            <option value="ACTIFS7">Actifs (7 derniers jours)</option>
            <option value="INACTIFS">⚠ Inactifs (≥ {seuil} j)</option>
            <option value="JAMAIS">Jamais revenus</option>
          </select>
          <button className="nd-btn nd-btn-outline" onClick={load}>↺</button>
          <button className="nd-btn nd-btn-primary" onClick={()=>openModal()}>+ Nouveau Chauffeur</button>
        </div>
      </div>

      {/* Mini stats */}
      <div className="nd-mini-stats nd-mini-stats-6" style={{marginBottom:22}}>
        <MiniCard color="var(--nd-primary)" value={counts.total} label="Total" />
        <MiniCard color="var(--nd-blue)" value={counts.course} label="Voitures (courses)" />
        <MiniCard color="var(--nd-amber)" value={counts.motoTaxi} label="Moto-taxis" />
        <MiniCard color="var(--nd-teal)" value={counts.taxi} label="Taxi-Bokko" />
        <MiniCard color="#F79009" value={counts.livraison} label="Livreurs (moto)" />
        <MiniCard color="#1570EF" value={counts.cargo} label="Cargo" />
        <MiniCard color="var(--nd-orange)" value={counts.sansVehicule} label="Sans véhicule" />
      </div>
      {nbEntreprise > 0 && (
        <div className="nd-alert nd-alert-info" style={{ marginBottom: 18 }}>
          <span>🏢 {nbEntreprise} chauffeur(s) d'entreprises de transport ne sont pas dans cette liste : ils sont dans le dossier
            de leur entreprise (<Link to="/entreprises">Entreprises de transport</Link>).</span>
        </div>
      )}

      <div className="nd-card">
        <div className="nd-card-body-p0">
          <div className="nd-table-wrap">
            <table className="nd-table">
              <thead><tr><th>#ID</th><th>Chauffeur</th><th>Téléphone</th><th>Type Service</th><th>Véhicule</th><th>N° Permis</th><th>Exp. Permis</th><th>Compte</th><th>Inscrit le</th><th>Dernière connexion</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <LoadingRow cols={11}/> : !filtered.length ? <EmptyRow cols={11} msg="Aucun chauffeur trouvé"/> :
                  lignesPage.map(c => (
                    <tr key={c.id} style={{opacity: c.compteActif === false ? .6 : 1}}>
                      <td className="nd-table-id">#{c.id}</td>
                      <td><div className="nd-cell-user" style={{cursor:'pointer'}} onClick={()=>setFicheId(c.id)} title="Ouvrir la fiche"><Avatar name={c.name||'?'} size={32}/><div><div className="nd-cell-name">{c.name||'—'}</div><small className="nd-cell-sub">{c.email||''}</small></div></div></td>
                      <td><small>{c.telephone||'—'}</small></td>
                      <td>{c.service ? <div style={{display:'flex',gap:8,alignItems:'center'}}>
                          <span style={{fontSize:20}}>{serviceIcon(c.service)}</span>
                          <div>
                            <div style={{fontWeight:600,fontSize:13}}>{(LABELS[c.service]||c.service).replace(/^\S+\s/,'')}</div>
                            <small className="nd-cell-sub">{categorieService(c.service)}{c.vehicule ? ` · ${[c.vehicule.marque, c.vehicule.modele].filter(Boolean).join(' ')}${c.vehicule.numeroImmatriculation ? ` · ${c.vehicule.numeroImmatriculation}` : ''}` : ''}</small>
                          </div>
                        </div> : <span className="nd-badge badge-secondary">Aucun véhicule</span>}</td>
                      <td>{c.vehicule ? <>
                          <code style={{fontSize:12,fontWeight:700}}>{c.vehicule.numeroImmatriculation||'—'}</code>
                          <div className="nd-cell-sub">{[c.vehicule.marque, c.vehicule.modele].filter(Boolean).join(' ')}{c.vehicule.couleur ? ` · ${c.vehicule.couleur}` : ''}{c.vehicule.anneeFabrication ? ` · ${c.vehicule.anneeFabrication}` : ''}</div>
                          <div className="nd-cell-sub">Véhicule #{c.vehicule.id}{c.vehicule.creeLe ? ` · depuis le ${fmtDate(c.vehicule.creeLe)}` : ''}</div>
                        </> : <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={()=>openModal(c)}>+ Véhicule</button>}</td>
                      <td><small>{c.numeroDePermis||'—'}</small></td>
                      <td><small className="nd-cell-sub">{fmtDate(c.dateExpirationDuPermis)}</small></td>
                      <td>{c.compteActif === false
                        ? <span className="nd-badge badge-danger">⛔ Suspendu</span>
                        : <span className="nd-badge badge-success">● Actif</span>}</td>
                      <td><small className="nd-cell-sub">{fmtDate(c.dateInscription)}</small></td>
                      <td><small className="nd-cell-sub" title={c.derniereConnexion ? fmtDT(c.derniereConnexion) : ''}>{ilYa(c.derniereConnexion)}</small><div><BadgeInactivite user={c} seuil={seuil}/></div></td>
                      <td>
                        <div style={{display:'flex',gap:5}}>
                          <button className="nd-btn-icon info" onClick={()=>setFicheId(c.id)} title="Fiche complète (véhicule, documents, activité)">👁</button>
                          <button className="nd-btn-icon" onClick={()=>openModal(c)} title="Modifier">✏</button>
                          <button className={`nd-btn-icon ${c.compteActif === false ? 'info' : 'warn'}`} onClick={()=>toggleActif(c)}
                            title={c.compteActif === false ? 'Réactiver le compte' : 'Suspendre le compte'}>
                            {c.compteActif === false ? '✅' : '⛔'}
                          </button>
                          <button className="nd-btn-icon danger" onClick={()=>del(c.id)} title="Supprimer">🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
            {barrePages}
          </div>
        </div>
      </div>

      {/* Formulaire Modal */}
      <Modal open={modal} title={editId?'Modifier Chauffeur':'Nouveau Chauffeur'} onClose={()=>setModal(false)}
        footer={<>
          <button className="nd-btn nd-btn-outline" onClick={()=>setModal(false)}>Annuler</button>
          <button className="nd-btn nd-btn-primary" onClick={submit} disabled={submitting}>
            {submitting?<><div className="nd-spinner-sm"/> Enregistrement...</>:'Enregistrer'}
          </button>
        </>}>
        <div className="nd-form-row">
          {inp('prenom',{placeholder:'Prénom *',required:true})}
          {inp('nom',{placeholder:'Nom *',required:true})}
        </div>
        {inp('telephone',{placeholder:'Téléphone * (9 chiffres)'})}
        {inp('email',{type:'email',placeholder:'Email (facultatif)'})}
        <select className="nd-input nd-select" value={form.typeService} onChange={e=>setForm(f=>({...f,typeService:e.target.value}))}>
          {TYPES.map(t=><option key={t} value={t}>{LABELS[t]}</option>)}
        </select>
        {inp('numeroPermis',{placeholder:'Numéro de permis'})}
        <div className="nd-form-group"><label>Date expiration permis</label>{inp('dateExpirationPermis',{type:'date'})}</div>

        {/* Véhicule du chauffeur : mêmes contrôles que dans l'app (plaque DK-1234-AB, marque connue) */}
        <div style={{borderTop:'1px solid var(--nd-border, #e5e7eb)', margin:'6px 0 2px', paddingTop:12}}>
          <b>🚘 Véhicule</b> <small className="nd-cell-sub">{vehInitial.numeroImmatriculation ? '(modifier)' : '(facultatif : laisser vide si pas encore de véhicule)'}</small>
        </div>
        <select className="nd-input nd-select" value={veh.type} onChange={e=>setVeh(v=>({...v,type:e.target.value}))}>
          <option value="">— Type de véhicule —</option>
          {['Voiture course','Taxi-Bokko','Moto-taxi (Jakarta)','Moto 2 roues','Moto 3 roues','Fourgonnette','Camion'].concat(veh.type && !['Voiture course','Taxi-Bokko','Moto-taxi (Jakarta)','Moto 2 roues','Moto 3 roues','Fourgonnette','Camion'].includes(veh.type) ? [veh.type] : []).map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <div className="nd-form-row">
          <input className="nd-input" placeholder="Marque (ex. Toyota)" value={veh.marque} onChange={e=>setVeh(v=>({...v,marque:e.target.value}))} />
          <input className="nd-input" placeholder="Modèle (ex. Corolla)" value={veh.modele} onChange={e=>setVeh(v=>({...v,modele:e.target.value}))} />
        </div>
        <div className="nd-form-row">
          <input className="nd-input" placeholder="Immatriculation (DK-1234-AB)" value={veh.numeroImmatriculation} onChange={e=>setVeh(v=>({...v,numeroImmatriculation:e.target.value.toUpperCase()}))} />
          <input className="nd-input" placeholder="Couleur" value={veh.couleur} onChange={e=>setVeh(v=>({...v,couleur:e.target.value}))} />
          <input className="nd-input" placeholder="Année" inputMode="numeric" value={veh.anneeFabrication} onChange={e=>setVeh(v=>({...v,anneeFabrication:e.target.value}))} />
        </div>
        {err && <div className="nd-alert nd-alert-danger">⚠ {err}</div>}
      </Modal>

      {ficheId && <FicheUtilisateur userId={ficheId} onClose={()=>setFicheId(null)} onOuvrirAutre={id=>setFicheId(id)} />}
    </div>
  );
}
