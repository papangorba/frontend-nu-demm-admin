import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiAdmin, apiCommandes, apiLivraisons, fmtDT, money, Audit } from '../services/api';
import { StatusBadge, MiniCard, Spinner } from '../components/ui';
import { useToast, useTheme } from '../context/AppContext';
import CarteGenerale from '../components/CarteGenerale';
import { iconeVehicule, iconePersonne, iconeDrapeau, libelleVehicule, SENEGAL } from '../components/carteIcones';
import { useRegions, SelectZone, CadrerZone, Legende } from '../components/FiltreZone';

const REFRESH_MS = 5000;

const FILTERS = [
  { id: 'ALL',       label: 'Tout' },
  { id: 'COURSE',    label: '🚗 Courses' },
  { id: 'LIVRAISON', label: '📦 Livraisons' },
  { id: 'ATTENTE',   label: '⏳ En attente' },
  { id: 'ACTIF',     label: '▶ En cours' },
];

const STATUS_COLOR = { EN_ATTENTE: '#f59e0b', ACCEPTEE: '#06b6d4', EN_COURS: '#22c55e' };

/** Véhicule du trajet : orange = en course, anneau selon l'état */
const iconeTrajet = (it, sel) => iconeVehicule({
  code: it.vehicule, cap: it.cap, sel,
  etat: it.status === 'EN_ATTENTE' ? 'ATTENTE' : 'OCCUPE',
});

const ll = p => (p ? [p.lat, p.lng] : null);
const keyOf = it => `${it.kind}-${it.id}`;

