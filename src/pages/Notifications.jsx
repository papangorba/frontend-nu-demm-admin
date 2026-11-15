import { useEffect, useMemo, useState } from 'react';
import { apiAdmin, apiUsers, apiNotifs, fmtDT, Audit } from '../services/api';
import { Avatar, RoleBadge, Spinner } from '../components/ui';
import { useToast } from '../context/AppContext';

const CIBLES = [
  { id: 'CLIENTS',     icon: '👥', label: 'Tous les clients',    sub: 'App Ñu Demm' },
  { id: 'CHAUFFEURS',  icon: '🏍', label: 'Tous les chauffeurs', sub: 'App Ñu Demm Pro' },
  { id: 'TOUS',        icon: '📣', label: 'Tout le monde',       sub: 'Clients + chauffeurs' },
  { id: 'UTILISATEUR', icon: '🎯', label: 'Un utilisateur',      sub: 'Message personnel' },
];

const MODELES = [
  { label: '🎁 Promo',       titre: 'Offre spéciale 🎁', message: '-20 % sur votre prochaine course ce week-end avec Ñu Demm !' },
  { label: '🛠 Maintenance', titre: 'Maintenance prévue', message: "L'application sera indisponible ce soir de 23h à 23h30. Merci de votre compréhension." },
  { label: '🌧 Météo',       titre: 'Fortes pluies annoncées 🌧', message: 'Prévoyez un peu plus de temps pour vos déplacements aujourd\'hui. Soyez prudents !' },
  { label: '🚗 Chauffeurs',  titre: 'Forte demande en ce moment 🔥', message: 'Beaucoup de clients attendent près de chez vous : passez en ligne !' },
];

/** Icône et couleur par type de notification (comme dans les apps) */
const TYPES = {
  COURSE: ['🚗', '#f97316', 'Course'], LIVRAISON: ['📦', '#a855f7', 'Livraison'], NOUVELLE_COURSE: ['🚗', '#f97316', 'Nouvelle course'],
  NOUVELLE_LIVRAISON: ['📦', '#a855f7', 'Nouvelle livraison'], COURSE_PROGRAMMEE: ['📅', '#4f46e5', 'Programmée'],
  RESERVATION: ['🎫', '#0d9488', 'Réservation'], PAIEMENT: ['💳', '#0d9488', 'Paiement'], ANNULATION: ['✖', '#ef4444', 'Annulation'],
  SOS: ['🆘', '#dc2626', 'Sécurité'], TRAJET: ['🔔', '#2563eb', 'Alerte trajet'], ANNONCE: ['📣', '#452778', 'Annonce'],
  BIENVENUE: ['👋', '#16a34a', 'Bienvenue'], SYSTEME: ['ℹ', '#64748b', 'Information'],
  CLIENTS: ['👥', '#2563eb', 'Clients'], CHAUFFEURS: ['🏍', '#f59e0b', 'Chauffeurs'], TOUS: ['📣', '#452778', 'Tout le monde'],
  UTILISATEUR: ['🎯', '#16a34a', 'Personnel'],
};
const typeDe = t => TYPES[t] || ['🔔', '#452778', t || 'Notification'];

/** « à l'instant », « il y a 5 min », « hier à 14:20 », sinon la date */
const ilYa = iso => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  const hh = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 24 * 60 && d.getDate() === new Date().getDate()) return `aujourd'hui à ${hh}`;
  if (min < 48 * 60) return `hier à ${hh}`;
  return fmtDT(iso);
};

/** Une notification, présentée comme sur le téléphone : pastille du type, titre, message, heure */
function LigneNotif({ type, titre, message, quand, lu = true, destinataire }) {
  const [icone, couleur, libelle] = typeDe(type);
  return (
    <div className={`pc-item${lu ? '' : ' non-lu'}`}>
      <span className="pc-item-icone" style={{ background: `${couleur}1f`, color: couleur }}>{icone}</span>
      <div className="pc-item-corps">
        <div className="pc-item-haut">
          <b className="pc-item-titre">{titre || 'Notification'}</b>
          {!lu && <span className="pc-item-point" title="Non lue" />}
        </div>
        <div className="pc-item-msg">{message}</div>
        <div className="pc-item-bas">
          <span className="pc-item-etiquette" style={{ color: couleur, borderColor: `${couleur}55` }}>{libelle}</span>
          {destinataire && <span>→ {destinataire}</span>}
          <span>{ilYa(quand)}</span>
        </div>
      </div>
    </div>
  );
}

