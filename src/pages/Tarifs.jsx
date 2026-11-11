import { useEffect, useMemo, useState } from 'react';
import { apiControle, fmtDT, money, Audit } from '../services/api';
import { Spinner } from '../components/ui';
import { useToast } from '../context/AppContext';

const ICONES = {
  COURSE_VOITURE: '🚗',
  LIVRAISON_MOTO: '🏍',
  LIVRAISON_TROIS_ROUES: '🛺',
  LIVRAISON_FOURGONNETTE: '🚐',
  LIVRAISON_CAMION: '🚚',
};

/** Même calcul que le serveur : max(minimum, base + km × distance), arrondi à 50 F. */
const calculer = (t, km) => {
  const brut = (Number(t.prixBase) || 0) + (Number(t.prixKm) || 0) * Math.max(0, km);
  return Math.max(Math.round(brut / 50) * 50, Number(t.prixMinimum) || 0);
};

export default function Tarifs() {
  const toast = useToast();
  const [tarifs, setTarifs] = useState([]);
  const [brouillon, setBrouillon] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [km, setKm] = useState(5);

  const charger = async () => {
    setLoading(true);
    try { setTarifs(await apiControle.tarifs() || []); setBrouillon({}); }
    catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const val = (t, champ) => brouillon[t.code]?.[champ] ?? t[champ] ?? '';
  const set = (code, champ, v) => setBrouillon(b => ({ ...b, [code]: { ...b[code], [champ]: v } }));
  const modifies = useMemo(() => Object.keys(brouillon), [brouillon]);
  const courant = t => ({ ...t, ...brouillon[t.code] });

  const enregistrer = async () => {
    setSaving(true);
    try {
      for (const code of modifies) await apiControle.modifierTarif(code, brouillon[code]);
      Audit.log('MODIF_TARIFS', modifies.join(', '));
      toast('Tarifs enregistrés — appliqués immédiatement aux nouvelles commandes', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  if (loading) return <Spinner center />;

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Tarifs</h1>
          <p>Le prix de chaque course ou livraison est calculé par le serveur avec cette grille — le client voit ce prix avant de commander</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {modifies.length > 0 && <button className="nd-btn nd-btn-ghost" onClick={() => setBrouillon({})}>Annuler</button>}
          <button className="nd-btn nd-btn-primary" disabled={saving || !modifies.length} onClick={enregistrer}>
            {saving ? 'Enregistrement...' : `💾 Enregistrer${modifies.length ? ` (${modifies.length})` : ''}`}
          </button>
        </div>
      </div>

      <div className="nd-alert nd-alert-info" style={{ marginBottom: 16 }}>
        <span>💡</span>
        <div>
          Prix = <b>prise en charge + prix au km × distance</b>, arrondi à 50 F, jamais en dessous du <b>minimum</b>.
          La distance est celle de l'itinéraire routier, contrôlée par le serveur (impossible de la falsifier depuis l'app).
          Pour une livraison, le client paie la moitié à la commande.
        </div>
      </div>

      <div className="nd-card">
        <div className="nd-table-wrap">
          <table className="nd-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Prise en charge (F)</th>
                <th>Prix au km (F)</th>
                <th>Minimum (F)</th>
                <th>Exemple {km} km</th>
              </tr>
            </thead>
            <tbody>
              {tarifs.map(t => (
                <tr key={t.code} style={modifies.includes(t.code) ? { background: 'rgba(245,158,11,.07)' } : undefined}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 22 }}>{ICONES[t.code] || '💰'}</span>
                      <div>
                        <b>{t.libelle}</b>
                        <div className="nd-cell-sub">{t.majLe ? `Modifié le ${fmtDT(t.majLe)}` : ''}</div>
                      </div>
                    </div>
                  </td>
                  {['prixBase', 'prixKm', 'prixMinimum'].map(champ => (
                    <td key={champ}>
                      <input className="nd-input" type="number" min="0" step="50" style={{ maxWidth: 120 }}
                        value={val(t, champ)} onChange={e => set(t.code, champ, e.target.value)} />
                    </td>
                  ))}
                  <td><b style={{ color: 'var(--nd-primary)', fontSize: 15 }}>{money(calculer(courant(t), km))}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="nd-card" style={{ marginTop: 16 }}>
        <div className="nd-card-header"><span className="nd-card-title">Simulateur</span></div>
        <div className="nd-card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <label>Distance du trajet : <b>{km} km</b></label>
            <input type="range" min="1" max="40" value={km} onChange={e => setKm(Number(e.target.value))} style={{ flex: 1, minWidth: 200 }} />
          </div>
          <div className="tf-simu">
            {tarifs.map(t => (
              <div key={t.code} className="tf-simu-item">
                <span style={{ fontSize: 26 }}>{ICONES[t.code]}</span>
                <small className="nd-cell-sub">{t.libelle}</small>
                <b>{money(calculer(courant(t), km))}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
