import { useEffect, useState } from 'react';
import { apiControle, Audit } from '../services/api';
import { Spinner } from '../components/ui';
import { useToast } from '../context/AppContext';

function Interrupteur({ actif, onChange, danger = false }) {
  return (
    <button type="button" className={`cp-switch${actif ? ' on' : ''}${danger ? ' danger' : ''}`}
      onClick={() => onChange(!actif)} aria-pressed={actif}>
      <span />
    </button>
  );
}

/** [clé, libellé, min, max, unité] — durée comptée depuis la dernière utilisation (apps) */
const SESSIONS = [
  ['SESSION_CLIENT_JOURS', 'des clients', 1, 365, 'jours'],
  ['SESSION_CHAUFFEUR_JOURS', 'des chauffeurs', 1, 365, 'jours'],
  ['SESSION_ADMIN_HEURES', 'de l\'administration', 1, 72, 'heures'],
];
/** Seuil de l'alerte « compte inactif » (fiches clients / chauffeurs, tableau de bord) */
const ALERTE = ['ALERTE_INACTIVITE_JOURS', 1, 365];
/** Prix négociés : [clé, libellé, min, max, unité, aide] */
const PRIX = [
  ['HAUSSE_MAX', 'Hausses du client par trajet', 0, 10, 'fois', '0 = le client ne peut pas augmenter son prix'],
  ['HAUSSE_PLAFOND_POURCENT', 'Prix maximum', 110, 500, '% du prix de départ', '200 % = au plus le double'],
  ['OFFRE_DUREE_SECONDES', "Validité d'une offre de chauffeur", 30, 600, 'secondes', 'Temps laissé au client pour répondre'],
];

const APPS = [
  { id: 'CLIENT', icone: '📱', nom: 'App client' },
  { id: 'CHAUFFEUR', icone: '🚖', nom: 'App chauffeur' },
];

