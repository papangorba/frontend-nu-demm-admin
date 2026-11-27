import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiControle, apiContenus, Audit, Auth, getBaseUrl, setBaseUrl } from '../services/api';
import { Spinner } from '../components/ui';
import { useToast } from '../context/AppContext';

/**
 * Paramètres : tout vient du serveur et s'enregistre sur le serveur (avant : valeurs écrites en dur, boutons sans effet).
 *  - coordonnées du service client (mêmes textes que « Contenus ») ;
 *  - réglages du serveur, groupés et expliqués (le serveur contrôle chaque valeur) ;
 *  - réglages gérés ailleurs (finances, prix) : affichés avec un lien vers leur page.
 */

const SUPPORT = [
  ['SUPPORT_TELEPHONE', 'Téléphone du service client', 'Bouton « Appeler le service client » des deux apps', '+221 77 000 00 00'],
  ['SUPPORT_WHATSAPP', 'WhatsApp du service client', 'Bouton « Écrire sur WhatsApp »', '+221 77 000 00 00'],
  ['SUPPORT_EMAIL', 'E-mail du support', 'Pages Support et Confidentialité', 'support@...'],
  ['SUPPORT_HORAIRES', 'Horaires du support', 'Affichés dans la page Support', 'Tous les jours, de 8h à 20h'],
];