const HISTORY_KEY = 'nd2_push_history';
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; } };

export default function Notifications() {
  const toast = useToast();
  const [cible, setCible] = useState('CLIENTS');
  const [titre, setTitre] = useState('');
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [userQuery, setUserQuery] = useState('');
  const [user, setUser] = useState(null);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState(loadHistory);
  const [apercu, setApercu] = useState('android');

  // Boîte de réception de l'utilisateur sélectionné
  const [inbox, setInbox] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);

  useEffect(() => {
    apiUsers.all()
      .then(all => setUsers((all || []).filter(u => u.role === 'CLIENT' || u.role === 'CHAUFFEUR')))
      .catch(e => toast(e.message, 'error'));
    // eslint-disable-next-line
  }, []);

  const matches = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return [];
    return users.filter(u =>
      String(u.id) === q ||
      (u.name || '').toLowerCase().includes(q) ||
      (u.telephone || '').includes(q)).slice(0, 6);
  }, [users, userQuery]);

  const userType = u => (u?.role === 'CHAUFFEUR' ? 'CHAUFFEUR' : 'CLIENT');

  const loadInbox = async u => {
    if (!u) return;
    setInboxLoading(true);
    try { setInbox(await apiNotifs.get(u.id, userType(u)) || []); }
    catch (e) { toast(e.message, 'error'); }
    finally { setInboxLoading(false); }
  };

  const pick = u => { setUser(u); setUserQuery(''); loadInbox(u); };

  const canSend = titre.trim() && message.trim() && (cible !== 'UTILISATEUR' || user) && !sending;

  const send = async () => {
    const cibleLabel = cible === 'UTILISATEUR' ? user.name : CIBLES.find(c => c.id === cible).label.toLowerCase();
    if (cible !== 'UTILISATEUR' &&
        !window.confirm(`Envoyer cette notification à ${cibleLabel} ? Elle arrivera immédiatement sur leurs téléphones.`)) return;
    setSending(true);
    try {
      const res = await apiAdmin.push({ cible, userId: user?.id, titre: titre.trim(), message: message.trim() });
      if (res?.pushActif === false) {
        toast('Enregistrée, mais les push sont désactivés sur le serveur (clé Firebase manquante)', 'warning');
      } else if (cible === 'UTILISATEUR' && res?.telephoneEnregistre === false) {
        toast(`Enregistrée dans l'app de ${user.name} (son téléphone n'est pas encore inscrit aux push)`, 'warning');
      } else {
        toast('Notification envoyée ✓', 'success');
      }
      const entry = { id: Date.now(), cible, cibleLabel, titre: titre.trim(), message: message.trim(), at: new Date().toISOString() };
      const next = [entry, ...history].slice(0, 50);
      setHistory(next);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      Audit.log('PUSH_NOTIFICATION', `« ${entry.titre} » → ${cibleLabel}`);
      setTitre(''); setMessage('');
      if (cible === 'UTILISATEUR') loadInbox(user);
    } catch (e) { toast(e.message, 'error'); }
    finally { setSending(false); }
  };

  const markAllRead = async () => {
    try { await apiNotifs.markAllRead(user.id, userType(user)); toast('Toutes marquées comme lues', 'success'); loadInbox(user); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Centre de notifications</h1>
          <p>Envoyez des notifications push aux téléphones des clients et des chauffeurs</p>
        </div>
      </div>

      <div className="pc-layout">
        {/* ─── Rédaction ─── */}
        <div className="nd-card">
          <div className="nd-card-header"><span className="nd-card-title">Nouvelle notification</span></div>
          <div className="nd-card-body">
            <label className="pc-label">Destinataires</label>
            <div className="pc-cibles">
              {CIBLES.map(c => (
                <button key={c.id} className={`pc-cible ${cible === c.id ? 'active' : ''}`} onClick={() => setCible(c.id)}>
                  <span className="pc-cible-icon">{c.icon}</span>
                  <span><b>{c.label}</b><small>{c.sub}</small></span>
                </button>
              ))}
            </div>

            {cible === 'UTILISATEUR' && (
              <div className="pc-user">
                {user ? (
                  <div className="pc-user-chip">
                    <Avatar name={user.name} size={30} />
                    <div style={{ flex: 1 }}>
                      <b>{user.name}</b> <RoleBadge role={user.role} />
                      <div className="nd-cell-sub">#{user.id} · {user.telephone}</div>
                    </div>
                    <button className="nd-btn nd-btn-ghost nd-btn-sm" onClick={() => { setUser(null); setInbox([]); }}>Changer</button>
                  </div>
                ) : (
                  <>
                    <input className="nd-input" placeholder="Rechercher par nom, téléphone ou n°..." value={userQuery}
                      onChange={e => setUserQuery(e.target.value)} autoFocus />
                    {matches.length > 0 && (
                      <div className="pc-suggest">
                        {matches.map(u => (
                          <button key={u.id} onClick={() => pick(u)}>
                            <Avatar name={u.name} size={26} />
                            <span>{u.name} <small>· {u.telephone}</small></span>
                            <RoleBadge role={u.role} />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <label className="pc-label">Modèles rapides</label>
            <div className="pc-modeles">
              {MODELES.map(m => (
                <button key={m.label} className="sv-chip" onClick={() => { setTitre(m.titre); setMessage(m.message); }}>{m.label}</button>
              ))}
            </div>

            <label className="pc-label">Titre <small>{titre.length}/80</small></label>
            <input className="nd-input" maxLength={80} placeholder="Ex : Offre spéciale" value={titre} onChange={e => setTitre(e.target.value)} />

            <label className="pc-label">Message <small>{message.length}/500</small></label>
            <textarea className="nd-input" rows={4} maxLength={500} placeholder="Votre message..."
              value={message} onChange={e => setMessage(e.target.value)} style={{ resize: 'vertical' }} />

            <button className="nd-btn nd-btn-primary" style={{ width: '100%', marginTop: 14, justifyContent: 'center' }}
              disabled={!canSend} onClick={send}>
              {sending ? <><div className="nd-spinner-sm" /> Envoi...</> : '🚀 Envoyer la notification'}
            </button>
          </div>
        </div>

        {/* ─── Aperçu téléphone + historique ─── */}
        <div>
          <div className="sv-chips" style={{ padding: '0 0 10px', justifyContent: 'center' }}>
            {[['android', 'Android'], ['iphone', 'iPhone']].map(([k, l]) => (
              <button key={k} className={`sv-chip ${apercu === k ? 'active' : ''}`} onClick={() => setApercu(k)}>{l}</button>
            ))}
          </div>
          <div className={`pc-phone pc-phone-${apercu}`}>
            <div className="pc-phone-notch" />
            <div className="pc-phone-time">{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
            <div className={`pc-notif pc-notif-${apercu}`}>
              <div className="pc-notif-app">
                <img className="pc-notif-logo-img" src="/logo.png" alt="" />
                <span>{cible === 'CHAUFFEURS' ? 'Ñu Demm Pro' : 'Ñu Demm'}</span>
                <span className="pc-notif-quand">{apercu === 'iphone' ? 'maintenant' : '· maintenant'}</span>
              </div>
              <div className="pc-notif-title">{titre || 'Titre de la notification'}</div>
              <div className="pc-notif-msg">{message || 'Le message apparaîtra ici, tel que vos utilisateurs le verront.'}</div>
            </div>
          </div>

          <div className="nd-card" style={{ marginTop: 18 }}>
            <div className="nd-card-header"><span className="nd-card-title">Derniers envois</span></div>
            <div className="nd-card-body" style={{ maxHeight: 260, overflowY: 'auto' }}>
              {!history.length ? <div className="nd-empty">Aucun envoi pour l'instant</div> :
                history.map(h => (
                  <LigneNotif key={h.id} type={h.cible} titre={h.titre} message={h.message} quand={h.at} destinataire={h.cibleLabel} />
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Boîte de réception de l'utilisateur ─── */}
      {cible === 'UTILISATEUR' && user && (
        <div className="nd-card" style={{ marginTop: 20 }}>
          <div className="nd-card-header">
            <span className="nd-card-title">Notifications reçues par {user.name}</span>
            {inbox.some(n => !n.lu) && <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={markAllRead}>Tout marquer lu</button>}
          </div>
          <div className="nd-card-body">
            {inboxLoading ? <Spinner center /> : !inbox.length ? <div className="nd-empty">Aucune notification</div> :
              inbox.map(n => (
                <LigneNotif key={n.id} type={n.type} titre={n.titre} message={n.message} quand={n.dateEnvoi} lu={!!n.lu} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
