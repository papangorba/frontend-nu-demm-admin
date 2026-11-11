import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Siren, Phone, MapPin, Car, User, Users, CheckCircle2, Headset, RefreshCw } from 'lucide-react';
import { apiSos, Auth, Audit, fmtDT } from '../services/api';
import { Spinner } from '../components/ui';
import { useToast } from '../context/AppContext';

/**
 * Alertes SOS envoyées depuis les apps client et chauffeur (sécurité, partie 1b).
 * La page se rafraîchit toute seule ; un bandeau rouge (BandeauSos) prévient
 * sur toutes les autres pages de l'admin, avec un bip à chaque nouvelle alerte.
 */

const STATUTS = {
  OUVERTE:         ['badge-danger',    'Nouvelle — à traiter'],
  PRISE_EN_CHARGE: ['badge-warn',      'Prise en charge'],
  RESOLUE:         ['badge-success',   'Résolue'],
  EN_SECURITE:     ['badge-secondary', "En sécurité (dit par l'utilisateur)"],
};

const ROLE = { CLIENT: 'Client', CHAUFFEUR: 'Chauffeur' };

/** « il y a 3 min » */
function depuis(d) {
  if (!d) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return fmtDT(d);
}

function tel(numero) {
  if (!numero) return '—';
  return <a href={`tel:${numero}`} className="sos-tel"><Phone size={13} />{numero}</a>;
}

/** Petit bip d'alerte (Web Audio, sans fichier son). */
function bip() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.12, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.26);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch { /* navigateur sans audio : tant pis */ }
}

