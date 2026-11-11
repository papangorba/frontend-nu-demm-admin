import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2, Building2 } from 'lucide-react';
import { apiMonEntreprise, compresserImage, mediaUrl, fmtDate, money, Audit } from '../../services/api';
import { Spinner } from '../../components/ui';
import { useToast } from '../../context/AppContext';

/** « Mon entreprise » : informations, logo (suggestion 6) et abonnement — partie 3c. */
export default function Profil() {
  const toast = useToast();
  const [e, setE] = useState(null);
  const [busy, setBusy] = useState(false);
  const fichier = useRef(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { apiMonEntreprise.moi().then(setE).catch(x => toast(x.message, 'error')); }, []);

  const choisir = async ev => {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const image = await compresserImage(f, 512, 0.9);
      setE(await apiMonEntreprise.changerLogo(image));
      Audit.log('LOGO_MODIFIE', e?.nom);
      toast('Logo mis à jour : il sera affiché aux clients à côté de vos trajets', 'success');
    } catch (x) { toast(x.message, 'error'); }
    finally { setBusy(false); }
  };

  const supprimer = async () => {
    if (!window.confirm('Supprimer le logo ?')) return;
    try { setE(await apiMonEntreprise.supprimerLogo()); toast('Logo supprimé', 'success'); }
    catch (x) { toast(x.message, 'error'); }
  };

  if (!e) return <Spinner center />;
  return (
    <div className="fade-in">
      <div className="nd-page-header"><div className="nd-page-header-left">
        <h1>Mon entreprise</h1>
        <p>Pour modifier vos informations ou votre formule, contactez l'équipe Ñu Demm.</p>
      </div></div>

      <div className="nd-grid-2">
        <div className="nd-card"><div className="nd-card-body">
          <h3 className="ee-h3">Logo</h3>
          <div className="ee-logo-zone">
            {e.logoUrl ? <img src={mediaUrl(e.logoUrl)} alt={`Logo ${e.nom}`} className="ee-logo-grand" />
              : <div className="ee-logo-vide"><Building2 size={36} /></div>}
            <div>
              <p className="nd-cell-sub" style={{ marginTop: 0 }}>Affiché aux clients de l'app Ñu Demm à côté de vos trajets. Image carrée conseillée.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="nd-btn nd-btn-primary nd-btn-sm" disabled={busy} onClick={() => fichier.current?.click()}>
                  <ImagePlus size={14} /> {e.logoUrl ? 'Changer le logo' : 'Ajouter un logo'}
                </button>
                {e.logoUrl && <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={supprimer}><Trash2 size={14} /> Supprimer</button>}
              </div>
              <input ref={fichier} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={choisir} />
            </div>
          </div>
        </div></div>

        <div className="nd-card"><div className="nd-card-body">
          <h3 className="ee-h3">Abonnement</h3>
          <div className="ent-prix">{e.formuleNom}<small> · {money(e.prixMensuel)}/mois</small></div>
          <div className="ent-infos" style={{ marginTop: 10 }}>
            <div><span>Valable jusqu'au</span><b>{fmtDate(e.abonnementJusquau)}</b></div>
            <div><span>Véhicules</span><b>{e.nombreVehicules}{e.maxVehicules ? ` / ${e.maxVehicules}` : ' (illimité)'}</b></div>
          </div>
        </div></div>
      </div>

      <div className="nd-card" style={{ marginTop: 16 }}><div className="nd-card-body ent-infos">
        <div><span>Nom</span><b>{e.nom}</b></div>
        <div><span>Ville</span><b>{e.ville}</b></div>
        <div><span>Téléphone</span><b>{e.telephone}</b></div>
        <div><span>E-mail</span><b>{e.email || '—'}</b></div>
        <div><span>Adresse</span><b>{e.adresse || '—'}</b></div>
        <div><span>NINEA</span><b>{e.ninea || '—'}</b></div>
        <div><span>RCCM</span><b>{e.rccm || '—'}</b></div>
        <div><span>Gérant</span><b>{e.gestionnaire}</b></div>
      </div></div>
    </div>
  );
}
