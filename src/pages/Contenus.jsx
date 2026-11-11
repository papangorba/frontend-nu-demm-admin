import { useEffect, useMemo, useState } from 'react';
import { apiContenus, fmtDT, Audit } from '../services/api';
import { Spinner } from '../components/ui';
import { useToast } from '../context/AppContext';

/** Textes longs, affichés comme des pages dans les apps. */
const PAGES = {
  CONDITIONS: { icone: '📄', aide: "Menu de l'app → Conditions d'utilisation (et lien sur l'écran de connexion)" },
  CONFIDENTIALITE: { icone: '🔒', aide: "Menu de l'app → Confidentialité" },
  TARIFS: { icone: '💰', aide: "Menu de l'app → Infos tarifs" },
  FAQ: { icone: '❓', aide: 'Support → Questions fréquentes' },
  A_PROPOS: { icone: 'ℹ', aide: "Menu de l'app client → À propos" },
};

/** Coordonnées du support (champs courts). */
const SUPPORT = [
  { cle: 'SUPPORT_MESSAGE', label: "Message d'accueil", multi: true },
  { cle: 'SUPPORT_TELEPHONE', label: 'Téléphone (bouton « Appeler »)', placeholder: '+221 77 000 00 00' },
  { cle: 'SUPPORT_WHATSAPP', label: 'WhatsApp (bouton « Écrire sur WhatsApp »)', placeholder: '+221 77 000 00 00' },
  { cle: 'SUPPORT_EMAIL', label: 'E-mail', placeholder: 'support@...' },
  { cle: 'SUPPORT_HORAIRES', label: 'Horaires', placeholder: 'Tous les jours, de 8h à 20h' },
];

/** Même mise en forme que l'app (ligne courte = titre, « • » = puce). */
function Apercu({ texte }) {
  return (
    <div className="ct-apercu">
      {(texte || '').split('\n').map((brut, i) => {
        const l = brut.trim();
        if (!l) return <div key={i} style={{ height: 8 }} />;
        if (l.startsWith('•') || l.startsWith('- ')) return <div key={i} className="ct-puce">{l.replace(/^(•|-)\s*/, '')}</div>;
        if (l.length <= 60 && !/[.,;:!)]$/.test(l)) return <div key={i} className="ct-titre">{l}</div>;
        return <p key={i}>{l}</p>;
      })}
    </div>
  );
}

