import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Rectangle, Popup, useMap, useMapEvents } from 'react-leaflet';
import { iconeVehicule, iconePersonne, libelleVehicule, SENEGAL, bornesRegion } from './carteIcones';
import { CadrerZone, Legende, GlisserPaveTactile } from './FiltreZone';
import { apiFiche, fmtDT } from '../services/api';
import { MiniCard, Spinner } from './ui';
import { useToast, useTheme } from '../context/AppContext';
import FicheUtilisateur from './FicheUtilisateur';

/**
 * Carte de tous les clients et chauffeurs (dernière position connue) + demandes de la période,
 * pour savoir où sont les clients et où il manque des chauffeurs.
 */

const ACTUALISATION_MS = 30000;
const MAILLE = 0.01; // zone ≈ 1,1 km (comme le serveur)

const COULEUR = {
  EN_LIGNE: '#16a34a', OCCUPE: '#f59e0b', HORS_LIGNE: '#94a3b8', CLIENT: '#2563eb',
  T: '#16a34a', E: '#dc2626', X: '#64748b', R: '#f59e0b',
};
const LIB_ETAT = { EN_LIGNE: 'En ligne (libre)', OCCUPE: 'En course', HORS_LIGNE: 'Hors ligne' };
const LIB_DEMANDE = { T: 'chauffeur trouvé', E: 'sans chauffeur', X: 'annulée', R: 'en recherche' };
const PERIODES = [[1, "Aujourd'hui"], [7, '7 jours'], [30, '30 jours'], [90, '3 mois']];

function Voler({ cible }) {
  const map = useMap();
  useEffect(() => { if (cible) map.flyTo(cible.pos, cible.zoom || 15, { duration: 0.6 }); }, [cible, map]);
  return null;
}

/** Niveau de zoom (les clients deviennent des épingles quand on zoome) */
function SuiviZoom({ onZoom }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  return null;
}

/** Point dans le cadre d'une région (pour les zones de 1 km, qui n'ont pas de code de région) */
const dansCadre = (lat, lng, r) => {
  const b = bornesRegion(r);
  return lat >= b[0][0] && lat <= b[1][0] && lng >= b[0][1] && lng <= b[1][1];
};

function Case({ actif, onChange, couleur, children }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
      <input type="checkbox" checked={actif} onChange={e => onChange(e.target.checked)} />
      <span style={{ width: 10, height: 10, borderRadius: 5, background: couleur, display: 'inline-block' }} />
      {children}
    </label>
  );
}

