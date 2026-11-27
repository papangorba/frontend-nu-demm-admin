import { useEffect, useState } from 'react';
import { apiControle, apiRegions, fmtDT, Audit } from '../services/api';
import { useToast } from '../context/AppContext';

/** « DAKAR@2026-11-25T18:30,THIES@… » → { DAKAR: '2026-11-25T18:30', … } (pluies encore en cours) */
const lirePluies = s => Object.fromEntries((s || '').split(',').filter(Boolean).map(x => x.split('@'))
  .filter(([, f]) => f && new Date(f) > new Date()));

const CLES = ['MAJORATION_POINTE_ACTIF', 'MAJORATION_POINTE_POURCENT', 'MAJORATION_POINTE_PLAGES', 'MAJORATION_POINTE_DIMANCHE',
  'MAJORATION_PLUIE_POURCENT', 'MAJORATION_DEMANDE_ACTIF', 'MAJORATION_DEMANDE_MAX', 'MAJORATION_PLAFOND'];

/**
 * Majorations des courses et livraisons (comme Yango) : heures de pointe, pluie par région, forte demande.
 * Tout est coupé par défaut ; le total est plafonné et le client voit toujours la raison avant de commander.
 * Le covoiturage n'est pas concerné (prix libres des chauffeurs).
 */
export default function Majorations() {
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState({});
  const [regions, setRegions] = useState([]);
  const [busy, setBusy] = useState(false);

  const charger = async () => {
    try {
      const [c, r] = await Promise.all([apiControle.config(), apiRegions.liste()]);
      setCfg(c);
      setRegions(Array.isArray(r) ? r : Array.isArray(r?.regions) ? r.regions : []);
      setForm(Object.fromEntries(CLES.map(k => [k, c[k] ?? ''])));
    } catch (e) { toast(e.message, 'error'); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);
  if (!cfg) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: String(v) }));
  const oui = k => form[k] === 'true';
  const modifie = CLES.some(k => String(form[k] ?? '') !== String(cfg[k] ?? ''));
  const pluies = lirePluies(cfg.MAJORATION_PLUIE_REGIONS);

  const enregistrer = async () => {
    if (!window.confirm('Appliquer ces majorations ? Elles comptent tout de suite pour les nouvelles courses et livraisons.')) return;
    setBusy(true);
    try {
      await apiControle.modifierConfig(form);
      Audit.log('MODIF_MAJORATIONS', CLES.map(k => `${k.replace('MAJORATION_', '')}=${form[k]}`).join(', '));
      toast('Majorations enregistrées', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  /** Signaler ou arrêter la pluie dans une région (elle s'arrête toute seule après la durée choisie) */
  const basculerPluie = async (code, nom) => {
    const autres = Object.entries(pluies).filter(([c]) => c !== code).map(([c, f]) => `${c}@${f}`);
    let valeur;
    if (pluies[code]) {
      valeur = autres.join(',');
    } else {
      const h = window.prompt(`Pluie à ${nom} : pendant combien d'heures ? (1 à 24)`, '3');
      if (h === null) return;
      valeur = [...autres, `${code}:${h}`].join(',');
    }
    setBusy(true);
    try {
      await apiControle.modifierConfig({ MAJORATION_PLUIE_REGIONS: valeur });
      Audit.log('MAJORATION_PLUIE', pluies[code] ? `Fin de la pluie : ${nom}` : `Pluie signalée : ${nom}`);
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const nombre = (k, aide) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <input className="nd-input" type="number" min="0" max="100" step="5" style={{ maxWidth: 80 }}
        value={form[k] ?? ''} onChange={e => set(k, e.target.value)} /> %
      <small className="nd-cell-sub">{aide}</small>
    </label>
  );
  const heure = f => new Date(f).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="nd-card" style={{ marginTop: 16 }}>
      <div className="nd-card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span className="nd-card-title">⚡ Majorations : heures de pointe, pluie, forte demande</span>
        <button className="nd-btn nd-btn-primary nd-btn-sm" disabled={busy || !modifie} onClick={enregistrer}>💾 Enregistrer</button>
      </div>
      <div className="nd-card-body" style={{ display: 'grid', gap: 18 }}>
        <p className="nd-cell-sub" style={{ margin: 0 }}>
          Courses et livraisons seulement : le covoiturage reste au prix des chauffeurs. Le client voit la raison avant de
          commander, par exemple « Prix majoré : Heure de pointe +20 % ». Le total ne dépasse jamais le plafond.
        </p>

        <div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
            <input type="checkbox" checked={oui('MAJORATION_POINTE_ACTIF')}
              onChange={e => set('MAJORATION_POINTE_ACTIF', e.target.checked)} />
            Heures de pointe
          </label>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
            {nombre('MAJORATION_POINTE_POURCENT', 'de plus')}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Plages
              <input className="nd-input" style={{ maxWidth: 240 }} value={form.MAJORATION_POINTE_PLAGES ?? ''}
                onChange={e => set('MAJORATION_POINTE_PLAGES', e.target.value)} placeholder="07:00-09:00,17:00-20:00" />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={oui('MAJORATION_POINTE_DIMANCHE')}
                onChange={e => set('MAJORATION_POINTE_DIMANCHE', e.target.checked)} />
              aussi le dimanche
            </label>
          </div>
        </div>

        <div>
          <b>Pluie</b>{' '}
          <small className="nd-cell-sub">touchez une région quand il pleut ; la majoration s'arrête toute seule après la durée choisie</small>
          <div style={{ marginTop: 8 }}>{nombre('MAJORATION_PLUIE_POURCENT', 'de plus dans les régions où il pleut')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {regions.map(r => (
              <button key={r.code} type="button" disabled={busy} onClick={() => basculerPluie(r.code, r.nom)}
                className={`nd-btn nd-btn-sm ${pluies[r.code] ? 'nd-btn-primary' : 'nd-btn-outline'}`}
                title={pluies[r.code] ? `Jusqu'au ${fmtDT(pluies[r.code])} : toucher pour arrêter` : 'Signaler la pluie'}>
                {pluies[r.code] ? `🌧 ${r.nom} · jusqu'à ${heure(pluies[r.code])}` : r.nom}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
            <input type="checkbox" checked={oui('MAJORATION_DEMANDE_ACTIF')}
              onChange={e => set('MAJORATION_DEMANDE_ACTIF', e.target.checked)} />
            Forte demande (courses)
          </label>
          <small className="nd-cell-sub">
            Autour du client (3 km) : 2 demandes en attente par chauffeur libre donnent +10 %, 3 donnent +20 %… jusqu'au maximum.
          </small>
          <div style={{ marginTop: 8 }}>{nombre('MAJORATION_DEMANDE_MAX', 'au maximum')}</div>
        </div>

        <div>
          <b>Plafond de toutes les majorations ensemble</b>
          <div style={{ marginTop: 8 }}>{nombre('MAJORATION_PLAFOND', 'au maximum (ex. pointe 20 % + pluie 15 % = 35 %)')}</div>
        </div>
      </div>
    </div>
  );
}