/** Recadre la carte sur la sélection (ou sur tout) quand elle change. */
function FitTo({ points, token }) {
  const map = useMap();
  useEffect(() => {
    const pts = points.filter(Boolean);
    if (!pts.length) return;
    if (pts.length === 1) map.flyTo(pts[0], 15, { duration: 0.6 });
    else map.flyToBounds(L.latLngBounds(pts), { padding: [60, 60], duration: 0.6, maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  return null;
}

export default function Supervision() {
  const toast = useToast();
  const { dark } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [fitToken, setFitToken] = useState(0);
  const [, tick] = useState(0);
  const firstLoad = useRef(true);
  /** TRAJETS : trajets en direct ; CARTE : tous les clients et chauffeurs */
  // Liens directs : /supervision?mode=carte&zone=DAKAR
  const params = new URLSearchParams(window.location.search);
  const [mode, setMode] = useState(params.get('mode') === 'carte' ? 'CARTE' : 'TRAJETS');
  /** Zone : '' = tout le Sénégal, sinon le code d'une des 14 régions */
  const [zone, setZone] = useState((params.get('zone') || '').toUpperCase());
  const [jetonZone, setJetonZone] = useState(0);
  const regions = useRegions();

  const load = async () => {
    try {
      const res = await apiAdmin.live();
      setItems(res?.items || []);
      setUpdatedAt(Date.now());
      firstLoad.current = false; // la carte reste cadrée sur le Sénégal (ou la zone choisie)
    } catch (e) {
      toast(e.message, 'error');
      setLive(false); // évite une rafale d'erreurs
    } finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!live || mode !== 'TRAJETS') return;
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [live, mode]);
  // Rafraîchit le libellé « il y a X s »
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(t); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(it => {
      if (zone && it.region !== zone) return false;
      if (filter === 'COURSE' && it.kind !== 'COURSE') return false;
      if (filter === 'LIVRAISON' && it.kind !== 'LIVRAISON') return false;
      if (filter === 'ATTENTE' && it.status !== 'EN_ATTENTE') return false;
      if (filter === 'ACTIF' && it.status === 'EN_ATTENTE') return false;
      if (!q) return true;
      return [it.id, it.depart, it.destination, it.client?.name, it.client?.telephone,
        it.chauffeur?.name, it.chauffeur?.telephone]
        .some(v => String(v ?? '').toLowerCase().includes(q));
    });
  }, [items, filter, search, zone]);

  const sel = selected ? items.find(it => keyOf(it) === selected) : null;

  const dansZone = items.filter(it => !zone || it.region === zone);
  const counts = {
    attente: dansZone.filter(i => i.status === 'EN_ATTENTE').length,
    courses: dansZone.filter(i => i.kind === 'COURSE' && i.status !== 'EN_ATTENTE').length,
    livraisons: dansZone.filter(i => i.kind === 'LIVRAISON' && i.status !== 'EN_ATTENTE').length,
    localises: dansZone.filter(i => i.driver).length,
  };

  const focus = it => {
    setSelected(keyOf(it));
    setFitToken(t => t + 1);
  };

  const annuler = async it => {
    const label = it.kind === 'COURSE' ? 'la course' : 'la livraison';
    if (!window.confirm(`Annuler ${label} #${it.id} ? Le client${it.chauffeur ? ' et le chauffeur seront prévenus' : ' sera prévenu'}.`)) return;
    try {
      if (it.kind === 'COURSE') await apiCommandes.annuler(it.id);
      else await apiLivraisons.annuler(it.id);
      Audit.log(it.kind === 'COURSE' ? 'ANNULER_COMMANDE' : 'ANNULER_LIVRAISON', `#${it.id} annulée depuis la supervision`);
      toast(`${it.kind === 'COURSE' ? 'Course' : 'Livraison'} #${it.id} annulée`, 'success');
      setSelected(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const fitPoints = sel
    ? [ll(sel.driver), ll(sel.pickup), ll(sel.dropoff)]
    : filtered.flatMap(it => [ll(it.driver) || ll(it.pickup)]);

  const ago = updatedAt ? Math.max(0, Math.round((Date.now() - updatedAt) / 1000)) : null;

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Supervision en direct</h1>
          <p>
            <span className={`sv-live-dot ${live ? 'on' : ''}`} />
            {live ? 'En direct' : 'En pause'}
            {ago != null && ` · mis à jour il y a ${ago} s`}
          </p>
        </div>
        <div className="nd-page-header-actions">
          <div className="sv-chips" style={{ padding: 0 }}>
            <button className={`sv-chip ${mode === 'TRAJETS' ? 'active' : ''}`} onClick={() => setMode('TRAJETS')}>🛰 Trajets en direct</button>
            <button className={`sv-chip ${mode === 'CARTE' ? 'active' : ''}`} onClick={() => setMode('CARTE')}>🗺 Clients &amp; chauffeurs</button>
          </div>
          <SelectZone value={zone} regions={regions}
            onChange={z => { setZone(z); setSelected(null); setJetonZone(j => j + 1); }}
            compter={mode === 'TRAJETS' ? (code => items.filter(it => !code || it.region === code).length) : null} />
          {mode === 'TRAJETS' && <>
          <div className="nd-search-box">
            <span>🔍</span>
            <input placeholder="N°, adresse, client, chauffeur..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className={`nd-btn ${live ? 'nd-btn-outline' : 'nd-btn-primary'}`} onClick={() => setLive(l => !l)}>
            {live ? '⏸ Pause' : '▶ Reprendre'}
          </button>
          <button className="nd-btn nd-btn-outline" onClick={() => { setSelected(null); setFitToken(t => t + 1); }}>
            ⤢ Tout voir
          </button>
          </>}
        </div>
      </div>

      {mode === 'CARTE' ? <CarteGenerale zone={zone} regions={regions} jetonZone={jetonZone} /> : <>

      <div className="nd-mini-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
        <MiniCard color="var(--nd-amber)"  value={counts.attente}    label="En attente d'un chauffeur" />
        <MiniCard color="var(--nd-green)"  value={counts.courses}    label="Courses en cours" />
        <MiniCard color="var(--nd-purple)" value={counts.livraisons} label="Livraisons en cours" />
        <MiniCard color="var(--nd-cyan)"   value={counts.localises}  label="Chauffeurs localisés" />
      </div>

      <div className="sv-layout">
        {/* ─── Liste ─── */}
        <div className="nd-card sv-list">
          <div className="sv-chips">
            {FILTERS.map(f => (
              <button key={f.id} className={`sv-chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="sv-list-body">
            {loading ? <Spinner center /> : !filtered.length ? (
              <div className="nd-empty">
                <div style={{ fontSize: 34, marginBottom: 6 }}>🌙</div>
                Aucune activité en ce moment
              </div>
            ) : filtered.map(it => (
              <button key={keyOf(it)} className={`sv-item ${selected === keyOf(it) ? 'active' : ''}`} onClick={() => focus(it)}>
                <div className="sv-item-top">
                  <span className="sv-kind">{it.kind === 'COURSE' ? '🚗' : '📦'} #{it.id}</span>
                  <StatusBadge status={it.status} />
                </div>
                <div className="sv-route">
                  <span className="sv-dot g" /> <span className="sv-addr">{it.depart || '—'}</span>
                </div>
                <div className="sv-route">
                  <span className="sv-dot d" /> <span className="sv-addr">{it.destination || '—'}</span>
                </div>
                <div className="sv-item-foot">
                  <span>{it.chauffeur ? `👤 ${it.chauffeur.name}` : 'Sans chauffeur'}</span>
                  <span>{it.status !== 'EN_ATTENTE' && (it.aBord ? (it.kind === 'COURSE' ? '🟢 Client à bord' : '🟢 Colis récupéré') : '🟡 En approche')}</span>
                </div>
                {!it.driver && it.status !== 'EN_ATTENTE' && <div className="sv-warn">⚠ Position du chauffeur non reçue</div>}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Carte ─── */}
        <div className="nd-card sv-map">
          <MapContainer bounds={SENEGAL} style={{ height: '100%', width: '100%' }} zoomControl>
            {/* Fond OpenStreetMap (gratuit, sans clé) ; assombri par CSS en thème sombre */}
            <TileLayer
              key={dark ? 'dark' : 'light'}
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              className={dark ? 'sv-tiles-dark' : 'sv-tiles-light'}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <CadrerZone zone={zone} regions={regions} jeton={jetonZone} />
            <FitTo points={fitPoints} token={fitToken} />

            {/* Trajet de la sélection : prise en charge → destination */}
            {sel && sel.pickup && sel.dropoff && (
              <Polyline positions={[ll(sel.pickup), ll(sel.dropoff)]}
                pathOptions={{ color: '#94a3b8', weight: 3, dashArray: '6 8' }} />
            )}
            {sel && sel.driver && (sel.aBord ? sel.dropoff : sel.pickup) && (
              <Polyline positions={[ll(sel.driver), ll(sel.aBord ? sel.dropoff : sel.pickup)]}
                pathOptions={{ color: STATUS_COLOR[sel.status] || '#22c55e', weight: 4 }} />
            )}
            {sel?.pickup && <Marker position={ll(sel.pickup)} icon={iconePersonne({ couleur: '#2563eb' })} />}
            {sel?.dropoff && <Marker position={ll(sel.dropoff)} icon={iconeDrapeau()} />}

            {filtered.map(it => {
              const pos = ll(it.driver) || ll(it.pickup);
              if (!pos) return null;
              const isSel = selected === keyOf(it);
              return (
                <Marker key={keyOf(it)} position={pos}
                  icon={it.driver ? iconeTrajet(it, isSel) : iconePersonne({ couleur: '#f59e0b', attente: true })}
                  zIndexOffset={isSel ? 1000 : 0}
                  eventHandlers={{ click: () => setSelected(keyOf(it)) }}>
                  <Popup>
                    <div className="sv-popup">
                      <div className="sv-popup-title">
                        {it.kind === 'COURSE' ? '🚗 Course' : '📦 Livraison'} #{it.id}
                        {it.driver && <small className="nd-cell-sub"> · {libelleVehicule(it.vehicule)}</small>}
                      </div>
                      <div><b>Départ :</b> {it.depart || '—'}</div>
                      <div><b>Arrivée :</b> {it.destination || '—'}</div>
                      <div><b>Client :</b> {it.client ? `${it.client.name} · ${it.client.telephone}` : '—'}</div>
                      <div><b>Chauffeur :</b> {it.chauffeur ? `${it.chauffeur.name} · ${it.chauffeur.telephone}` : 'en recherche'}</div>
                      <div><b>Prix :</b> {money(it.prix)} · <b>Créée :</b> {fmtDT(it.createdAt)}</div>
                      <div className="sv-popup-actions">
                        {it.client?.telephone && <a className="nd-btn nd-btn-outline nd-btn-sm" href={`tel:${it.client.telephone}`}>📞 Client</a>}
                        {it.chauffeur?.telephone && <a className="nd-btn nd-btn-outline nd-btn-sm" href={`tel:${it.chauffeur.telephone}`}>📞 Chauffeur</a>}
                        <button className="nd-btn nd-btn-danger nd-btn-sm" onClick={() => annuler(it)}>✕ Annuler</button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
          <Legende />
        </div>
      </div>
      </>}
    </div>
  );
}
