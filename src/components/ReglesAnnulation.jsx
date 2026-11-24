import { useEffect, useState } from 'react';
import { Scale, Save } from 'lucide-react';
import { apiControle, Auth } from '../services/api';
import { useToast } from '../context/AppContext';

/**
 * Politique d'annulation et pénalités (inspirée d'Uber / Yango en ville et de BlaBlaCar en covoiturage).
 * Les valeurs sont appliquées par le serveur (PolitiqueAnnulation) et affichées aux clients avant d'annuler.
 */
const CHAMPS = [
  { titre: 'Courses et livraisons', cles: [
    ['ANNUL_GRACE_MIN', "Annulation gratuite pendant (min après l'acceptation)", 'min'],
    ['ANNUL_FRAIS_COURSE', "Frais d'annulation tardive / client absent — course", 'F'],
    ['ANNUL_FRAIS_LIVRAISON', "Frais d'annulation tardive / expéditeur absent — livraison", 'F'],
    ['ANNUL_RETARD_MIN', 'Chauffeur pas arrivé après (gratuit pour le client)', 'min'],
    ['ANNUL_ATTENTE_MIN', 'Attente avant « client absent »', 'min'],
  ] },
  { titre: 'Chauffeurs', cles: [
    ['PENALITE_ABANDONS_MAX', 'Abandons en 24 h avant la pause (0 = jamais)', ''],
    ['PENALITE_BLOCAGE_MIN', 'Durée de la pause', 'min'],
    ['PENALITE_ANNULATION_TRAJET', 'Amende par passager si un covoiturage est annulé < 24 h avant', 'F'],
  ] },
  { titre: 'Réservations et envois de colis (acompte)', cles: [
    ['ANNUL_RESA_HEURES_GRATUIT', 'Remboursement intégral jusqu\'à (heures avant le départ)', 'h'],
    ['ANNUL_RESA_HEURES_TARDIF', 'Plus rien de remboursé sous (heures avant le départ)', 'h'],
    ['ANNUL_RESA_POURCENT_TARDIF', 'Part gardée par le chauffeur entre les deux', '%'],
  ] },
];

export default function ReglesAnnulation() {
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const regles = Auth.regles();

  const charger = () => apiControle.config().then(c => { setCfg(c); setForm(c); }).catch(e => toast(e.message, 'error'));
  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cfg) return null;
  const cles = CHAMPS.flatMap(g => g.cles.map(c => c[0]));
  const modifie = cles.some(k => `${form[k] ?? ''}` !== `${cfg[k] ?? ''}`);

  const enregistrer = async () => {
    setBusy(true);
    try {
      const v = {}; cles.forEach(k => { if (`${form[k]}` !== `${cfg[k]}`) v[k] = `${form[k]}`.trim(); });
      await apiControle.modifierConfig(v);
      toast('Règles d\'annulation enregistrées', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  return (
    <div className="nd-card" style={{ marginBottom: 16 }}>
      <div className="nd-card-header"><h3><Scale size={16} /> Règles d'annulation et pénalités</h3></div>
      <div className="nd-card-body">
        <p className="nd-cell-sub" style={{ marginTop: 0 }}>
          Le client voit ce que lui coûte l'annulation avant de confirmer. Frais payés en espèces : ajoutés à son trajet suivant
          puis reversés au chauffeur dédommagé. Payés en ligne : pris sur le paiement, le reste est remboursé.
          L'acompte d'une réservation n'est versé au chauffeur qu'après le trajet.
        </p>
        {CHAMPS.map(g => (
          <div key={g.titre} style={{ marginBottom: 12 }}>
            <b>{g.titre}</b>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, marginTop: 6 }}>
              {g.cles.map(([k, libelle, unite]) => (
                <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="nd-cell-sub">{libelle}{unite ? ` (${unite})` : ''}</span>
                  <input className="nd-input" inputMode="numeric" value={form[k] ?? ''} disabled={!regles}
                    onChange={e => setForm(f => ({ ...f, [k]: e.target.value.replace(/\D/g, '') }))} />
                </label>
              ))}
            </div>
          </div>
        ))}
        {regles ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="nd-btn nd-btn-primary" disabled={!modifie || busy} onClick={enregistrer}><Save size={15} /> Enregistrer</button>
          </div>
        ) : <small className="nd-cell-sub">Lecture seule : seuls le super-administrateur et l'administrateur peuvent modifier.</small>}
      </div>
    </div>
  );
}
