import { useEffect, useState } from 'react';
import { MapPinned, RefreshCw, Save, CheckCircle2 } from 'lucide-react';
import { apiRegions, Audit, fmtDT } from '../services/api';
import { Spinner } from '../components/ui';
import { useToast } from '../context/AppContext';

/**
 * Services par région : l'admin ouvre ou coupe chaque service dans chacune des 14 régions.
 * Par défaut tout est ouvert partout. La région de l'utilisateur est trouvée par sa position GPS ;
 * une commande dans une région où le service est coupé est refusée avec le message ci-dessous.
 */

function Interrupteur({ actif, onChange, disabled, titre }) {
  return (
    <button type="button" className={`cp-switch${actif ? ' on' : ''}`} disabled={disabled} title={titre}
      onClick={() => onChange(!actif)} aria-pressed={actif} aria-label={titre}>
      <span />
    </button>
  );
}

const COURTS = {
  COURSE_VOITURE: 'Voiture', COURSE_MOTO: 'Moto Jakarta', LIVRAISON: 'Livraison', CARGO: 'Cargo',
  TAXI_BOKKO: 'Taxi-Bokko', BUS: 'Bus', ALLO_SENEGAL: 'Allô Sénégal',
};

export default function Regions() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [messages, setMessages] = useState({});
  const [busy, setBusy] = useState(null);

  const charger = async () => {
    try { setData(await apiRegions.liste()); }
    catch (e) { toast(e.message, 'error'); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const remplacer = region => setData(d => ({ ...d, regions: d.regions.map(r => r.code === region.code ? region : r) }));

  const basculer = async (r, s, actif) => {
    setBusy(`${r.code}-${s}`);
    try {
      remplacer(await apiRegions.modifier(r.code, { services: { [s]: actif } }));
      Audit.log('REGION_SERVICE', `${r.nom} — ${COURTS[s] || s} ${actif ? 'ouvert' : 'coupé'}`);
      toast(`${COURTS[s] || s} ${actif ? 'ouvert' : 'coupé'} à ${r.nom}`, 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  const partout = async (s, actif) => {
    if (!window.confirm(`${actif ? 'Ouvrir' : 'Couper'} « ${COURTS[s] || s} » dans les 14 régions ?`)) return;
    setBusy(`*-${s}`);
    try {
      setData(await apiRegions.partout(s, actif));
      Audit.log('REGION_SERVICE', `${COURTS[s] || s} ${actif ? 'ouvert' : 'coupé'} partout`);
      toast(`${COURTS[s] || s} ${actif ? 'ouvert' : 'coupé'} dans toutes les régions`, 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  const enregistrerMessage = async r => {
    setBusy(`${r.code}-msg`);
    try {
      remplacer(await apiRegions.modifier(r.code, { message: messages[r.code] ?? '' }));
      setMessages(m => { const n = { ...m }; delete n[r.code]; return n; });
      toast(`Message enregistré pour ${r.nom}`, 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  if (!data) return <Spinner center />;
  const services = data.services || [];
  const regions = data.regions || [];
  const coupes = regions.reduce((n, r) => n + Object.values(r.services).filter(v => !v).length, 0);

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Services par région</h1>
          <p>Ouvrez ou coupez chaque service dans chaque région du Sénégal. Les apps lisent la région grâce à la position GPS
            de l'utilisateur et cachent les services coupés ; le serveur refuse aussi les commandes correspondantes.
            Par défaut, tout est ouvert partout.</p>
        </div>
        <button className="nd-btn nd-btn-ghost" onClick={charger}><RefreshCw size={15} /> Actualiser</button>
      </div>

      <div className="nd-card" style={{ marginBottom: 16 }}>
        <div className="nd-card-body" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {coupes === 0
            ? <><CheckCircle2 size={18} color="var(--nd-green)" /> Tous les services sont ouverts dans les 14 régions.</>
            : <><MapPinned size={18} /> {coupes} service{coupes > 1 ? 's' : ''} coupé{coupes > 1 ? 's' : ''} au total.</>}
        </div>
      </div>

      <div className="nd-card"><div className="nd-table-wrap">
        <table className="nd-table">
          <thead>
            <tr>
              <th>Région</th>
              {services.map(s => <th key={s.code} style={{ textAlign: 'center' }} title={s.libelle}>{COURTS[s.code] || s.libelle}</th>)}
              <th style={{ minWidth: 240 }}>Message si un service est coupé</th>
            </tr>
            <tr>
              <th style={{ fontWeight: 600 }}>Partout</th>
              {services.map(s => {
                const ouvertPartout = regions.every(r => r.services[s.code]);
                return (
                  <th key={s.code} style={{ textAlign: 'center' }}>
                    <Interrupteur actif={ouvertPartout} disabled={busy === `*-${s.code}`}
                      titre={`${ouvertPartout ? 'Couper' : 'Ouvrir'} « ${s.libelle} » dans toutes les régions`}
                      onChange={v => partout(s.code, v)} />
                  </th>
                );
              })}
              <th className="nd-cell-sub" style={{ fontWeight: 400, textTransform: 'none' }}>Laissez vide pour le message automatique</th>
            </tr>
          </thead>
          <tbody>
            {regions.map(r => {
              const msg = messages[r.code] ?? r.message ?? '';
              const modifie = messages[r.code] !== undefined && messages[r.code] !== (r.message ?? '');
              return (
                <tr key={r.code}>
                  <td style={{ whiteSpace: 'nowrap' }} title={r.majLe ? `Modifié le ${fmtDT(r.majLe)}${r.majPar ? ` par ${r.majPar}` : ''}` : ''}>
                    <b>{r.nom}</b>
                    {Object.values(r.services).some(v => !v) && <span className="nd-badge badge-warn" style={{ marginLeft: 8 }}>
                      {Object.values(r.services).filter(v => !v).length} coupé{Object.values(r.services).filter(v => !v).length > 1 ? 's' : ''}</span>}
                  </td>
                  {services.map(s => (
                    <td key={s.code} style={{ textAlign: 'center' }}>
                      <Interrupteur actif={r.services[s.code]} disabled={busy === `${r.code}-${s.code}`}
                        titre={`${s.libelle} — ${r.nom}`} onChange={v => basculer(r, s.code, v)} />
                    </td>
                  ))}
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input className="nd-input" value={msg} maxLength={300}
                        placeholder={`ex. Bientôt disponible à ${r.nom} !`}
                        onChange={e => setMessages(m => ({ ...m, [r.code]: e.target.value }))} />
                      {modifie && (
                        <button className="nd-btn nd-btn-primary nd-btn-sm" disabled={busy === `${r.code}-msg`} onClick={() => enregistrerMessage(r)}
                          title="Enregistrer le message"><Save size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div></div>
      <p className="nd-cell-sub" style={{ marginTop: 10 }}>
        Contours des régions : geoBoundaries (Gouvernement du Sénégal, OCHA) — CC BY 3.0 IGO. Hors du Sénégal ou sans position GPS, rien n'est bloqué.
      </p>
    </div>
  );
}
