import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Bus } from 'lucide-react';
import { apiMonEntreprise, Audit } from '../../services/api';
import { Spinner, Modal } from '../../components/ui';
import { useToast } from '../../context/AppContext';
import { TYPES_VEHICULE, ETATS_VEHICULE, EtatVehicule } from './Commun';

/** Véhicules de l'entreprise (bus, minibus, voitures) — partie 3c. */
const VIDE = { type: 'BUS', numeroImmatriculation: '', nombrePlaces: '', marque: '', modele: '', couleur: '', anneeFabrication: '', etat: 'EN_SERVICE' };

export default function Vehicules() {
  const toast = useToast();
  const [liste, setListe] = useState(null);
  const [max, setMax] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const charger = async () => {
    try {
      const [v, moi] = await Promise.all([apiMonEntreprise.vehicules(), apiMonEntreprise.moi()]);
      setListe(v || []); setMax(moi?.maxVehicules ?? null);
    } catch (e) { toast(e.message, 'error'); setListe(l => l || []); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const enregistrer = async () => {
    setBusy(true);
    try {
      const { id, ...d } = form;
      if (id) await apiMonEntreprise.modifierVehicule(id, d); else await apiMonEntreprise.creerVehicule(d);
      Audit.log(id ? 'VEHICULE_MODIFIE' : 'VEHICULE_AJOUTE', d.numeroImmatriculation);
      toast(id ? 'Véhicule mis à jour' : 'Véhicule ajouté', 'success');
      setForm(null);
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const supprimer = async v => {
    if (!window.confirm(`Supprimer le véhicule ${v.numeroImmatriculation} ?`)) return;
    try {
      await apiMonEntreprise.supprimerVehicule(v.id);
      Audit.log('VEHICULE_SUPPRIME', v.numeroImmatriculation);
      toast('Véhicule supprimé', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
  };

  const champ = cle => ({ value: form?.[cle] ?? '', onChange: ev => setForm({ ...form, [cle]: ev.target.value }) });
  const plein = max != null && liste && liste.length >= max;

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Mes véhicules</h1>
          <p>{liste ? `${liste.length} véhicule(s)${max ? ` sur ${max} autorisés par votre formule` : ''}` : ' '} · Le nombre de places sert aux réservations. Bus et minibus apparaissent dans la rubrique « Bus » de l'app client, les voitures 7 places dans « Allô Sénégal ».</p>
        </div>
        <button className="nd-btn nd-btn-primary" disabled={plein} title={plein ? 'Limite de votre formule atteinte' : ''}
          onClick={() => setForm({ ...VIDE })}><Plus size={15} /> Ajouter un véhicule</button>
      </div>
      {plein && <div className="ent-alerte">Vous avez atteint la limite de votre formule ({max} véhicules). Contactez l'équipe Ñu Demm pour passer à une formule supérieure.</div>}

      {liste === null ? <Spinner center /> : liste.length === 0 ? (
        <div className="nd-card"><div className="nd-card-body" style={{ textAlign: 'center', padding: 40 }}>
          <Bus size={40} color="var(--nd-text-dim)" />
          <p className="nd-cell-sub">Aucun véhicule. Ajoutez vos bus, minibus ou voitures.</p>
        </div></div>
      ) : (
        <div className="nd-card"><div className="nd-card-body-p0"><div className="nd-table-wrap">
          <table className="nd-table">
            <thead><tr><th>Immatriculation</th><th>Type</th><th>Places</th><th>Modèle</th><th>État</th><th></th></tr></thead>
            <tbody>{liste.map(v => (
              <tr key={v.id}>
                <td><b className="ent-mdp">{v.numeroImmatriculation}</b></td>
                <td>{v.typeLibelle}</td>
                <td><b>{v.nombrePlaces}</b></td>
                <td>{[v.marque, v.modele, v.couleur, v.anneeFabrication].filter(Boolean).join(' · ') || '—'}</td>
                <td><EtatVehicule etat={v.etat} /></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={() => setForm({ ...VIDE, ...v })} title="Modifier"><Pencil size={14} /></button>
                    <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={() => supprimer(v)} title="Supprimer"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div></div></div>
      )}

      <Modal open={!!form} title={form?.id ? `Modifier ${form.numeroImmatriculation}` : 'Nouveau véhicule'} onClose={() => setForm(null)}
        footer={<>
          <button className="nd-btn nd-btn-ghost" onClick={() => setForm(null)}>Annuler</button>
          <button className="nd-btn nd-btn-primary" disabled={busy} onClick={enregistrer}>Enregistrer</button>
        </>}>
        {form && <>
          <div className="nd-form-row">
            <div className="nd-form-group"><label>Type *</label>
              <select className="nd-input nd-select" {...champ('type')}>
                {Object.entries(TYPES_VEHICULE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></div>
            <div className="nd-form-group"><label>Places passagers *</label>
              <input className="nd-input" type="number" min="1" max="100" {...champ('nombrePlaces')} placeholder="Ex. 60" /></div>
            <div className="nd-form-group"><label>Immatriculation *</label>
              <input className="nd-input" {...champ('numeroImmatriculation')} placeholder="Ex. DK-1234-AB" /></div>
            <div className="nd-form-group"><label>État</label>
              <select className="nd-input nd-select" {...champ('etat')}>
                {Object.entries(ETATS_VEHICULE).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}
              </select></div>
            <div className="nd-form-group"><label>Marque</label><input className="nd-input" {...champ('marque')} placeholder="Ex. Tata" /></div>
            <div className="nd-form-group"><label>Modèle</label><input className="nd-input" {...champ('modele')} /></div>
            <div className="nd-form-group"><label>Couleur</label><input className="nd-input" {...champ('couleur')} /></div>
            <div className="nd-form-group"><label>Année</label><input className="nd-input" {...champ('anneeFabrication')} placeholder="Ex. 2019" /></div>
          </div>
        </>}
      </Modal>
    </div>
  );
}