export default function Contenus() {
  const toast = useToast();
  const [textes, setTextes] = useState({});
  const [loading, setLoading] = useState(true);
  const [actif, setActif] = useState('CONDITIONS');
  const [brouillon, setBrouillon] = useState({});
  const [saving, setSaving] = useState(false);

  const charger = async () => {
    setLoading(true);
    try {
      const list = await apiContenus.textes();
      const map = {};
      (list || []).forEach(c => { map[c.cle] = c; });
      setTextes(map);
      setBrouillon({});
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const valeur = (cle, champ = 'contenu') => brouillon[cle]?.[champ] ?? textes[cle]?.[champ] ?? '';
  const modifier = (cle, champ, v) => setBrouillon(b => ({ ...b, [cle]: { ...b[cle], [champ]: v } }));
  const modifies = useMemo(() => Object.keys(brouillon), [brouillon]);

  const enregistrer = async cles => {
    setSaving(true);
    try {
      for (const cle of cles) {
        await apiContenus.modifierTexte(cle, { titre: valeur(cle, 'titre'), contenu: valeur(cle) });
      }
      Audit.log('MODIF_CONTENU', cles.join(', '));
      toast('Enregistré — visible dans les apps à leur prochaine ouverture', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  if (loading) return <Spinner center />;
  const estSupport = actif === 'SUPPORT';
  const supportModifie = SUPPORT.some(s => modifies.includes(s.cle));

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Textes des apps</h1>
          <p>Conditions, tarifs, support... modifiés ici, mis à jour dans les apps client et chauffeur sans nouvelle version</p>
        </div>
      </div>

      <div className="ct-layout">
        <div className="nd-card ct-menu">
          {Object.entries(PAGES).map(([cle, p]) => (
            <button key={cle} className={actif === cle ? 'active' : ''} onClick={() => setActif(cle)}>
              <span>{p.icone}</span>
              <span className="ct-menu-txt">
                <b>{valeur(cle, 'titre') || cle}</b>
                <small>{textes[cle]?.majLe ? `Modifié le ${fmtDT(textes[cle].majLe)}` : 'Jamais modifié'}</small>
              </span>
              {modifies.includes(cle) && <i className="ct-dot" title="Modifications non enregistrées" />}
            </button>
          ))}
          <button className={estSupport ? 'active' : ''} onClick={() => setActif('SUPPORT')}>
            <span>🎧</span>
            <span className="ct-menu-txt"><b>Support client</b><small>Téléphone, WhatsApp, e-mail, horaires</small></span>
            {supportModifie && <i className="ct-dot" />}
          </button>
        </div>

        {estSupport ? (
          <div className="nd-card">
            <div className="nd-card-header">
              <span className="nd-card-title">Page Support</span>
              <button className="nd-btn nd-btn-primary" disabled={saving || !supportModifie}
                onClick={() => enregistrer(SUPPORT.map(s => s.cle).filter(c => modifies.includes(c)))}>
                {saving ? 'Enregistrement...' : '💾 Enregistrer'}
              </button>
            </div>
            <div className="nd-card-body">
              <small className="nd-cell-sub">Laissez un champ vide pour masquer le bouton correspondant dans l'app.</small>
              {SUPPORT.map(s => (
                <div key={s.cle} className="nd-form-group" style={{ marginTop: 12 }}>
                  <label>{s.label}</label>
                  {s.multi
                    ? <textarea className="nd-input" rows={3} value={valeur(s.cle)} onChange={e => modifier(s.cle, 'contenu', e.target.value)} />
                    : <input className="nd-input" placeholder={s.placeholder} value={valeur(s.cle)} onChange={e => modifier(s.cle, 'contenu', e.target.value)} />}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="nd-card">
            <div className="nd-card-header">
              <span className="nd-card-title">{PAGES[actif].icone} {valeur(actif, 'titre') || actif}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {modifies.includes(actif) && (
                  <button className="nd-btn nd-btn-ghost nd-btn-sm"
                    onClick={() => setBrouillon(b => { const n = { ...b }; delete n[actif]; return n; })}>Annuler</button>
                )}
                <button className="nd-btn nd-btn-primary" disabled={saving || !modifies.includes(actif)} onClick={() => enregistrer([actif])}>
                  {saving ? 'Enregistrement...' : '💾 Enregistrer'}
                </button>
              </div>
            </div>
            <div className="nd-card-body">
              <small className="nd-cell-sub">📍 {PAGES[actif].aide}</small>
              <div className="nd-form-group" style={{ marginTop: 12 }}>
                <label>Titre de la page</label>
                <input className="nd-input" value={valeur(actif, 'titre')} onChange={e => modifier(actif, 'titre', e.target.value)} />
              </div>
              <div className="ct-editeur">
                <div className="nd-form-group">
                  <label>Texte</label>
                  <textarea className="nd-input ct-textarea" value={valeur(actif)} onChange={e => modifier(actif, 'contenu', e.target.value)} />
                  <small className="nd-cell-sub">
                    Mise en forme : une <b>ligne courte</b> (sans point final) devient un titre, une ligne qui commence par <b>•</b> devient une puce,
                    une ligne vide sépare les paragraphes.
                  </small>
                </div>
                <div className="nd-form-group">
                  <label>Aperçu dans l'app</label>
                  <div className="ct-phone"><Apercu texte={valeur(actif)} /></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