/** « 2026-11-18T14:05:00 » → « 18/11 à 14:05 » */
const quand = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? iso : `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};

/** mode « apps » (Contrôle des apps) ou « sessions » (Sessions & connexion, menu Utilisateurs) */
export default function ControleApp({ mode = 'apps' }) {
  const sessions = mode === 'sessions';
  const toast = useToast();
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const charger = async () => {
    try { const c = await apiControle.config(); setConfig(c); setForm(c); }
    catch (e) { toast(e.message, 'error'); }
  };
  const set = (k, v) => setForm(f => ({ ...f, [k]: String(v) }));
  const [verification, setVerification] = useState(false);
  /** Relit les stores sans toucher aux modifications pas encore enregistrées ([discret] : sans message) */
  const verifierStores = async (discret = false) => {
    setVerification(true);
    try {
      const c = await apiControle.verifierStores();
      const lues = Object.fromEntries(Object.entries(c).filter(([k]) => k.startsWith('VERSION_STORE_') || k === 'VERSIONS_VERIFIEES_LE'));
      setConfig(x => (x ? { ...x, ...lues } : x));
      setForm(f => ({ ...f, ...lues }));
      if (!discret) toast('Versions des stores vérifiées', 'success');
    } catch (e) { if (!discret) toast(e.message, 'error'); }
    finally { setVerification(false); }
  };
  // À l'ouverture : la configuration, puis les versions des stores relues tout de suite
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger().then(() => { if (!sessions) verifierStores(true); }); }, []);
  const on = k => form[k] === 'true';
  const modifie = config && Object.keys(form).some(k => form[k] !== config[k]);

  const enregistrer = async () => {
    for (const a of APPS) {
      if (!/^\d+(\.\d+){0,2}$/.test(form[`VERSION_MIN_${a.id}`] || '')) {
        toast(`Version minimale ${a.nom} invalide (ex : 1.0.0)`, 'warning'); return;
      }
    }
    {
      const [cle, min, max] = ALERTE;
      const n = Number(form[cle] || 30);
      if (!Number.isInteger(n) || n < min || n > max) {
        toast(`Alerte d'inactivité : entre ${min} et ${max} jours`, 'warning'); return;
      }
    }
    for (const [cle, nom, min, max] of PRIX) {
      const n = Number(form[cle]);
      if (!Number.isInteger(n) || n < min || n > max) {
        toast(`${nom} : entre ${min} et ${max}`, 'warning'); return;
      }
    }
    for (const [cle, nom, min, max] of SESSIONS) {
      const n = Number(form[cle]);
      if (!Number.isInteger(n) || n < min || n > max) {
        toast(`Durée de session ${nom} : entre ${min} et ${max}`, 'warning'); return;
      }
    }
    const coupe = APPS.filter(a => on(`MAINTENANCE_${a.id}`) && config[`MAINTENANCE_${a.id}`] !== 'true');
    if (coupe.length && !window.confirm(`Activer la maintenance pour : ${coupe.map(a => a.nom).join(', ')} ?\nLes utilisateurs ne pourront plus utiliser l'app.`)) return;
    setSaving(true);
    try {
      const c = await apiControle.modifierConfig(form);
      setConfig(c); setForm(c);
      Audit.log('CONTROLE_APP', Object.keys(form).filter(k => form[k] !== config[k]).join(', '));
      toast('Enregistré — appliqué dans les apps en moins de 5 minutes (immédiatement à la réouverture)', 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  if (!config) return <Spinner center />;

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>{sessions ? 'Sessions & connexion' : 'Contrôle des apps'}</h1>
          <p>{sessions
            ? "Combien de temps clients, chauffeurs et administrateurs restent connectés, et quand un compte est signalé inactif"
            : 'Maintenance, mise à jour obligatoire, prix négociés et règles pour les chauffeurs'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {modifie && <button className="nd-btn nd-btn-ghost" onClick={() => setForm(config)}>Annuler</button>}
          <button className="nd-btn nd-btn-primary" disabled={saving || !modifie} onClick={enregistrer}>
            {saving ? 'Enregistrement...' : '💾 Enregistrer'}
          </button>
        </div>
      </div>

      {!sessions && <>
      <div className="nd-grid-2">
        {APPS.map(a => {
          const maint = on(`MAINTENANCE_${a.id}`);
          return (
            <div key={a.id} className="nd-card" style={maint ? { borderColor: 'var(--nd-red)' } : undefined}>
              <div className="nd-card-header">
                <span className="nd-card-title">{a.icone} {a.nom}</span>
                {maint ? <span className="nd-badge badge-danger">● En maintenance</span> : <span className="nd-badge badge-success">● En service</span>}
              </div>
              <div className="nd-card-body">
                <div className="cp-ligne">
                  <div>
                    <b>Mode maintenance</b>
                    <small className="nd-cell-sub">L'app affiche le message de maintenance au lieu de l'accueil</small>
                  </div>
                  <Interrupteur danger actif={maint} onChange={v => set(`MAINTENANCE_${a.id}`, v)} />
                </div>
                <div className="nd-form-group" style={{ marginTop: 14 }}>
                  <label>Version minimale acceptée</label>
                  <input className="nd-input" placeholder="1.0.0" value={form[`VERSION_MIN_${a.id}`] || ''}
                    onChange={e => set(`VERSION_MIN_${a.id}`, e.target.value.trim())} />
                  <small className="nd-cell-sub">Les versions plus anciennes doivent se mettre à jour</small>
                </div>
                <div className="nd-form-group" style={{ marginTop: 14 }}>
                  <label>Version publiée sur les stores (détectée toute seule)</label>
                  <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                    {[['IOS', '🍎 App Store'], ['ANDROID', '🤖 Play Store']]
                      .filter(([p]) => form[`VERSION_STORE_${a.id}_${p}`]) // seulement les stores où l'app est publiée
                      .map(([p, nom]) => (
                        <div key={p}>
                          {nom} : <b>{form[`VERSION_STORE_${a.id}_${p}`]}</b>
                          <span className="nd-cell-sub"> · parue le {quand(form[`VERSION_STORE_${a.id}_${p}_DEPUIS`])}</span>
                        </div>
                      ))}
                    {verification && <span className="nd-cell-sub">Vérification des stores…</span>}
                  </div>
                </div>
                <div className="cp-ligne" style={{ marginTop: 14 }}>
                  <div>
                    <b>Mise à jour obligatoire automatique</b>
                    <small className="nd-cell-sub">
                      Activé : chaque nouvelle version publiée sur un store devient la version minimale de ce store
                      (après le délai réglé plus bas) ; avant le délai, l'app propose « Nouvelle version disponible ».
                      Désactivé : l'app propose seulement la mise à jour (Mettre à jour / Plus tard).
                    </small>
                  </div>
                  <Interrupteur actif={on(`MAJ_AUTO_${a.id}`)} onChange={v => set(`MAJ_AUTO_${a.id}`, v)} />
                </div>
                <div className="nd-form-group" style={{ marginTop: 14 }}>
                  <label>Lien Play Store</label>
                  <input className="nd-input" placeholder="https://play.google.com/store/apps/details?id=..."
                    value={form[`LIEN_PLAY_${a.id}`] || ''} onChange={e => set(`LIEN_PLAY_${a.id}`, e.target.value.trim())} />
                </div>
                <div className="nd-form-group" style={{ marginTop: 10 }}>
                  <label>Lien App Store</label>
                  <input className="nd-input" placeholder="https://apps.apple.com/sn/app/id..."
                    value={form[`LIEN_APPLE_${a.id}`] || ''} onChange={e => set(`LIEN_APPLE_${a.id}`, e.target.value.trim())} />
                  <small className="nd-cell-sub">Le bouton « Mettre à jour » ouvre le store du téléphone (Android ou iPhone)</small>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="nd-card" style={{ marginTop: 16 }}>
        <div className="nd-card-header">
          <span className="nd-card-title">🔄 Mises à jour des apps</span>
          <button className="nd-btn nd-btn-outline nd-btn-sm" disabled={verification} onClick={() => verifierStores()}>
            {verification ? 'Vérification…' : 'Vérifier les stores maintenant'}
          </button>
        </div>
        <div className="nd-card-body">
          <small className="nd-cell-sub" style={{ display: 'block', marginBottom: 12 }}>
            Le serveur lit toutes les 30 minutes la version visible par le public sur l'App Store et le Play Store
            (les versions de test ne comptent pas). Dernière vérification : {quand(form.VERSIONS_VERIFIEES_LE) || 'jamais'}.
          </small>
          <div className="nd-form-group">
            <label>Délai avant de rendre la mise à jour obligatoire</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input className="nd-input" type="number" min={0} max={168} style={{ maxWidth: 110 }} placeholder="24"
                value={form.MAJ_AUTO_DELAI_HEURES ?? ''} onChange={e => set('MAJ_AUTO_DELAI_HEURES', e.target.value.trim())} />
              <span className="nd-cell-sub">heures après la parution sur le store</span>
            </div>
            <small className="nd-cell-sub">
              Laisse le temps au store de proposer la mise à jour à tout le monde (déploiement progressif sur Google Play).
              Pendant ce délai, l'app affiche « Nouvelle version disponible ».
            </small>
          </div>
        </div>
      </div>

      <div className="nd-card" style={{ marginTop: 16 }}>
        <div className="nd-card-header"><span className="nd-card-title">Message de maintenance</span></div>
        <div className="nd-card-body">
          <textarea className="nd-input" rows={3} value={form.MAINTENANCE_MESSAGE || ''} onChange={e => set('MAINTENANCE_MESSAGE', e.target.value)} />
        </div>
      </div>
      </>}

      {sessions && <>

      <div className="nd-card" style={{ marginTop: 16 }}>
        <div className="nd-card-header"><span className="nd-card-title">Durée des sessions</span></div>
        <div className="nd-card-body">
          <small className="nd-cell-sub" style={{ display: 'block', marginBottom: 12 }}>
            Apps : l'utilisateur reste connecté tant qu'il se sert de l'app ; il est déconnecté après ce nombre de jours
            sans l'ouvrir. Administration : durée fixe après la connexion. Une durée raccourcie s'applique tout de suite,
            même aux sessions déjà ouvertes.
          </small>
          <div className="nd-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {SESSIONS.map(([cle, nom, min, max, unite]) => (
              <div key={cle} className="nd-form-group">
                <label>Session {nom}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input className="nd-input" type="number" min={min} max={max} style={{ maxWidth: 110 }}
                    value={form[cle] || ''} onChange={e => set(cle, e.target.value.trim())} />
                  <span className="nd-cell-sub">{unite}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="nd-card" style={{ marginTop: 16 }}>
        <div className="nd-card-header"><span className="nd-card-title">Alerte d'inactivité</span></div>
        <div className="nd-card-body">
          <small className="nd-cell-sub" style={{ display: 'block', marginBottom: 12 }}>
            Un client ou un chauffeur qui n'a pas ouvert l'app depuis ce nombre de jours est signalé « inactif »
            (badge rouge dans les listes, filtre « Inactifs », tableau de bord).
          </small>
          <div className="nd-form-group">
            <label>Signaler après</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input className="nd-input" type="number" min={ALERTE[1]} max={ALERTE[2]} style={{ maxWidth: 110 }}
                value={form[ALERTE[0]] || ''} placeholder="30" onChange={e => set(ALERTE[0], e.target.value.trim())} />
              <span className="nd-cell-sub">jours sans activité</span>
            </div>
          </div>
        </div>
      </div>

      </>}

      {!sessions && <>
      <div className="nd-card" style={{ marginTop: 16 }}>
        <div className="nd-card-header"><span className="nd-card-title">✨ Effets visuels des apps</span></div>
        <div className="nd-card-body">
          <small className="nd-cell-sub" style={{ display: 'block', marginBottom: 12 }}>
            Ciel animé sur les barres du haut, les menus et le centre de notifications des deux apps.
            Les apps relisent ces réglages toutes les 30 secondes : pas besoin de les fermer.
          </small>
          <div className="nd-form-group" style={{ marginBottom: 14 }}>
            <label>Effets du ciel</label>
            <select className="nd-input" style={{ maxWidth: 420 }} value={form.CIEL_MODE || 'AUTO'}
              onChange={e => set('CIEL_MODE', e.target.value)}>
              <option value="AUTO">Automatique : éclairs + soleil le jour, lune et étoiles la nuit</option>
              <option value="ECLAIRS">Éclairs seulement</option>
              <option value="ASTRES">Soleil / lune et étoiles seulement (sans éclairs)</option>
              <option value="PLUIE">Pluie (gouttes qui tombent, sans éclairs)</option>
              <option value="ORAGE">Orage : pluie + éclairs</option>
              <option value="AUCUN">Aucun effet</option>
            </select>
          </div>
          <div className="nd-form-group" style={{ marginBottom: 14 }}>
            <label>Thème de fête</label>
            <select className="nd-input" style={{ maxWidth: 420 }} value={form.THEME_FETE || 'AUCUN'}
              onChange={e => set('THEME_FETE', e.target.value)}>
              <option value="AUCUN">Aucun (ciel normal)</option>
              <option value="TABASKI">🐑 Tabaski : croissant et étoiles dorés</option>
              <option value="KORITE">🌙 Korité : croissant et étoiles dorés</option>
              <option value="MAGAL">✨ Magal : rayons de lumière dorée</option>
              <option value="NOEL">❄️ Noël : flocons de neige</option>
              <option value="NOUVEL_AN">🎆 Nouvel An : feux d'artifice</option>
              <option value="CAN">⚽ CAN / Lions : confettis vert-jaune-rouge</option>
              <option value="INDEPENDANCE">🇸🇳 4 avril : ruban et étoile verte</option>
            </select>
            <small className="nd-cell-sub">Remplace le soleil / la lune sur les barres des deux apps, en direct. Pensez à remettre « Aucun » après la fête.</small>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {[['ECLAIRS_BARRES_SECONDES', 'Éclairs des barres du haut et menus', '5'],
              ['ECLAIRS_NOTIFS_SECONDES', 'Éclairs du centre de notifications', '2']].map(([cle, nom, defaut]) => (
              <div key={cle} className="nd-form-group">
                <label>{nom}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="nd-cell-sub">un toutes les</span>
                  <input className="nd-input" type="number" min={1} max={60} style={{ maxWidth: 90 }} placeholder={defaut}
                    value={form[cle] ?? ''} onChange={e => set(cle, e.target.value.trim())} />
                  <span className="nd-cell-sub">secondes</span>
                </div>
                <small className="nd-cell-sub">De 1 à 60 · plus petit = plus fréquent (moyenne, avec un peu de hasard)</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="nd-card" style={{ marginTop: 16 }}>
        <div className="nd-card-header"><span className="nd-card-title">⏱️ Demandes chez le chauffeur</span></div>
        <div className="nd-card-body">
          <small className="nd-cell-sub" style={{ display: 'block', marginBottom: 12 }}>
            Dans l'app chauffeur, la demande la plus proche s'affiche devant avec un compte à rebours. Sans réponse
            à la fin, elle est écartée pour ce chauffeur et la suivante passe devant (les autres chauffeurs la voient toujours).
          </small>
          <div className="nd-form-group">
            <label>Temps pour répondre à une demande</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input className="nd-input" type="number" min={0} max={300} style={{ maxWidth: 110 }} placeholder="30"
                value={form.DELAI_REPONSE_CHAUFFEUR ?? ''} onChange={e => set('DELAI_REPONSE_CHAUFFEUR', e.target.value.trim())} />
              <span className="nd-cell-sub">secondes</span>
            </div>
            <small className="nd-cell-sub">De 0 à 300 · 0 = pas de compte à rebours (la demande reste jusqu'à ce que le chauffeur l'accepte ou l'ignore)</small>
          </div>
        </div>
      </div>

      <div className="nd-card" style={{ marginTop: 16 }}>
        <div className="nd-card-header"><span className="nd-card-title">Prix négociés</span></div>
        <div className="nd-card-body">
          <small className="nd-cell-sub" style={{ display: 'block', marginBottom: 12 }}>
            Quand aucun chauffeur n'accepte, le client peut augmenter son prix ; les chauffeurs peuvent aussi
            proposer leur prix (le client accepte ou refuse). Statistiques sur le tableau de bord.
          </small>
          <div className="cp-ligne" style={{ marginBottom: 14 }}>
            <div>
              <b>Propositions de prix des chauffeurs</b>
              <small className="nd-cell-sub">
                Activé : bouton « Proposer un prix » sur chaque demande dans l'app chauffeur.
              </small>
            </div>
            <Interrupteur actif={on('OFFRES_CHAUFFEUR')} onChange={v => set('OFFRES_CHAUFFEUR', v)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {PRIX.map(([cle, nom, min, max, unite, aide]) => (
              <div key={cle} className="nd-form-group">
                <label>{nom}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input className="nd-input" type="number" min={min} max={max} style={{ maxWidth: 110 }}
                    value={form[cle] ?? ''} onChange={e => set(cle, e.target.value.trim())} />
                  <span className="nd-cell-sub">{unite}</span>
                </div>
                <small className="nd-cell-sub">{aide}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="nd-card" style={{ marginTop: 16 }}>
        <div className="nd-card-header"><span className="nd-card-title">📦 Livraison et Cargo</span></div>
        <div className="nd-card-body">
          <div className="cp-ligne" style={{ marginBottom: 14 }}>
            <div>
              <b>Remise sécurisée</b>
              <small className="nd-cell-sub">
                Activé : pour terminer, le livreur saisit le code à 4 chiffres reçu par le destinataire, et confirme
                l'encaissement (espèces, Wave, Orange Money) quand c'est le destinataire qui paie. Les arrêts d'une tournée
                doivent tous être livrés. À activer quand tous les livreurs ont la nouvelle version de l'app chauffeur.
              </small>
            </div>
            <Interrupteur actif={on('REMISE_SECURISEE')} onChange={v => set('REMISE_SECURISEE', v)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {[['PRIX_AIDE_CHARGEMENT', "Prix d'un manutentionnaire (cargo)", 0, 50000, 'F', 'Ajouté au prix pour chaque manutentionnaire demandé (3 au plus)'],
              ['FRAIS_ARRET', 'Supplément par arrêt en plus', 0, 20000, 'F', 'Tournée : par adresse en plus de la destination (3 au plus)'],
              ['ASSURANCE_POURCENT', 'Assurance du colis', 0, 20, '% de la valeur', 'Supplément payé par le client qui assure son colis'],
              ['ASSURANCE_MIN', 'Assurance minimum', 0, 20000, 'F', 'Montant minimum de l\'assurance'],
              ['ASSURANCE_VALEUR_MAX', 'Valeur maximale assurable', 1000, 10000000, 'F', 'Au-delà, la valeur est plafonnée']]
              .map(([cle, nom, min, max, unite, aide]) => (
              <div key={cle} className="nd-form-group">
                <label>{nom}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input className="nd-input" type="number" min={min} max={max} style={{ maxWidth: 110 }}
                    value={form[cle] ?? ''} onChange={e => set(cle, e.target.value.trim())} />
                  <span className="nd-cell-sub">{unite}</span>
                </div>
                <small className="nd-cell-sub">{aide}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="nd-card" style={{ marginTop: 16 }}>
        <div className="nd-card-header"><span className="nd-card-title">🔐 Code SMS à l'inscription et à la connexion</span></div>
        <div className="nd-card-body">
          <small className="nd-cell-sub" style={{ display: 'block', marginBottom: 12 }}>
            Les nouvelles versions des apps envoient un code à 6 chiffres par SMS (Orange, expéditeur « NuDemm ») :
            valable 5 minutes, 5 essais au plus, un nouvel envoi toutes les 60 secondes au plus.
          </small>
          <div className="cp-ligne" style={{ marginBottom: 14 }}>
            <div>
              <b>Code SMS activé</b>
              <small className="nd-cell-sub">
                Activé : un code est envoyé par SMS et il est obligatoire pour se connecter ou s'inscrire
                (les anciennes versions des apps, sans écran de code, sont invitées à se mettre à jour).
                Désactivé : aucun SMS n'est envoyé, tout le monde se connecte et s'inscrit sans code.
                À activer quand tout le monde a mis l'app à jour (montez aussi la « version minimale » ci-dessus).
              </small>
            </div>
            <Interrupteur actif={on('OTP_OBLIGATOIRE')} onChange={v => set('OTP_OBLIGATOIRE', v)} />
          </div>
          {on('OTP_OBLIGATOIRE') && config.OTP_OBLIGATOIRE !== 'true' && (
            <div className="nd-alert nd-alert-warn" style={{ marginBottom: 12 }}>
              ⚠ Les utilisateurs qui ont encore une ancienne version ne pourront plus se connecter tant qu'ils n'auront pas mis l'app à jour.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <div className="nd-form-group">
              <label>Numéros de démonstration</label>
              <input className="nd-input" placeholder="772995725" value={form.OTP_DEMO_TELEPHONES ?? ''}
                onChange={e => set('OTP_DEMO_TELEPHONES', e.target.value)} />
              <small className="nd-cell-sub">Pour la relecture App Store / Play Store : aucun SMS, code fixe. Séparés par des virgules.</small>
            </div>
            <div className="nd-form-group">
              <label>Code de démonstration</label>
              <input className="nd-input" inputMode="numeric" maxLength={8} style={{ maxWidth: 160 }} value={form.OTP_DEMO_CODE ?? ''}
                onChange={e => set('OTP_DEMO_CODE', e.target.value.replace(/\D/g, ''))} />
              <small className="nd-cell-sub">4 à 8 chiffres, à donner aux relecteurs d'Apple et de Google. Vide = démo désactivée.</small>
            </div>
          </div>
        </div>
      </div>

      <div className="nd-card" style={{ marginTop: 16 }}>
        <div className="nd-card-header"><span className="nd-card-title">Documents des chauffeurs</span></div>

        <div className="nd-card-body">
          <div className="cp-ligne">
            <div>
              <b>Documents obligatoires pour travailler</b>
              <small className="nd-cell-sub">
                Activé : un chauffeur ne reçoit plus de demandes tant que ses documents ne sont pas validés
                (rubrique « Documents chauffeurs ») : permis, carte grise et assurance pour une voiture ou un véhicule cargo ;
                une seule pièce au choix (carte d'identité, permis ou passeport) pour une moto 2 roues ou un moto-taxi Jakarta.
                Désactivé : les documents sont demandés mais pas bloquants.
              </small>
            </div>
            <Interrupteur actif={on('DOCUMENTS_OBLIGATOIRES')} onChange={v => set('DOCUMENTS_OBLIGATOIRES', v)} />
          </div>
          {on('DOCUMENTS_OBLIGATOIRES') && config.DOCUMENTS_OBLIGATOIRES !== 'true' && (
            <div className="nd-alert nd-alert-warn" style={{ marginTop: 12 }}>
              ⚠ Vérifiez d'abord que vos chauffeurs actifs ont des documents validés, sinon ils ne recevront plus de demandes.
            </div>
          )}
        </div>
      </div>
      </>}
    </div>
  );
}
