import { useEffect, useState } from 'react';
import { AudioLines, RefreshCw, Server, Smartphone, Car, Volume2, Activity, AlertTriangle, Timer, MessageSquare } from 'lucide-react';
import { apiVoix, Audit } from '../services/api';
import { Spinner, StatCard } from '../components/ui';
import { useToast } from '../context/AppContext';

/**
 * Wolof Ndiaye — assistant vocal wolof / français des apps client et chauffeur.
 * L'admin l'allume ou le coupe dans chaque app (le bouton disparaît des apps, le serveur refuse aussi),
 * coupe la voix des réponses, et voit l'état du serveur vocal et l'utilisation.
 */

/** Prévenir le bandeau du haut qu'un réglage a changé. */
export const signalerVoix = statut => window.dispatchEvent(new CustomEvent('voix-statut', { detail: statut }));

function Interrupteur({ actif, onChange, disabled, titre }) {
  return (
    <button type="button" className={`cp-switch${actif ? ' on' : ''}`} disabled={disabled} title={titre}
      onClick={() => onChange(!actif)} aria-pressed={actif} aria-label={titre}>
      <span />
    </button>
  );
}

const INTENTIONS = {
  OUVRIR_SERVICE: 'Ouvrir un service', RECHERCHER_TRAJET: 'Chercher un trajet', ESTIMER_TARIF: 'Demander un prix',
  RESERVER: 'Commander', SUIVRE_COURSE: 'Suivre la course', ANNULER: 'Annuler', CONFIRMER: 'Confirmer (« waaw »)',
  REFUSER: 'Refuser', SALUTATION: 'Salutation', AIDE: 'Aide', GAINS: 'Gains du jour (chauffeur)',
  EN_LIGNE: 'Se mettre en ligne', HORS_LIGNE: 'Se mettre hors ligne', INCONNU: 'Pas compris',
};

const secondes = ms => (ms ? `${(ms / 1000).toFixed(1)} s` : '—');

