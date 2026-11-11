import { useEffect, useState } from 'react';
import { Plus, Pencil, UserMinus, Users } from 'lucide-react';
import { apiMonEntreprise, Audit, fmtDate } from '../../services/api';
import { Spinner, Modal } from '../../components/ui';
import { useToast } from '../../context/AppContext';

/** Chauffeurs de l'entreprise — partie 3c. Le gérant crée leurs comptes. */
const VIDE = { name: '', telephone: '', numeroDePermis: '', dateExpirationDuPermis: '' };

export default function Chauffeurs() {
  const toast = useToast();
  const [liste, setListe] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const charger = async () => {
    try { setListe(await apiMonEntreprise.chauffeurs() || []); }
    catch (e) { toast(e.message, 'error'); setListe(l => l || []); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const enregistrer = async () => {
    setBusy(true);
    try {
      if (form.id) {
        await apiMonEntreprise.modifierChauffeur(form.id, { name: form.name, numeroDePermis: form.numeroDePermis, dateExpirationDuPermis: form.dateExpirationDuPermis });
        toast('Chauffeur mis à jour', 'success');
      } else {
        const c = await apiMonEntreprise.creerChauffeur(form);
        Audit.log('CHAUFFEUR_AJOUTE', `${c.name} ${c.telephone}`);
        toast(`${c.name} a été ajouté : vous pouvez l'affecter à vos trajets`, 'success');
      }
      setForm(null);
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const retirer = async c => {
    if (!window.confirm(`Retirer ${c.name} de votre entreprise ?`)) return;
    try {
      await apiMonEntreprise.retirerChauffeur(c.id);
      Audit.log('CHAUFFEUR_RETIRE', c.name);
      toast(`${c.name} a été retiré`, 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
  };

  const champ = cle => ({ value: form?.[cle] ?? '', onChange: ev => setForm({ ...form, [cle]: ev.target.value }) });

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Mes chauffeurs</h1>
          <p>Enregistrez vos chauffeurs pour les affecter à vos trajets. Ils n'ont pas besoin de l'application pour l'instant.</p>
        </div>
        <button className="nd-btn nd-btn-primary" onClick={() => setForm({ ...VIDE })}><Plus size={15} /> Ajouter un chauffeur</button>
      </div>

      {liste === null ? <Spinner center /> : liste.length === 0 ? (
        <div className="nd-card"><div className="nd-card-body" style={{ textAlign: 'center', padding: 40 }}>
          <Users size={40} color="var(--nd-text-dim)" />
          <p className="nd-cell-sub">Aucun chauffeur. Ajoutez le premier avec « Ajouter un chauffeur ».</p>
        </div></div>
      ) : (
        <div className="nd-card"><div className="nd-card-body-p0"><div className="nd-table-wrap">
          <table className="nd-table">
            <thead><tr><th>Chauffeur</th><th>Téléphone</th><th>Permis</th><th>Trajets</th><th>Statut</th><th></th></tr></thead>
            <tbody>{liste.map(c => (
              <tr key={c.id}>
                <td><b>{c.name}</b><small className="nd-cell-sub" style={{ display: 'block' }}>Depuis le {fmtDate(c.dateInscription)}</small></td>
                <td className="ent-mdp">{c.telephone}</td>
                <td>{c.numeroDePermis || '—'}{c.dateExpirationDuPermis && <small className="nd-cell-sub" style={{ display: 'block' }}>exp. {fmtDate(c.dateExpirationDuPermis)}</small>}</td>
                <td>{c.trajets}</td>
                <td>{c.actif ? <span className="nd-badge badge-success">Actif</span> : <span className="nd-badge badge-secondary">Inactif</span>}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={() => setForm({ ...VIDE, ...c })} title="Modifier"><Pencil size={14} /></button>
                    <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={() => retirer(c)} title="Retirer de l'entreprise"><UserMinus size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div></div></div>
      )}

      <Modal open={!!form} title={form?.id ? `Modifier ${form.name}` : 'Nouveau chauffeur'} onClose={() => setForm(null)}
        footer={<>
          <button className="nd-btn nd-btn-ghost" onClick={() => setForm(null)}>Annuler</button>
          <button className="nd-btn nd-btn-primary" disabled={busy} onClick={enregistrer}>Enregistrer</button>
        </>}>
        {form && <>
          <div className="nd-form-row">
            <div className="nd-form-group"><label>Nom complet *</label><input className="nd-input" {...champ('name')} /></div>
            <div className="nd-form-group"><label>Téléphone *</label>
              <input className="nd-input" {...champ('telephone')} disabled={!!form.id} placeholder="77 123 45 67" />
              {!form.id && <small className="nd-cell-sub">Pour le joindre ; il ne pourra plus être modifié ensuite.</small>}
            </div>
            <div className="nd-form-group"><label>N° de permis</label><input className="nd-input" {...champ('numeroDePermis')} /></div>
            <div className="nd-form-group"><label>Expiration du permis</label><input className="nd-input" type="date" {...champ('dateExpirationDuPermis')} /></div>
          </div>
        </>}
      </Modal>
    </div>
  );
}
