import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { PhoneCall, Car, Bike, Search, Send, MapPin, Flag, RotateCcw } from 'lucide-react';
import { apiCommandes, Audit } from '../services/api';
import { SENEGAL } from '../components/carteIcones';
import { useToast, useTheme } from '../context/AppContext';

/**
 * Commande par téléphone : le client appelle le service client (personne qui ne sait pas lire, pas de
 * smartphone, pas d'internet…). L'agent place le départ et la destination, voit le prix, et envoie la
 * demande aux chauffeurs comme si le client l'avait faite dans l'app. Le client reçoit un SMS avec le nom,
 * le véhicule et le numéro du chauffeur dès qu'il accepte.
 */

const fcfa = n => `${Number(n || 0).toLocaleString('fr-FR')} F`;
const pastille = (couleur, lettre) => L.divIcon({
  className: '',
  html: `<div style="width:30px;height:30px;border-radius:50%;background:${couleur};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">${lettre}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});
const ICONE_DEPART = pastille('#16a34a', 'A');
const ICONE_ARRIVEE = pastille('#dc2626', 'B');

/** Distance à vol d'oiseau (km) : le serveur recalcule le prix final */
function km(a, b) {
  const r = Math.PI / 180, R = 6371;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Recherche d'adresse libre (OpenStreetMap), limitée au Sénégal */
async function chercherAdresse(q) {
  const u = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=sn&accept-language=fr&q=${encodeURIComponent(q)}`;
  const r = await fetch(u);
  if (!r.ok) throw new Error('Recherche indisponible');
  return (await r.json()).map(x => ({ nom: x.display_name.split(',').slice(0, 3).join(','), lat: +x.lat, lng: +x.lon }));
}
async function nomDuLieu({ lat, lng }) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=17&accept-language=fr&lat=${lat}&lon=${lng}`);
    const x = await r.json();
    return (x.display_name || '').split(',').slice(0, 3).join(',') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch { return `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
}

