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
  { id: 'CLIENT', icone: '📱', nom: 'App client', version: '1.0.3' },
  { id: 'CHAUFFEUR', icone: '🚖', nom: 'App chauffeur', version: '1.0.2' },
];

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: String(v) }));
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
                  <small className="nd-cell-sub">Les versions plus anciennes doivent se mettre à jour (dernière version : {a.version})</small>
                </div>
                <div className="nd-form-group" style={{ marginTop: 14 }}>
                  <label>Lien Play Store / App Store</label>
                  <input className="nd-input" placeholder="https://play.google.com/store/apps/details?id=..."
                    value={form[`LIEN_STORE_${a.id}`] || ''} onChange={e => set(`LIEN_STORE_${a.id}`, e.target.value)} />
                  <small className="nd-cell-sub">Ouvert par le bouton « Mettre à jour »</small>
                </div>
              </div>
            </div>
          );
        })}
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