// ═══════════════════════════════════════════════════════════════
//  Bandeau global (affiché sous la barre du haut, sur toutes les pages)
// ═══════════════════════════════════════════════════════════════
export function BandeauSos() {
  const [ouvertes, setOuvertes] = useState(0);
  const precedent = useRef(0);
  const location = useLocation();
  const navigate = useNavigate();
  const autorise = Auth.can('sos');

  useEffect(() => {
    if (!autorise) return;
    let actif = true;
    const charger = async () => {
      try {
        const c = await apiSos.compteur();
        if (!actif || !c) return;
        const n = Number(c.ouvertes) || 0;
        if (n > precedent.current) bip();
        precedent.current = n;
        setOuvertes(n);
      } catch { /* serveur injoignable : on réessaie au prochain tour */ }
    };
    charger();
    const id = setInterval(charger, 15000);
    return () => { actif = false; clearInterval(id); };
  }, [autorise]);

  // Titre de l'onglet : visible même quand l'admin regarde une autre fenêtre
  useEffect(() => {
    const base = document.title.replace(/^\(\d+ SOS\) /, '');
    document.title = ouvertes > 0 ? `(${ouvertes} SOS) ${base}` : base;
  }, [ouvertes]);

  if (!autorise || ouvertes === 0 || location.pathname === '/sos') return null;
  return (
    <div className="sos-bandeau" role="alert" onClick={() => navigate('/sos')}>
      <Siren size={18} />
      <b>{ouvertes === 1 ? '1 alerte SOS à traiter' : `${ouvertes} alertes SOS à traiter`}</b>
      <span className="sos-bandeau-lien">Voir maintenant →</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Page « Alertes SOS »
// ═══════════════════════════════════════════════════════════════
export default function AlertesSos() {
  const toast = useToast();
  const [filtre, setFiltre] = useState('ACTIVES');
  const [alertes, setAlertes] = useState(null);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);
  const [, setTic] = useState(0); // fait vivre les « il y a X min »

  const charger = async (f = filtre) => {
    try { setAlertes(await apiSos.liste(f) || []); }
    catch (e) { toast(e.message, 'error'); setAlertes(a => a || []); }
  };

  useEffect(() => {
    setAlertes(null);
    charger(filtre);
    const id = setInterval(() => { charger(filtre); setTic(t => t + 1); }, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtre]);

  const traiter = async (a, statut) => {
    setBusy(a.id);
    try {
      const note = notes[a.id];
      await apiSos.traiter(a.id, { statut, ...(note !== undefined ? { note } : {}) });
      Audit.log(statut === 'RESOLUE' ? 'SOS_RESOLU' : 'SOS_PRIS_EN_CHARGE', `Alerte #${a.id} — ${a.auteurNom}`);
      toast(statut === 'RESOLUE' ? `Alerte #${a.id} résolue`
        : `Alerte #${a.id} prise en charge — ${a.auteurNom} a été prévenu(e)`, 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  const enregistrerNote = async a => {
    setBusy(a.id);
    try {
      await apiSos.traiter(a.id, { note: notes[a.id] || '' });
      toast('Note enregistrée', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Alertes SOS</h1>
          <p>Alertes déclenchées pendant une course ou une livraison. Appelez la personne, puis indiquez la prise en charge : elle reçoit une notification. L'autre personne du trajet n'est jamais prévenue.</p>
        </div>
        <button className="nd-btn nd-btn-ghost" onClick={() => charger()}><RefreshCw size={15} /> Actualiser</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['ACTIVES', 'En cours'], ['TOUTES', 'Historique']].map(([k, l]) => (
          <button key={k} className={`nd-btn nd-btn-sm ${filtre === k ? 'nd-btn-primary' : 'nd-btn-outline'}`} onClick={() => setFiltre(k)}>{l}</button>
        ))}
      </div>

      {alertes === null ? <Spinner center /> : alertes.length === 0 ? (
        <div className="nd-card"><div className="nd-card-body" style={{ textAlign: 'center', padding: 40 }}>
          <CheckCircle2 size={40} color="var(--nd-green)" />
          <p className="nd-cell-sub">{filtre === 'ACTIVES' ? 'Aucune alerte en cours' : 'Aucune alerte pour le moment'}</p>
        </div></div>
      ) : (
        <div className="sos-grille">
          {alertes.map(a => {
            const [cls, label] = STATUTS[a.statut] || ['badge-secondary', a.statut];
            const active = a.statut === 'OUVERTE' || a.statut === 'PRISE_EN_CHARGE';
            const carte = a.latitude != null && a.longitude != null
              ? `https://www.google.com/maps?q=${a.latitude},${a.longitude}` : null;
            return (
              <div key={a.id} className={`nd-card sos-carte${a.statut === 'OUVERTE' ? ' sos-ouverte' : ''}`}>
                <div className="nd-card-body">
                  <div className="sos-entete">
                    <div>
                      <b>Alerte #{a.id}</b>
                      <small className="nd-cell-sub" style={{ display: 'block' }}>{fmtDT(a.createdAt)} · {depuis(a.createdAt)}</small>
                    </div>
                    <span className={`nd-badge ${cls}`}>{label}</span>
                  </div>

                  <div className="sos-ligne"><User size={15} />
                    <div><b>{a.auteurNom || '—'}</b> <span className="nd-cell-sub">({ROLE[a.auteurRole] || a.auteurRole})</span><br />{tel(a.auteurTelephone)}</div>
                  </div>

                  {a.typeTrajet && (
                    <div className="sos-ligne"><Car size={15} />
                      <div>
                        {a.typeTrajet === 'LIVRAISON' ? 'Livraison' : 'Course'} #{a.trajetId}
                        {(a.depart || a.destination) && <><br /><span className="nd-cell-sub">{a.depart || '?'} → {a.destination || '?'}</span></>}
                        {a.vehicule && <><br /><span className="nd-cell-sub">{a.vehicule}</span></>}
                      </div>
                    </div>
                  )}

                  {a.autreNom && (
                    <div className="sos-ligne"><Users size={15} />
                      <div>
                        <span className="nd-cell-sub">{a.auteurRole === 'CLIENT' ? 'Chauffeur' : 'Client'} :</span> {a.autreNom}<br />{tel(a.autreTelephone)}
                      </div>
                    </div>
                  )}

                  <div className="sos-ligne"><MapPin size={15} />
                    <div>
                      {carte ? <a href={carte} target="_blank" rel="noreferrer">Voir la position sur la carte</a> : 'Position inconnue'}
                      {a.positionMaj && <><br /><span className="nd-cell-sub">Mise à jour {depuis(a.positionMaj)}</span></>}
                    </div>
                  </div>

                  {a.contacts?.length > 0 && (
                    <div className="sos-ligne"><Phone size={15} />
                      <div>
                        <span className="nd-cell-sub">Contacts d'urgence :</span>
                        {a.contacts.map(c => (
                          <div key={c.telephone}>{c.nom}{c.lien ? ` (${c.lien})` : ''} — {tel(c.telephone)}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {a.traiteePar && (
                    <small className="nd-cell-sub" style={{ display: 'block', marginTop: 6 }}>
                      Traitée par {a.traiteePar} · {fmtDT(a.traiteeLe)}
                    </small>
                  )}

                  <textarea className="nd-input" rows={2} style={{ marginTop: 10 }}
                    placeholder="Note interne (appel passé, police prévenue…)"
                    value={notes[a.id] ?? a.noteAdmin ?? ''}
                    onChange={e => setNotes(n => ({ ...n, [a.id]: e.target.value }))} />

                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {a.statut === 'OUVERTE' && (
                      <button className="nd-btn nd-btn-danger nd-btn-sm" disabled={busy === a.id} onClick={() => traiter(a, 'PRISE_EN_CHARGE')}>
                        <Headset size={14} /> Je prends en charge
                      </button>
                    )}
                    {active && (
                      <button className="nd-btn nd-btn-primary nd-btn-sm" disabled={busy === a.id} onClick={() => traiter(a, 'RESOLUE')}>
                        <CheckCircle2 size={14} /> Marquer résolue
                      </button>
                    )}
                    {notes[a.id] !== undefined && notes[a.id] !== (a.noteAdmin ?? '') && (
                      <button className="nd-btn nd-btn-outline nd-btn-sm" disabled={busy === a.id} onClick={() => enregistrerNote(a)}>
                        Enregistrer la note
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