export default function CarteGenerale({ zone = '', regions = [], jetonZone = 0 }) {
  const toast = useToast();
  const { dark } = useTheme();
  const [d, setD] = useState(null);
  const [jours, setJours] = useState(30);
  const [vue, setVue] = useState({ chauffeurs: true, horsLigne: true, clients: true, demandes: true, zones: true });
  const [onglet, setOnglet] = useState('zones');
  const [cible, setCible] = useState(null);
  const [ficheId, setFicheId] = useState(null);
  const [zoom, setZoom] = useState(7);

  const charger = async () => {
    try { setD(await apiFiche.carte(jours)); }
    catch (e) { toast(e.message, 'error'); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setD(null); charger(); const t = setInterval(charger, ACTUALISATION_MS); return () => clearInterval(t); }, [jours]);

  // Tout ce qui est affiché se limite à la zone choisie
  const r = regions.find(x => x.code === zone);
  const vue2 = useMemo(() => {
    if (!d) return null;
    if (!zone) return d;
    return {
      ...d,
      chauffeurs: d.chauffeurs.filter(c => c.region === zone),
      clients: d.clients.filter(c => c.region === zone),
      demandes: d.demandes.filter(x => x[4] === zone),
      zones: d.zones.filter(z => r && dansCadre(z.lat, z.lng, r)),
      regions: d.regions,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, zone, r]);

  const compte = useMemo(() => {
    const c = vue2?.chauffeurs || [];
    return {
      enLigne: c.filter(x => x.etat === 'EN_LIGNE').length,
      occupe: c.filter(x => x.etat === 'OCCUPE').length,
      horsLigne: c.filter(x => x.etat === 'HORS_LIGNE').length,
      clients: (vue2?.clients || []).length,
      manque: (vue2?.zones || []).filter(z => z.manqueChauffeurs).length,
      demandes: (vue2?.demandes || []).length,
    };
  }, [vue2]);

  const set = k => v => setVue(o => ({ ...o, [k]: v }));
  const popupPersonne = (p, role) => (
    <Popup>
      <div className="sv-popup">
        <div className="sv-popup-title">{role === 'CLIENT' ? '🧍 Client' : '🚗 Chauffeur'} #{p.id}</div>
        <div><b>{p.name || '—'}</b> · {p.telephone}</div>
        {p.etat && <div>{LIB_ETAT[p.etat]} · {libelleVehicule(p.vehicule)}</div>}
        <div className="nd-cell-sub">Position du {fmtDT(p.depuis)}</div>
        <div className="sv-popup-actions">
          <a className="nd-btn nd-btn-outline nd-btn-sm" href={`tel:+221${p.telephone}`}>📞 Appeler</a>
          <button className="nd-btn nd-btn-primary nd-btn-sm" onClick={() => setFicheId(p.id)}>Fiche</button>
        </div>
      </div>
    </Popup>
  );

  if (!d || !vue2) return <Spinner center />;
  const v = vue2;

  return (
    <>
      <div className="nd-mini-stats" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 18 }}>
        <MiniCard color="var(--nd-blue)" value={compte.clients} label="Clients localisés" />
        <MiniCard color="var(--nd-green)" value={compte.enLigne} label="Chauffeurs en ligne" />
        <MiniCard color="var(--nd-amber)" value={compte.occupe} label="En course" />
        <MiniCard color="var(--nd-purple)" value={zone ? compte.demandes : d.demandesTotal} label={`Demandes (${PERIODES.find(p => p[0] === jours)?.[1]})`} />
        <MiniCard color="var(--nd-red)" value={compte.manque} label="Zones où il manque des chauffeurs" />
      </div>

      <div className="sv-layout">
        <div className="nd-card sv-list">
          <div style={{ padding: '12px 12px 6px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select className="nd-input nd-select" value={jours} onChange={e => setJours(Number(e.target.value))}>
              {PERIODES.map(([v, l]) => <option key={v} value={v}>Demandes : {l}</option>)}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <Case actif={vue.chauffeurs} onChange={set('chauffeurs')} couleur={COULEUR.EN_LIGNE}>Chauffeurs actifs</Case>
              <Case actif={vue.horsLigne} onChange={set('horsLigne')} couleur={COULEUR.HORS_LIGNE}>Hors ligne</Case>
              <Case actif={vue.clients} onChange={set('clients')} couleur={COULEUR.CLIENT}>Clients</Case>
              <Case actif={vue.demandes} onChange={set('demandes')} couleur={COULEUR.E}>Demandes</Case>
              <Case actif={vue.zones} onChange={set('zones')} couleur="#dc2626">Zones à renforcer</Case>
            </div>
          </div>
          <div className="sv-chips">
            <button className={`sv-chip ${onglet === 'zones' ? 'active' : ''}`} onClick={() => setOnglet('zones')}>Zones les plus demandées</button>
            <button className={`sv-chip ${onglet === 'regions' ? 'active' : ''}`} onClick={() => setOnglet('regions')}>Par région</button>
          </div>
          <div className="sv-list-body">
            {onglet === 'zones' ? (!v.zones.length ? <div className="nd-empty">Pas encore de données dans cette zone</div> :
              v.zones.map((z, i) => (
                <button key={`${z.lat}-${z.lng}`} className="sv-item" onClick={() => setCible({ pos: [z.lat, z.lng], zoom: 15 })}>
                  <div className="sv-item-top">
                    <span className="sv-kind">#{i + 1} · zone de 1 km</span>
                    {z.manqueChauffeurs
                      ? <span className="nd-badge badge-danger">Manque de chauffeurs</span>
                      : <span className="nd-badge badge-success">Couverte</span>}
                  </div>
                  <div className="sv-item-foot" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <span>📍 {z.demandes} demande(s)</span>
                    <span>🧍 {z.clients} client(s)</span>
                    <span>🚗 {z.chauffeursEnLigne} en ligne</span>
                    {z.tauxReussite != null && <span>✅ {z.tauxReussite} % servies</span>}
                    {z.sansChauffeur > 0 && <span style={{ color: 'var(--nd-red)' }}>⏱ {z.sansChauffeur} sans chauffeur</span>}
                  </div>
                </button>
              ))) : (
              <table className="nd-table" style={{ fontSize: 13 }}>
                <thead><tr><th>Région</th><th>Clients</th><th>Chauffeurs</th><th>Demandes</th><th>Sans chauff.</th></tr></thead>
                <tbody>{d.regions.map(r => (
                  <tr key={r.region} style={zone && regions.find(x => x.code === zone)?.nom === r.region ? { background: 'rgba(69,39,120,.08)', fontWeight: 700 } : undefined}>
                    <td><b>{r.region}</b></td><td>{r.clients}</td>
                    <td>{r.chauffeurs} <small className="nd-cell-sub">({r.chauffeursEnLigne} en ligne)</small></td>
                    <td>{r.demandes}</td>
                    <td style={{ color: r.sansChauffeur ? 'var(--nd-red)' : undefined }}>{r.sansChauffeur}</td>
                  </tr>))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="nd-card sv-map">
          <MapContainer bounds={SENEGAL} style={{ height: '100%', width: '100%' }} preferCanvas>
            <TileLayer
              key={dark ? 'dark' : 'light'}
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              className={dark ? 'sv-tiles-dark' : 'sv-tiles-light'}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <Voler cible={cible} />
            <CadrerZone zone={zone} regions={regions} jeton={jetonZone} />
            <GlisserPaveTactile />
            <SuiviZoom onZoom={setZoom} />

            {/* Zones où il manque des chauffeurs */}
            {vue.zones && v.zones.filter(z => z.manqueChauffeurs).map(z => (
              <Rectangle key={`z-${z.lat}-${z.lng}`}
                bounds={[[z.lat - MAILLE / 2, z.lng - MAILLE / 2], [z.lat + MAILLE / 2, z.lng + MAILLE / 2]]}
                pathOptions={{ color: '#dc2626', weight: 1.5, fillColor: '#dc2626', fillOpacity: 0.12 }}>
                <Popup>
                  <b>Zone à renforcer</b><br />{z.demandes} demande(s) · {z.clients} client(s) · {z.chauffeursEnLigne} chauffeur(s) en ligne
                </Popup>
              </Rectangle>
            ))}

            {/* Demandes : plus il y en a, plus la zone est foncée */}
            {vue.demandes && v.demandes.map(([lat, lng, code, type], i) => (
              <CircleMarker key={`d-${i}`} center={[lat, lng]} radius={5} interactive={false}
                pathOptions={{ stroke: false, fillColor: COULEUR[code] || '#f59e0b', fillOpacity: 0.28 }}>
                <Popup>{type === 'COURSE' ? 'Course' : type === 'CARGO' ? 'Cargo' : 'Livraison'} · {LIB_DEMANDE[code]}</Popup>
              </CircleMarker>
            ))}

            {/* Clients : petits points vus de loin, épingles avec une personne de près */}
            {vue.clients && v.clients.map(c => zoom >= 12 ? (
              <Marker key={`c-${c.id}`} position={[c.lat, c.lng]} icon={iconePersonne({ couleur: COULEUR.CLIENT, petit: true })}>
                {popupPersonne(c, 'CLIENT')}
              </Marker>
            ) : (
              <CircleMarker key={`c-${c.id}`} center={[c.lat, c.lng]} radius={5}
                pathOptions={{ color: '#fff', weight: 1.5, fillColor: COULEUR.CLIENT, fillOpacity: 0.9 }}>
                {popupPersonne(c, 'CLIENT')}
              </CircleMarker>
            ))}

            {/* Chauffeurs : leur véhicule (voiture, moto, fourgon…) orienté, anneau = état */}
            {v.chauffeurs.filter(c => (c.etat === 'HORS_LIGNE' ? vue.horsLigne : vue.chauffeurs)).map(c => (
              <Marker key={`ch-${c.id}`} position={[c.lat, c.lng]} zIndexOffset={c.etat === 'HORS_LIGNE' ? 0 : 500}
                icon={iconeVehicule({ code: c.vehicule, etat: c.etat, cap: c.cap })}>
                {popupPersonne(c, 'CHAUFFEUR')}
              </Marker>
            ))}
          </MapContainer>
          <Legende demandes={vue.demandes} />
        </div>
      </div>

      {ficheId && <FicheUtilisateur userId={ficheId} onClose={() => setFicheId(null)} onOuvrirAutre={id => setFicheId(id)} />}
    </>
  );
}
