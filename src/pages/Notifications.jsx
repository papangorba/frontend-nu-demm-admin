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
          <div className="pc-phone">
            <div className="pc-phone-notch" />
            <div className="pc-phone-time">{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="pc-notif">
              <div className="pc-notif-app">
                <span className="pc-notif-logo">ÑD</span>
                {cible === 'CHAUFFEURS' ? 'Ñu Demm Pro' : 'Ñu Demm'} · maintenant
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
                  <div key={h.id} className="pc-hist">
                    <div><b>{h.titre}</b> <small className="nd-cell-sub">→ {h.cibleLabel}</small></div>
                    <div className="nd-cell-sub">{h.message}</div>
                    <div className="pc-hist-time">{fmtDT(h.at)}</div>
                  </div>
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
                <div key={n.id} className="pc-hist" style={{ opacity: n.lu ? 0.55 : 1 }}>
                  <div>{n.lu ? '📭' : '🔔'} <b>{n.titre || 'Notification'}</b> <small className="nd-cell-sub">{n.type}</small></div>
                  <div className="nd-cell-sub">{n.message}</div>
                  <div className="pc-hist-time">{fmtDT(n.dateEnvoi)}{n.lu && ' · lue'}</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