export default function WolofNdiaye() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);

  const charger = async () => {
    try {
      const d = await apiVoix.etat();
      setData(d);
      signalerVoix(d.reglages);
    } catch (e) { toast(e.message, 'error'); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const basculer = async (cle, actif, libelle) => {
    if (!actif && !window.confirm(`Couper « ${libelle} » ?`)) return;
    setBusy(cle);
    try {
      const reglages = await apiVoix.modifier({ [cle]: actif });
      setData(d => ({ ...d, reglages }));
      signalerVoix(reglages);
      Audit.log('WOLOF_NDIAYE', `${libelle} ${actif ? 'activé' : 'coupé'}`);
      toast(`${libelle} ${actif ? 'activé' : 'coupé'}`, 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  if (!data) return <Spinner center />;
  const r = data.reglages || {};
  const s = data.service || {};
  const st = data.stats || {};
  const intentions = Object.entries(st.intentions || {}).sort((a, b) => b[1] - a[1]);
  const maxIntention = intentions.length ? intentions[0][1] : 1;

  const lignes = [
    { cle: 'VOIX_CLIENT_ACTIF', icone: <Smartphone size={18} />, libelle: 'Wolof Ndiaye dans l\'app client',
      aide: 'Prix, recherche de trajets, commande confirmée par « waaw », suivi et annulation.' },
    { cle: 'VOIX_CHAUFFEUR_ACTIF', icone: <Car size={18} />, libelle: 'Wolof Ndiaye dans l\'app chauffeur',
      aide: 'Gains du jour, en ligne / hors ligne, où en est la course.' },
    { cle: 'VOIX_REPONSE_VOCALE', icone: <Volume2 size={18} />, libelle: 'Réponses dites à voix haute (wolof)',
      aide: r.voixAutorisee ? 'Voix Kiriku : la réponse est lue en plus d\'être affichée.'
        : 'Voix désactivée sur le serveur (VOICE_TTS_ACTIVE) : seules les réponses écrites s\'affichent.' },
  ];

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Wolof Ndiaye</h1>
          <p>Assistant vocal en wolof et en français. Coupé ici, son bouton disparaît de l'app au prochain
            chargement et le serveur refuse les messages vocaux. Ni la voix ni le texte des utilisateurs ne sont gardés.</p>
        </div>
        <button className="nd-btn nd-btn-ghost" onClick={charger}><RefreshCw size={15} /> Actualiser</button>
      </div>

      <div className="nd-card" style={{ marginBottom: 16 }}>
        <div className="nd-card-body" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <AudioLines size={22} color={r.actif ? 'var(--nd-green)' : 'var(--nd-text-muted)'} />
          <b style={{ fontSize: 16 }}>{r.actif ? 'Actif' : 'Inactif'}</b>
          <span className="nd-cell-sub">
            {!r.configure ? 'Serveur vocal non configuré (VOICE_SERVICE_URL / VOICE_SERVICE_KEY sur Render).'
              : r.actif ? `Disponible pour ${[r.VOIX_CLIENT_ACTIF && 'les clients', r.VOIX_CHAUFFEUR_ACTIF && 'les chauffeurs'].filter(Boolean).join(' et ')}.`
                : 'Coupé dans les deux apps.'}
          </span>
        </div>
      </div>

      <div className="nd-card" style={{ marginBottom: 16 }}>
        <div className="nd-card-body" style={{ display: 'grid', gap: 14 }}>
          {lignes.map(l => (
            <div key={l.cle} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {l.icone}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{l.libelle}</div>
                <div className="nd-cell-sub">{l.aide}</div>
              </div>
              <Interrupteur actif={!!r[l.cle]} disabled={busy === l.cle} titre={l.libelle}
                onChange={v => basculer(l.cle, v, l.libelle)} />
            </div>
          ))}
        </div>
      </div>

      <div className="nd-card" style={{ marginBottom: 16 }}>
        <div className="nd-card-body" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Server size={18} color={s.joignable ? 'var(--nd-green)' : 'var(--nd-red, #dc2626)'} />
          <b>Serveur vocal : {s.joignable ? 'en marche' : s.configure ? 'injoignable' : 'non configuré'}</b>
          {s.joignable && <span className="nd-cell-sub">
            réponse en {s.latenceMs} ms · reconnaissance {s.asr?.charge ? 'chargée' : 'en chargement'}
            {s.tts && ` · voix ${s.tts.active === false ? 'désactivée' : s.tts.charge ? 'chargée' : 'en chargement'}`}
          </span>}
          {s.erreur && <span className="nd-cell-sub">({s.erreur})</span>}
        </div>
      </div>

      <div className="nd-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard color="blue" icon={<MessageSquare />} value={st.messages ?? 0} label="Messages (14 jours)" />
        <StatCard color="green" icon={<Smartphone />} value={st.client ?? 0} label="Depuis l'app client" />
        <StatCard color="orange" icon={<Car />} value={st.chauffeur ?? 0} label="Depuis l'app chauffeur" />
        <StatCard color="red" icon={<AlertTriangle />} value={st.erreurs ?? 0} label="Erreurs" />
        <StatCard color="purple" icon={<Timer />} value={secondes(st.tempsMoyenMs)} label="Temps de réponse moyen" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div className="nd-card">
          <div className="nd-card-header"><Activity size={16} /> Demandes les plus fréquentes</div>
          <div className="nd-card-body" style={{ display: 'grid', gap: 8 }}>
            {intentions.length === 0 && <span className="nd-cell-sub">Aucune demande pour l'instant.</span>}
            {intentions.map(([k, n]) => (
              <div key={k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{INTENTIONS[k] || k}</span><b>{n}</b>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--nd-surface2)' }}>
                  <div style={{ width: `${(n / maxIntention) * 100}%`, height: '100%', borderRadius: 3, background: 'var(--nd-primary)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="nd-card"><div className="nd-table-wrap">
          <table className="nd-table">
            <thead><tr><th>Jour</th><th>Client</th><th>Chauffeur</th><th>Erreurs</th><th>Temps moyen</th></tr></thead>
            <tbody>
              {(st.parJour || []).length === 0 && <tr><td colSpan={5} className="nd-cell-sub">Aucune utilisation depuis le dernier redémarrage du serveur.</td></tr>}
              {(st.parJour || []).map(j => (
                <tr key={j.date}>
                  <td>{new Date(j.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</td>
                  <td>{j.client}</td><td>{j.chauffeur}</td><td>{j.erreurs}</td><td>{secondes(j.tempsMoyenMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      </div>
    </div>
  );
}
