import { useState, useEffect } from 'react';
import { apiUsers, apiFiche, fmtDate, fmtDT, Audit } from '../services/api';
import FicheUtilisateur, { BadgeInactivite, ilYa, joursInactif } from '../components/FicheUtilisateur';
import { Avatar, Modal, EmptyRow, LoadingRow } from '../components/ui';
import useAuChargement from '../hooks/useAuChargement';
import { useToast } from '../context/AppContext';

export default function Clients() {
  const toast = useToast();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ prenom:'',nom:'',telephone:'',password:'',email:'',nameEdit:'' });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const [activite, setActivite] = useState('');
  const [ficheId, setFicheId] = useState(null);
  const [seuil, setSeuil] = useState(30);
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
    try { setAll(await apiUsers.clients()); }
    catch(e) { toast(e.message,'error'); }
    finally { setLoading(false); }
  };
  useAuChargement(load);

  const filtered = all.filter(c => {
    const q = search.toLowerCase();
    return (!q || (c.name||'').toLowerCase().includes(q) || (c.telephone||'').includes(q) || (c.email||'').toLowerCase().includes(q)) && filtreActivite(c);
  });

  const openModal = (item=null) => {
    setEditId(item?.id||null); setErr('');
    if (item) {
      const [prenom,...rest] = (item.name||'').split(' ');
      setForm({ prenom, nom:rest.join(' '), telephone:item.telephone||'', password:'', email:item.email||'', nameEdit:item.name||'' });
    } else {
      setForm({ prenom:'',nom:'',telephone:'',password:'',email:'',nameEdit:'' });
    }
    setModal(true);
  };

  const submit = async () => {
    setErr(''); setSubmitting(true);
    try {
      if (editId) {
        await apiUsers.update(editId, { name:form.nameEdit, telephone:form.telephone, email:form.email });
        toast('Client modifié','success');
        Audit.log('UPDATE_CLIENT',`Client #${editId} modifié`);
      } else {
        // L'inscription client attend prénom / nom / téléphone (connexion par téléphone)
        const res = await apiUsers.registerClient({ prenom:form.prenom, nom:form.nom, telephone:form.telephone });
        if (res?.userId && form.email) await apiUsers.update(res.userId, { email: form.email });
        toast('Client créé','success');
        Audit.log('CREATE_CLIENT',`Client ${form.prenom} ${form.nom} créé`);
      }
      setModal(false); load();
    } catch(e) { setErr(e.message); }
    finally { setSubmitting(false); }
  };

  /** Suspendre / réactiver : le client est prévenu et déconnecté immédiatement. */
  const toggleActif = async c => {
    const suspendre = c.compteActif !== false;
    let motif = '';
    if (suspendre) {
      motif = window.prompt(`Suspendre ${c.name} ? Il ne pourra plus se connecter ni commander.\n\nMotif (envoyé au client, facultatif) :`, '');
      if (motif === null) return;
    } else if (!window.confirm(`Réactiver le compte de ${c.name} ?`)) return;
    try {
      await apiUsers.setActif(c.id, !suspendre, motif);
      toast(suspendre ? 'Compte suspendu' : 'Compte réactivé', 'success');
      Audit.log(suspendre ? 'SUSPEND_CLIENT' : 'REACTIVATE_CLIENT', `Client #${c.id} ${c.name}${motif ? ` — ${motif}` : ''}`);
      load();
    } catch(e) { toast(e.message,'error'); }
  };

  const suspendus = all.filter(c => c.compteActif === false).length;

  const del = async id => {
    if (!window.confirm('Supprimer définitivement ce client ? (préférez la suspension, réversible)')) return;
    try { await apiUsers.del(id); toast('Supprimé','success'); Audit.log('DELETE_CLIENT',`Client #${id} supprimé`); load(); }
    catch(e) { toast(e.message,'error'); }
  };

  const inp = (field, props={}) => <input {...props} className="nd-input" value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}/>;

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Gestion des Clients</h1>
          <p>{loading?'Chargement...':`${filtered.length} / ${all.length} client(s)${suspendus ? ` · ${suspendus} suspendu(s)` : ''}`}</p>
        </div>
        <div className="nd-page-header-actions">
          <div className="nd-search-box">
            <span>🔍</span>
            <input placeholder="Nom, téléphone, email..." value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <select className="nd-input nd-select" style={{width:180}} value={activite} onChange={e=>setActivite(e.target.value)}>
            <option value="">Toute activité</option>
            <option value="ACTIFS7">Actifs (7 derniers jours)</option>
            <option value="INACTIFS">⚠ Inactifs (≥ {seuil} j)</option>
            <option value="JAMAIS">Jamais revenus</option>
          </select>
          <button className="nd-btn nd-btn-outline" onClick={load}>↺</button>
          <button className="nd-btn nd-btn-primary" onClick={()=>openModal()}>+ Nouveau Client</button>
        </div>
      </div>

      <div className="nd-card">
        <div className="nd-card-body-p0">
          <div className="nd-table-wrap">
            <table className="nd-table">
              <thead><tr><th>#ID</th><th>Client</th><th>Téléphone</th><th>Email</th><th>Compte</th><th>Inscrit le</th><th>Dernière connexion</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <LoadingRow cols={8}/> : !filtered.length ? <EmptyRow cols={8} msg="Aucun client trouvé"/> :
                  filtered.map(c => (
                    <tr key={c.id} style={{opacity: c.compteActif === false ? .6 : 1}}>
                      <td className="nd-table-id">#{c.id}</td>
                      <td><div className="nd-cell-user" style={{cursor:'pointer'}} onClick={()=>setFicheId(c.id)} title="Ouvrir la fiche"><Avatar name={c.name||'?'} size={32}/><div className="nd-cell-name">{c.name||'—'}</div></div></td>
                      <td><small>{c.telephone||'—'}</small></td>
                      <td><small className="nd-cell-sub">{c.email||'—'}</small></td>
                      <td>{c.compteActif === false
                        ? <span className="nd-badge badge-danger">⛔ Suspendu</span>
                        : <span className="nd-badge badge-success">● Actif</span>}</td>
                      <td><small className="nd-cell-sub">{fmtDate(c.dateInscription)}</small></td>
                      <td><small className="nd-cell-sub" title={c.derniereConnexion ? fmtDT(c.derniereConnexion) : ''}>{ilYa(c.derniereConnexion)}</small><div><BadgeInactivite user={c} seuil={seuil}/></div></td>
                      <td>
                        <div style={{display:'flex',gap:5}}>
                          <button className="nd-btn-icon info" onClick={()=>setFicheId(c.id)} title="Fiche complète">👁</button>
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
          </div>
        </div>
      </div>

      <Modal open={modal} title={editId?'Modifier Client':'Nouveau Client'} onClose={()=>setModal(false)}
        footer={<>
          <button className="nd-btn nd-btn-outline" onClick={()=>setModal(false)}>Annuler</button>
          <button className="nd-btn nd-btn-primary" onClick={submit} disabled={submitting}>
            {submitting?<><div className="nd-spinner-sm"/> Enregistrement...</>:'Enregistrer'}
          </button>
        </>}>
        {editId ? <>
          {inp('nameEdit',{placeholder:'Nom complet'})}
          {inp('telephone',{placeholder:'Téléphone'})}
          {inp('email',{type:'email',placeholder:'Email'})}
        </> : <>
          <div className="nd-form-row">
            {inp('prenom',{placeholder:'Prénom *',required:true})}
            {inp('nom',{placeholder:'Nom *',required:true})}
          </div>
          {inp('telephone',{placeholder:'Téléphone * (9 chiffres)'})}
          {inp('email',{type:'email',placeholder:'Email (facultatif)'})}
        </>}
        {err && <div className="nd-alert nd-alert-danger">⚠ {err}</div>}
      </Modal>
      {ficheId && <FicheUtilisateur userId={ficheId} onClose={()=>setFicheId(null)} onOuvrirAutre={id=>setFicheId(id)} />}
    </div>
  );
}
