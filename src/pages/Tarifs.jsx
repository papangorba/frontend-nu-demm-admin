import { useEffect, useMemo, useState } from 'react';
import { apiControle, apiRegions, fmtDT, money, Audit } from '../services/api';
import { Spinner } from '../components/ui';
import Majorations from '../components/Majorations';
import { useToast } from '../context/AppContext';

const ICONES = {
  COURSE_VOITURE: '🚗',
  LIVRAISON_MOTO: '🏍',
  LIVRAISON_TROIS_ROUES: '🛺',
  LIVRAISON_FOURGONNETTE: '🚐',
  LIVRAISON_CAMION: '🚚',
};

/** Même calcul que le serveur : max(minimum, base + km × distance) × niveau de la région, arrondi à 50 F. */
const calculer = (t, km, pourcent = 100) => {
  const c = pourcent / 100;
  const brut = ((Number(t.prixBase) || 0) + (Number(t.prixKm) || 0) * Math.max(0, km)) * c;
  return Math.max(Math.round(brut / 50) * 50, Math.round((Number(t.prixMinimum) || 0) * c / 50) * 50);
};

/** « DAKAR:100,THIES:85 » ⇄ { DAKAR: 100, THIES: 85 } */
const lireNiveaux = s => Object.fromEntries((s || '').split(',').filter(Boolean).map(x => x.split(':')).map(([k, v]) => [k, Number(v)]));
const ecrireNiveaux = m => Object.entries(m).filter(([, v]) => Number(v) !== 100).map(([k, v]) => `${k}:${Number(v)}`).join(',');

/**
 * Prix par région : la grille ci-dessus vaut 100 % ; chaque région a son niveau (ex. Dakar 100 %, Thiès 85 %).
 * Le niveau de la région de DÉPART s'applique (prise en charge, prix au km et minimum).
 */
function PrixParRegion({ tarifs, km }) {
  const toast = useToast();
  const [regions, setRegions] = useState([]);
  const [enregistre, setEnregistre] = useState({});
  const [niveaux, setNiveaux] = useState({});
  const [saving, setSaving] = useState(false);

  const charger = async () => {
    try {
      const [r, cfg] = await Promise.all([apiRegions.liste(), apiControle.config()]);
      setRegions(Array.isArray(r) ? r : []);
      const n = lireNiveaux(cfg?.TARIF_REGIONS);
      setEnregistre(n); setNiveaux(n);
    } catch (e) { toast(e.message, 'error'); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const niveau = code => niveaux[code] ?? 100;
  const modifie = ecrireNiveaux(niveaux) !== ecrireNiveaux(enregistre);
  const voiture = tarifs.find(t => t.code === 'COURSE_VOITURE');
  const moto = tarifs.find(t => t.code === 'LIVRAISON_MOTO');

  const enregistrer = async () => {
    const valeur = ecrireNiveaux(niveaux);
    if (!window.confirm('Appliquer ces niveaux de prix ? Ils comptent tout de suite pour les nouvelles courses et livraisons.')) return;
    setSaving(true);
    try {
      await apiControle.modifierConfig({ TARIF_REGIONS: valeur });
      Audit.log('MODIF_TARIFS_REGIONS', valeur || 'toutes les régions à 100 %');
      toast('Prix par région enregistrés', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="nd-card" style={{ marginTop: 16 }}>
      <div className="nd-card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span className="nd-card-title">Prix par région</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {modifie && <button className="nd-btn nd-btn-ghost nd-btn-sm" onClick={() => setNiveaux(enregistre)}>Annuler</button>}
          <button className="nd-btn nd-btn-primary nd-btn-sm" disabled={saving || !modifie} onClick={enregistrer}>
            {saving ? 'Enregistrement...' : '💾 Enregistrer'}
          </button>
        </div>
      </div>
      <div className="nd-card-body">
        <p className="nd-cell-sub" style={{ marginTop: 0 }}>
          La grille ci-dessus = <b>100 %</b>. Mettez par exemple Dakar à 100 % et Thiès à 85 % : une course qui part de Thiès
          coûte 15 % de moins. C'est la région de <b>départ</b> qui compte. Entre 50 et 200 %.
          Les prix du covoiturage (Taxi-Bokko, Allô Sénégal) restent fixés par les chauffeurs.
        </p>
        <div className="nd-table-wrap">
          <table className="nd-table">
            <thead><tr><th>Région</th><th>Niveau</th><th>Course voiture {km} km</th><th>Livraison moto {km} km</th></tr></thead>
            <tbody>
              {regions.map(r => (
                <tr key={r.code} style={niveau(r.code) !== (enregistre[r.code] ?? 100) ? { background: 'rgba(245,158,11,.07)' } : undefined}>
                  <td><b>{r.nom}</b></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input className="nd-input" type="number" min="50" max="200" step="5" style={{ maxWidth: 90 }}
                        value={niveau(r.code)} onChange={e => setNiveaux(n => ({ ...n, [r.code]: e.target.value }))} /> %
                    </div>
                  </td>
                  <td>{voiture ? money(calculer(voiture, km, Number(niveau(r.code)) || 100)) : '—'}</td>
                  <td>{moto ? money(calculer(moto, km, Number(niveau(r.code)) || 100)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

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

      {/* Cargo au même prix que la moto : incohérent (un camion coûte bien plus cher à faire rouler) */}
      {(() => {
        const moto = tarifs.find(t => t.code === 'LIVRAISON_MOTO');
        const pareils = tarifs.filter(t => ['LIVRAISON_TROIS_ROUES', 'LIVRAISON_FOURGONNETTE', 'LIVRAISON_CAMION'].includes(t.code)
          && moto && calculer(courant(t), 10) <= calculer(courant(moto), 10));
        return pareils.length > 0 && (
          <div className="nd-alert nd-alert-warn" style={{ marginBottom: 16 }}>
            <span>⚠</span>
            <div>
              <b>{pareils.map(t => t.libelle).join(', ')}</b> : pas plus cher que la livraison à moto.
              Le Cargo (3 roues, fourgonnette, camion) devrait coûter plus. Exemple de grille :
              3 roues 1 000 F + 300 F/km (min. 1 500 F) · fourgonnette 2 500 F + 500 F/km (min. 3 000 F) · camion 5 000 F + 800 F/km (min. 7 500 F).
            </div>
          </div>
        );
      })()}

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

      <PrixParRegion tarifs={tarifs.map(courant)} km={km} />
      <Majorations />
    </div>
  );
}