/** [clé, libellé, explication, type?, options?] — type : bool | nombre | texte | choix */
const GROUPES = [
  ['🛠 Maintenance et mises à jour', [
    ['MAINTENANCE_CLIENT', "Maintenance de l'app client", 'Les clients voient le message de maintenance', 'bool'],
    ['MAINTENANCE_CHAUFFEUR', "Maintenance de l'app chauffeur", 'Les chauffeurs voient le message de maintenance', 'bool'],
    ['MAINTENANCE_MESSAGE', 'Message de maintenance', '', 'texte'],
    ['VERSION_MIN_CLIENT', 'Version minimale (client)', 'Plus ancienne = mise à jour obligatoire (ex. 1.2.0)'],
    ['VERSION_MIN_CHAUFFEUR', 'Version minimale (chauffeur)', ''],
    ['MAJ_AUTO_CLIENT', 'Mise à jour obligatoire automatique (client)', 'Après le délai ci-dessous, la version du store devient obligatoire', 'bool'],
    ['MAJ_AUTO_CHAUFFEUR', 'Mise à jour obligatoire automatique (chauffeur)', '', 'bool'],
    ['MAJ_AUTO_DELAI_HEURES', 'Délai avant mise à jour obligatoire (heures)', '', 'nombre'],
    ['LIEN_PLAY_CLIENT', 'Lien Play Store (client)', '', 'texte'],
    ['LIEN_APPLE_CLIENT', 'Lien App Store (client)', '', 'texte'],
    ['LIEN_PLAY_CHAUFFEUR', 'Lien Play Store (chauffeur)', '', 'texte'],
    ['LIEN_APPLE_CHAUFFEUR', 'Lien App Store (chauffeur)', '', 'texte'],
  ]],
  ['🔐 Connexion et sécurité', [
    ['OTP_OBLIGATOIRE', 'Code SMS obligatoire à la connexion', 'À activer quand tout le monde a la nouvelle version des apps', 'bool'],
    ['OTP_DEMO_TELEPHONES', 'Numéros de démonstration (stores)', 'Séparés par des virgules ; ils se connectent avec le code ci-dessous', 'texte'],
    ['OTP_DEMO_CODE', 'Code de démonstration', 'Pour les vérificateurs Apple / Google', 'texte'],
    ['SESSION_CLIENT_JOURS', 'Durée de session client (jours)', 'Sans ouvrir l\'app pendant cette durée, il faut se reconnecter', 'nombre'],
    ['SESSION_CHAUFFEUR_JOURS', 'Durée de session chauffeur (jours)', '', 'nombre'],
    ['SESSION_ADMIN_HEURES', "Durée de session de l'admin (heures)", '', 'nombre'],
    ['ALERTE_INACTIVITE_JOURS', "Alerte d'inactivité (jours)", 'Comptes signalés « inactifs » dans les listes', 'nombre'],
    ['DOCUMENTS_OBLIGATOIRES', 'Documents obligatoires pour les chauffeurs', 'Permis, carte grise… validés avant de recevoir des demandes', 'bool'],
    ['MODE_TEST_ACTIF', 'Mode test', 'Les numéros ci-dessous testent les nouveautés avant tout le monde', 'bool'],
    ['MODE_TEST_TELEPHONES', 'Numéros des testeurs', 'Séparés par des virgules', 'texte'],
  ]],
  ['🚗 Courses et livraisons', [
    ['DELAI_REPONSE_CHAUFFEUR', 'Temps pour accepter une demande (secondes)', '', 'nombre'],
    ['OFFRES_CHAUFFEUR', 'Les chauffeurs peuvent proposer un autre prix', '', 'bool'],
    ['OFFRE_DUREE_SECONDES', "Durée d'une proposition de prix (secondes)", '', 'nombre'],
    ['HAUSSE_MAX', 'Hausses de prix possibles par le client', 'Nombre de fois où le client peut augmenter son prix', 'nombre'],
    ['HAUSSE_PLAFOND_POURCENT', 'Plafond de hausse du client (%)', '', 'nombre'],
    ['REMISE_SECURISEE', 'Code de remise du colis obligatoire', 'Le destinataire donne un code au livreur', 'bool'],
    ['COLIS_SMS_DESTINATAIRE', 'SMS au destinataire du colis', 'Code de retrait envoyé par SMS (Allô Sénégal)', 'bool'],
    ['FRAIS_ARRET', "Frais par arrêt d'une tournée (F)", '', 'nombre'],
    ['PRIX_AIDE_CHARGEMENT', 'Aide au chargement (F)', 'Option Cargo', 'nombre'],
    ['ASSURANCE_POURCENT', 'Assurance du colis (% de la valeur)', '', 'nombre'],
    ['ASSURANCE_MIN', 'Assurance minimum (F)', '', 'nombre'],
    ['ASSURANCE_VALEUR_MAX', 'Valeur maximum assurée (F)', '', 'nombre'],
  ]],
  ['💳 Paiement en ligne', [
    ['PAIEMENT_EN_LIGNE', 'Paiement en ligne ouvert', 'Wave / Orange Money dans les apps (il faut aussi les clés PayTech)', 'bool'],
    ['PAIEMENT_WAVE', 'Wave', '', 'bool'],
    ['PAIEMENT_ORANGE_MONEY', 'Orange Money', '', 'bool'],
    ['PAIEMENT_DELAI_MINUTES', 'Temps pour payer (minutes)', 'Après ce délai, le paiement est abandonné', 'nombre'],
    ['RESERVATION_SANS_PAIEMENT', 'Réservation quand le paiement en ligne est fermé', '', 'choix', [['SANS_ACOMPTE', 'Acceptée, tout se paie au chauffeur'], ['REFUS', 'Refusée']]],
  ]],
  ['↩ Annulations et pénalités', [
    ['ANNUL_GRACE_MIN', 'Annulation gratuite (minutes après acceptation)', '', 'nombre'],
    ['ANNUL_FRAIS_COURSE', "Frais d'annulation d'une course (F)", '', 'nombre'],
    ['ANNUL_FRAIS_LIVRAISON', "Frais d'annulation d'une livraison (F)", '', 'nombre'],
    ['ANNUL_RETARD_MIN', 'Retard du chauffeur autorisé (minutes)', 'Au-delà, le client annule sans frais', 'nombre'],
    ['ANNUL_ATTENTE_MIN', 'Attente du client au départ (minutes)', '', 'nombre'],
    ['PENALITE_ABANDONS_MAX', 'Abandons avant une pause (chauffeur)', '', 'nombre'],
    ['PENALITE_BLOCAGE_MIN', 'Durée de la pause (minutes)', '', 'nombre'],
    ['ANNUL_RESA_HEURES_GRATUIT', 'Réservation : annulation gratuite jusqu\'à (heures avant)', '', 'nombre'],
    ['ANNUL_RESA_HEURES_TARDIF', 'Réservation : annulation tardive (heures avant)', '', 'nombre'],
    ['ANNUL_RESA_POURCENT_TARDIF', "Réservation : part de l'avance gardée si tardive (%)", '', 'nombre'],
    ['PENALITE_ANNULATION_TRAJET', "Pénalité si le chauffeur annule un trajet (F)", '', 'nombre'],
  ]],
  ['🎨 Apparence des apps', [
    ['CIEL_MODE', 'Effets du ciel', 'Sur les barres du haut des deux apps', 'choix', [['AUTO', 'Automatique : éclairs + soleil le jour, lune et étoiles la nuit'], ['ECLAIRS', 'Éclairs seulement'], ['ASTRES', 'Soleil / lune et étoiles seulement'], ['PLUIE', 'Pluie'], ['ORAGE', 'Orage : pluie + éclairs'], ['AUCUN', 'Aucun effet']]],
    ['THEME_FETE', 'Thème de fête', 'Pensez à remettre « Aucun » après la fête', 'choix', [['AUCUN', 'Aucun'], ['TABASKI', '🐑 Tabaski'], ['KORITE', '🌙 Korité'], ['MAGAL', '✨ Magal'], ['NOEL', '❄️ Noël'], ['NOUVEL_AN', '🎆 Nouvel An'], ['CAN', '⚽ CAN / Lions'], ['INDEPENDANCE', '🇸🇳 4 avril']]],
    ['ECLAIRS_BARRES_SECONDES', 'Éclairs des barres (secondes)', '', 'nombre'],
    ['ECLAIRS_NOTIFS_SECONDES', 'Éclairs des notifications (secondes)', '', 'nombre'],
  ]],
  ['🎙 Assistant vocal Wolof Ndiaye', [
    ['VOIX_CLIENT_ACTIF', 'Assistant dans l\'app client', '', 'bool'],
    ['VOIX_CHAUFFEUR_ACTIF', 'Assistant dans l\'app chauffeur', '', 'bool'],
    ['VOIX_REPONSE_VOCALE', 'Réponses lues à voix haute', 'Voix wolof du serveur (il faut aussi VOICE_TTS_ACTIVE sur Render)', 'bool'],
    ['VOIX_SECOURS_GEMINI', 'Secours Gemini', 'Si le service vocal ne comprend pas', 'bool'],
  ]],
];