function Clics({ onClic }) {
  useMapEvents({ click: e => onClic({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function ChampLieu({ titre, icone, valeur, onChoix, actif, onActiver }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { setQ(valeur?.nom || ''); }, [valeur]);
  const chercher = async e => {
    e?.preventDefault();
    if (q.trim().length < 3) return;
    setBusy(true);
    try {
      const r = await chercherAdresse(q.trim());
      setRes(r);
      if (!r.length) toast('Aucune adresse trouvée : cliquez directement sur la carte', 'info');
    } catch (err) { toast(err.message, 'error'); }
    finally { setBusy(false); }
  };
  return (
    <div className="nd-form-group" style={{ position: 'relative' }}>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{icone} {titre}</label>
      <form onSubmit={chercher} style={{ display: 'flex', gap: 6 }}>
        <input className="nd-input" value={q} onChange={e => setQ(e.target.value)} onFocus={onActiver}
          placeholder="Quartier, rue, lieu connu… puis Entrée" style={actif ? { borderColor: 'var(--nd-primary)', borderWidth: 2 } : undefined} />
        <button className="nd-btn nd-btn-outline" disabled={busy} type="submit"><Search size={15} /></button>
      </form>
      <small className="nd-cell-sub">{actif ? '👉 ou cliquez sur la carte pour placer ce point' : valeur ? `📍 ${valeur.lat.toFixed(5)}, ${valeur.lng.toFixed(5)}` : ''}</small>
      {res.length > 0 && (
        <div className="nd-card" style={{ position: 'absolute', zIndex: 1000, top: '100%', left: 0, right: 0, padding: 4 }}>
          {res.map(r => (
            <button key={`${r.lat},${r.lng}`} type="button" className="nd-btn nd-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }}
              onClick={() => { onChoix(r); setRes([]); }}>{r.nom}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommandeTelephone() {
  const toast = useToast();
  const { dark } = useTheme();
  const [telephone, setTelephone] = useState('');
  const [nom, setNom] = useState('');
  const [vehicule, setVehicule] = useState('VOITURE');
  const [depart, setDepart] = useState(null);
  const [arrivee, setArrivee] = useState(null);
  const [pointActif, setPointActif] = useState('depart');
  const [estimation, setEstimation] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [creees, setCreees] = useState([]);
  const carte = useRef(null);

  const distance = depart && arrivee ? km(depart, arrivee) * 1.3 : null; // ≈ distance par la route

  useEffect(() => {
    if (!depart || !arrivee) { setEstimation(null); return; }
    let annule = false;
    apiCommandes.estimation({ vehicule, depart, arrivee, distanceKm: distance })
      .then(e => !annule && setEstimation(e)).catch(() => !annule && setEstimation(null));
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depart, arrivee, vehicule]);

  const placer = async p => {
    const lieu = { ...p, nom: await nomDuLieu(p) };
    if (pointActif === 'depart') { setDepart(lieu); setPointActif(arrivee ? null : 'arrivee'); }
    else if (pointActif === 'arrivee') { setArrivee(lieu); setPointActif(null); }
  };
  const choisir = quoi => p => {
    if (quoi === 'depart') { setDepart(p); setPointActif(arrivee ? null : 'arrivee'); }
    else { setArrivee(p); setPointActif(null); }
    carte.current?.setView([p.lat, p.lng], 15);
  };

  const tel = telephone.replace(/\D/g, '').replace(/^221/, '');
  const pret = /^[37]\d{8}$/.test(tel) && depart && arrivee;

  const envoyer = async () => {
    setEnvoi(true);
    try {
      const r = await apiCommandes.parTelephone({
        telephone: tel, nom: nom.trim(), typeVehicule: vehicule,
        depart: depart.nom, latitudeDepart: depart.lat, longitudeDepart: depart.lng,
        destination: arrivee.nom, latitudeDestination: arrivee.lat, longitudeDestination: arrivee.lng,
        distanceKm: distance ? Math.round(distance * 10) / 10 : undefined,
      });
      Audit.log('COMMANDE_TELEPHONE', `#${r.id} pour le ${tel} : ${depart.nom} → ${arrivee.nom} (${fcfa(r.prix)})`);
      toast(`Course #${r.id} envoyée aux chauffeurs. Le client reçoit un SMS dès qu'un chauffeur accepte.`, 'success');
      setCreees(c => [{ ...r, depart: depart.nom, destination: arrivee.nom, le: new Date() }, ...c].slice(0, 10));
      setTelephone(''); setNom(''); setDepart(null); setArrivee(null); setPointActif('depart');
    } catch (e) { toast(e.message, 'error'); }
    finally { setEnvoi(false); }
  };

  return (
    <div className="nd-page">
      <div className="nd-page-header">
        <div>
          <h1 style={{ display: 'flex', gap: 8, alignItems: 'center' }}><PhoneCall size={22} /> Commande par téléphone</h1>
          <p className="nd-cell-sub">Pour les clients qui appellent le service client : la course part aux chauffeurs comme dans l'app,
            et le client reçoit un SMS avec le nom, le véhicule et le numéro du chauffeur.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr', gap: 16, alignItems: 'start' }} className="ct-grille">
        <div className="nd-card"><div className="nd-card-body" style={{ display: 'grid', gap: 12 }}>
          <div className="nd-form-group">
            <label>Numéro du client</label>
            <input className="nd-input" inputMode="tel" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="77 123 45 67" />
          </div>
          <div className="nd-form-group">
            <label>Prénom et nom (si nouveau client)</label>
            <input className="nd-input" value={nom} onChange={e => setNom(e.target.value)} placeholder="facultatif" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['VOITURE', <Car size={15} />, 'Voiture'], ['MOTO', <Bike size={15} />, 'Moto-taxi']].map(([k, i, l]) => (
              <button key={k} type="button" onClick={() => setVehicule(k)} style={{ flex: 1 }}
                className={`nd-btn ${vehicule === k ? 'nd-btn-primary' : 'nd-btn-outline'}`}>{i} {l}</button>
            ))}
          </div>
          <ChampLieu titre="Départ" icone={<MapPin size={15} color="#16a34a" />} valeur={depart} onChoix={choisir('depart')}
            actif={pointActif === 'depart'} onActiver={() => setPointActif('depart')} />
          <ChampLieu titre="Destination" icone={<Flag size={15} color="#dc2626" />} valeur={arrivee} onChoix={choisir('arrivee')}
            actif={pointActif === 'arrivee'} onActiver={() => setPointActif('arrivee')} />

          {estimation && (
            <div className="nd-alert nd-alert-info" style={{ display: 'block' }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{fcfa(estimation.prix)}</div>
              <small>≈ {estimation.distanceKm} km · {estimation.libelle}{estimation.majorationTexte ? ` · ${estimation.majorationTexte}` : ''}</small>
              <div><small>Dites ce prix au client. Il paie le chauffeur en espèces.</small></div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="nd-btn nd-btn-outline" type="button" onClick={() => { setDepart(null); setArrivee(null); setPointActif('depart'); }}>
              <RotateCcw size={15} /> Effacer
            </button>
            <button className="nd-btn nd-btn-primary" style={{ flex: 1 }} disabled={!pret || envoi} onClick={envoyer}>
              <Send size={15} /> {envoi ? 'Envoi…' : 'Envoyer aux chauffeurs'}
            </button>
          </div>
          {!/^[37]\d{8}$/.test(tel) && telephone && <small style={{ color: 'var(--nd-red)' }}>Numéro : 9 chiffres (77…, 78…, 76…, 70…, 33…)</small>}

          {creees.length > 0 && (
            <div>
              <b>Envoyées pendant cette session</b>
              {creees.map(c => (
                <div key={c.id} className="nd-cell-sub" style={{ padding: '6px 0', borderTop: '1px solid var(--nd-border, #e5e7eb)' }}>
                  <b>#{c.id}</b> · {c.client?.nom} ({c.client?.telephone}) · {fcfa(c.prix)}{c.client?.nouveau ? ' · nouveau client' : ''}
                  <div>{c.depart} → {c.destination}</div>
                  <a href={`/supervision`}>Suivre dans la supervision</a>
                </div>
              ))}
            </div>
          )}
        </div></div>

        <div className="nd-card" style={{ height: 'min(72vh, 640px)', overflow: 'hidden' }}>
          <MapContainer bounds={SENEGAL} style={{ height: '100%', width: '100%' }} ref={carte}>
            <TileLayer
              key={dark ? 'dark' : 'light'}
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              className={dark ? 'sv-tiles-dark' : 'sv-tiles-light'}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <Clics onClic={placer} />
            {depart && <Marker position={[depart.lat, depart.lng]} icon={ICONE_DEPART} draggable
              eventHandlers={{ dragend: async e => { const p = e.target.getLatLng(); setDepart({ lat: p.lat, lng: p.lng, nom: await nomDuLieu(p) }); } }} />}
            {arrivee && <Marker position={[arrivee.lat, arrivee.lng]} icon={ICONE_ARRIVEE} draggable
              eventHandlers={{ dragend: async e => { const p = e.target.getLatLng(); setArrivee({ lat: p.lat, lng: p.lng, nom: await nomDuLieu(p) }); } }} />}
            {depart && arrivee && <Polyline positions={[[depart.lat, depart.lng], [arrivee.lat, arrivee.lng]]} pathOptions={{ dashArray: '6 8', color: '#2563eb' }} />}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