/** Réglés sur leur propre page (format particulier, motif obligatoire…) */
const AILLEURS = [
  [k => k.startsWith('ECO_'), 'Modèle économique (commission, solde, défis…)', '/finances', 'Finances → Réglages (avec motif)'],
  [k => k === 'TARIF_REGIONS' || k.startsWith('MAJORATION_'), 'Prix par région et majorations', '/tarifs', 'Tarifs'],
];
const CACHES = k => k.startsWith('VERSION_STORE_') || k === 'VERSIONS_VERIFIEES_LE' || k === 'LIEN_STORE_CLIENT' || k === 'LIEN_STORE_CHAUFFEUR';

function Editeur({ type, options, valeur, onChange, desactive }) {
  if (type === 'bool') {
    const on = valeur === 'true';
    return (
      <button type="button" disabled={desactive} onClick={() => onChange(on ? 'false' : 'true')}
        className={`nd-btn nd-btn-sm ${on ? 'nd-btn-primary' : 'nd-btn-outline'}`} style={{ minWidth: 92 }}>
        {on ? '✓ Activé' : '✕ Désactivé'}
      </button>
    );
  }
  if (type === 'choix') {
    return (
      <select className="nd-input nd-select" disabled={desactive} value={valeur} onChange={e => onChange(e.target.value)} style={{ maxWidth: 280 }}>
        {(options || []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        {!(options || []).some(([v]) => v === valeur) && <option value={valeur}>{valeur}</option>}
      </select>
    );
  }
  return (
    <input className="nd-input" disabled={desactive} value={valeur} inputMode={type === 'nombre' ? 'numeric' : undefined}
      onChange={e => onChange(e.target.value)} style={{ maxWidth: type === 'nombre' ? 130 : 380 }} />
  );
}

export default function Parametres() {
  const toast = useToast();
  const [config, setConfig] = useState(null);
  const [textes, setTextes] = useState({});
  const [brouillon, setBrouillon] = useState({});
  const [brouillonTextes, setBrouillonTextes] = useState({});
  const [recherche, setRecherche] = useState('');
  const [saving, setSaving] = useState(false);
  const [baseUrl, setBaseUrlState] = useState(getBaseUrl());
  const modifiable = ['SUPER_ADMIN', 'ADMIN'].includes(Auth.role());

  const charger = async () => {
    try {
      const [c, t] = await Promise.all([apiControle.config(), apiContenus.textes().catch(() => [])]);
      setConfig(c || {});
      const m = {};
      (t || []).forEach(x => { m[x.cle] = x; });
      setTextes(m);
      setBrouillon({}); setBrouillonTextes({});
    } catch (e) { toast(e.message, 'error'); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const connues = useMemo(() => new Set(GROUPES.flatMap(([, l]) => l.map(x => x[0]))), []);
  const autres = useMemo(() => Object.keys(config || {}).filter(k => !connues.has(k) && !CACHES(k) && !AILLEURS.some(([f]) => f(k))), [config, connues]);

  if (!config) return <Spinner center />;

  const val = k => brouillon[k] ?? config[k] ?? '';
  const valTexte = k => brouillonTextes[k] ?? textes[k]?.contenu ?? '';
  const nbModifs = Object.keys(brouillon).filter(k => brouillon[k] !== (config[k] ?? '')).length
    + Object.keys(brouillonTextes).filter(k => brouillonTextes[k] !== (textes[k]?.contenu ?? '')).length;
  const q = recherche.trim().toLowerCase();
  const visible = (k, l, d) => !q || [k, l, d].some(x => String(x || '').toLowerCase().includes(q));

  const enregistrer = async () => {
    const cles = Object.keys(brouillon).filter(k => brouillon[k] !== (config[k] ?? ''));
    const textesModifies = Object.keys(brouillonTextes).filter(k => brouillonTextes[k] !== (textes[k]?.contenu ?? ''));
    if (!window.confirm(`Enregistrer ${cles.length + textesModifies.length} modification(s) ? Elles s'appliquent tout de suite.`)) return;
    setSaving(true);
    try {
      if (cles.length) {
        const valeurs = Object.fromEntries(cles.map(k => [k, brouillon[k]]));
        await apiControle.modifierConfig(valeurs);
        Audit.log('MODIF_PARAMETRES', cles.map(k => `${k}=${brouillon[k]}`).join(', '));
      }
      for (const k of textesModifies) {
        await apiContenus.modifierTexte(k, { titre: textes[k]?.titre || '', contenu: brouillonTextes[k] });
      }
      if (textesModifies.length) Audit.log('MODIF_CONTENU', textesModifies.join(', '));
      toast('Paramètres enregistrés', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const ligne = ([k, libelle, aide, type, options]) => {
    if (!visible(k, libelle, aide) || !(k in config)) return null;
    const change = brouillon[k] !== undefined && brouillon[k] !== (config[k] ?? '');
    const t = type || (/^(true|false)$/.test(config[k]) ? 'bool' : /^-?\d+$/.test(config[k]) ? 'nombre' : 'texte');
    return (
      <div key={k} className="pm-ligne" style={change ? { background: 'rgba(245,158,11,.08)' } : undefined}>
        <div className="pm-libelle">
          <b>{libelle}</b>
          {aide && <div className="nd-cell-sub">{aide}</div>}
          <code className="pm-cle">{k}</code>
        </div>
        <Editeur type={t} options={options} valeur={val(k)} desactive={!modifiable} onChange={v => setBrouillon(b => ({ ...b, [k]: v }))} />
      </div>
    );
  };

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Paramètres</h1>
          <p>Réglages réels du serveur : ils s'appliquent tout de suite aux apps{modifiable ? '' : ' — lecture seule pour votre rôle'}</p>
        </div>
        <div className="nd-page-header-actions">
          <div className="nd-search-box"><span>🔍</span><input placeholder="Chercher un réglage..." value={recherche} onChange={e => setRecherche(e.target.value)} /></div>
          <button className="nd-btn nd-btn-outline" onClick={charger}>↺</button>
          {nbModifs > 0 && <button className="nd-btn nd-btn-ghost" onClick={() => { setBrouillon({}); setBrouillonTextes({}); }}>Annuler</button>}
          <button className="nd-btn nd-btn-primary" disabled={!modifiable || !nbModifs || saving} onClick={enregistrer}>
            {saving ? 'Enregistrement...' : `💾 Enregistrer${nbModifs ? ` (${nbModifs})` : ''}`}
          </button>
        </div>
      </div>

      <div className="nd-card" style={{ marginBottom: 16 }}>
        <div className="nd-card-header"><span className="nd-card-title">☎ Service client</span></div>
        <div className="nd-card-body" style={{ padding: 0 }}>
          {SUPPORT.filter(([k, l, d]) => visible(k, l, d)).map(([k, libelle, aide, ph]) => (
            <div key={k} className="pm-ligne" style={brouillonTextes[k] !== undefined && brouillonTextes[k] !== (textes[k]?.contenu ?? '') ? { background: 'rgba(245,158,11,.08)' } : undefined}>
              <div className="pm-libelle"><b>{libelle}</b><div className="nd-cell-sub">{aide}</div><code className="pm-cle">{k}</code></div>
              <input className="nd-input" disabled={!modifiable} placeholder={ph} value={valTexte(k)} style={{ maxWidth: 380 }}
                onChange={e => setBrouillonTextes(b => ({ ...b, [k]: e.target.value }))} />
            </div>
          ))}
          {!valTexte('SUPPORT_TELEPHONE') && <div className="nd-alert nd-alert-warn" style={{ margin: 12 }}>⚠ Sans numéro, le bouton « Appeler le service client » des apps ne peut pas appeler.</div>}
        </div>
      </div>

      {GROUPES.map(([titre, liste]) => {
        const lignes = liste.map(ligne).filter(Boolean);
        if (!lignes.length) return null;
        return (
          <div key={titre} className="nd-card" style={{ marginBottom: 16 }}>
            <div className="nd-card-header"><span className="nd-card-title">{titre}</span></div>
            <div className="nd-card-body" style={{ padding: 0 }}>{lignes}</div>
          </div>
        );
      })}

      {autres.some(k => visible(k)) && (
        <div className="nd-card" style={{ marginBottom: 16 }}>
          <div className="nd-card-header"><span className="nd-card-title">⚙ Autres réglages</span></div>
          <div className="nd-card-body" style={{ padding: 0 }}>{autres.map(k => ligne([k, k, '']))}</div>
        </div>
      )}

      <div className="nd-card" style={{ marginBottom: 16 }}>
        <div className="nd-card-header"><span className="nd-card-title">↗ Réglés sur leur page</span></div>
        <div className="nd-card-body">
          {AILLEURS.map(([f, titre, lien, page]) => (
            <div key={lien} className="nd-detail-row">
              <span className="nd-detail-label">{titre} <small className="nd-cell-sub">({Object.keys(config).filter(f).length} réglages)</small></span>
              <Link to={lien} className="nd-btn nd-btn-outline nd-btn-sm">Ouvrir {page}</Link>
            </div>
          ))}
          <div className="nd-detail-row">
            <span className="nd-detail-label">Sessions ouvertes, durée par rôle</span>
            <Link to="/sessions" className="nd-btn nd-btn-outline nd-btn-sm">Ouvrir Sessions & connexion</Link>
          </div>
        </div>
      </div>

      <div className="nd-card" style={{ marginBottom: 16 }}>
        <div className="nd-card-header"><span className="nd-card-title">🖥 Cet ordinateur</span></div>
        <div className="nd-card-body">
          <div className="nd-settings-label">Adresse du serveur utilisée par cet admin</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input className="nd-input" value={baseUrl} onChange={e => setBaseUrlState(e.target.value)} style={{ maxWidth: 420 }} />
            <button className="nd-btn nd-btn-outline" onClick={() => { setBaseUrl(baseUrl.trim()); Audit.log('UPDATE_SETTINGS', 'URL du serveur modifiée'); toast('Adresse enregistrée sur cet ordinateur', 'success'); }}>Enregistrer</button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <button className="nd-btn nd-btn-outline" onClick={() => { if (window.confirm("Effacer le journal d'audit de cet ordinateur ?")) { Audit.clear(); toast('Journal effacé', 'success'); } }}>🗑 Effacer l'audit local</button>
            <button className="nd-btn nd-btn-outline" style={{ color: 'var(--nd-primary)', borderColor: 'var(--nd-primary)' }}
              onClick={() => { ['nd2_token', 'nd2_user', 'nd2_base_url', 'nd2_audit'].forEach(k => localStorage.removeItem(k)); window.location.reload(); }}>⚠ Vider le cache (déconnexion)</button>
          </div>
        </div>
      </div>
    </div>
  );
}
