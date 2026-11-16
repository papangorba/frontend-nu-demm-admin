import { useEffect, useRef, useState } from 'react';
import { apiContenus, mediaUrl, compresserImage, fmtDT, Audit } from '../services/api';
import { Modal, Spinner } from '../components/ui';
import { useToast } from '../context/AppContext';

const SERVICES = ['Courses', 'Livraison', 'Taxi-Bokko', 'Cargo'];
const CIBLES = { CLIENT: '👥 App client', CHAUFFEUR: '🏍 App chauffeur', TOUS: '📣 Les deux apps' };
const FREQUENCES = {
  UNE_FOIS: 'Une seule fois par personne',
  CHAQUE_JOUR: 'Une fois par jour',
  CHAQUE_OUVERTURE: "À chaque ouverture de l'app",
};

/** « 2026-11-07T08:00:00 » → valeur d'un champ datetime-local */
const versInput = d => (d ? String(d).slice(0, 16) : '');

/** Statut lisible d'une bannière / annonce selon ses dates. */
function statut(item) {
  const now = new Date();
  if (!item.actif) return { label: '⏸ Désactivée', cls: 'badge-secondary' };
  if (item.dateDebut && new Date(item.dateDebut) > now) return { label: '🕒 Programmée', cls: 'badge-info' };
  if (item.dateFin && new Date(item.dateFin) <= now) return { label: '⌛ Terminée', cls: 'badge-warn' };
  return { label: '● En ligne', cls: 'badge-success' };
}

const periode = item =>
  !item.dateDebut && !item.dateFin ? 'Sans limite de durée'
    : `${item.dateDebut ? 'Du ' + fmtDT(item.dateDebut) : 'Dès maintenant'} ${item.dateFin ? '→ au ' + fmtDT(item.dateFin) : '→ sans fin'}`;

const actionLabel = item =>
  item.actionType === 'SERVICE' ? `Ouvre « ${item.actionValeur} »`
    : item.actionType === 'URL' ? `Ouvre ${item.actionValeur}` : 'Aucune action';

// ═══════════════════════════════════════════════════════════════
export default function Publicites() {
  const [onglet, setOnglet] = useState('bannieres');
  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Pubs & annonces</h1>
          <p>Bannières de l'accueil et annonces (promotions, nouveautés) affichées dans les apps</p>
        </div>
      </div>
      <div className="pb-tabs">
        <button className={onglet === 'bannieres' ? 'active' : ''} onClick={() => setOnglet('bannieres')}>🖼 Bannières de l'accueil</button>
        <button className={onglet === 'annonces' ? 'active' : ''} onClick={() => setOnglet('annonces')}>📣 Annonces (fenêtre d'ouverture)</button>
      </div>
      {onglet === 'bannieres' ? <Bannieres /> : <Annonces />}
    </div>
  );
}

// ─── Champ image (envoi compressé ou lien) ─────────────────────
function ChampImage({ apercu, onFichier, onSupprimer }) {
  const input = useRef(null);
  const [glisse, setGlisse] = useState(false);
  const choisir = f => f && onFichier(f);
  return (
    <div
      className={`pb-drop ${glisse ? 'over' : ''}`}
      onClick={() => input.current?.click()}
      onDragOver={e => { e.preventDefault(); setGlisse(true); }}
      onDragLeave={() => setGlisse(false)}
      onDrop={e => { e.preventDefault(); setGlisse(false); choisir(e.dataTransfer.files?.[0]); }}
    >
      {apercu ? (
        <>
          <img src={apercu} alt="aperçu" />
          <div className="pb-drop-actions">
            <span>Cliquez pour changer</span>
            {onSupprimer && <button className="nd-btn nd-btn-ghost nd-btn-sm" onClick={e => { e.stopPropagation(); onSupprimer(); }}>Retirer</button>}
          </div>
        </>
      ) : (
        <div className="pb-drop-vide">
          <div style={{ fontSize: 30 }}>🖼</div>
          <b>Glissez une image ici ou cliquez</b>
          <small>JPG / PNG — réduite automatiquement. Format conseillé : paysage 16/9</small>
        </div>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={e => choisir(e.target.files?.[0])} />
    </div>
  );
}

// ─── Action au toucher ─────────────────────────────────────────
function ChampAction({ form, set }) {
  return (
    <div className="nd-form-row">
      <div className="nd-form-group" style={{ flex: 1 }}>
        <label>Au toucher</label>
        <select className="nd-input nd-select" value={form.actionType}
          onChange={e => set({ actionType: e.target.value, actionValeur: e.target.value === 'SERVICE' ? SERVICES[0] : '' })}>
          <option value="AUCUNE">Rien</option>
          <option value="SERVICE">Ouvrir un service de l'app</option>
          <option value="URL">Ouvrir un lien web</option>
        </select>
      </div>
      {form.actionType === 'SERVICE' && (
        <div className="nd-form-group" style={{ flex: 1 }}>
          <label>Service</label>
          <select className="nd-input nd-select" value={form.actionValeur || ''} onChange={e => set({ actionValeur: e.target.value })}>
            {SERVICES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      )}
      {form.actionType === 'URL' && (
        <div className="nd-form-group" style={{ flex: 1 }}>
          <label>Lien</label>
          <input className="nd-input" placeholder="https://..." value={form.actionValeur || ''} onChange={e => set({ actionValeur: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function ChampsPeriode({ form, set }) {
  return (
    <div className="nd-form-row">
      <div className="nd-form-group" style={{ flex: 1 }}>
        <label>Début (vide = tout de suite)</label>
        <input type="datetime-local" className="nd-input" value={form.dateDebut} onChange={e => set({ dateDebut: e.target.value })} />
      </div>
      <div className="nd-form-group" style={{ flex: 1 }}>
        <label>Fin (vide = sans fin)</label>
        <input type="datetime-local" className="nd-input" value={form.dateFin} onChange={e => set({ dateFin: e.target.value })} />
      </div>
    </div>
  );
}

/** Logique commune aux deux listes (chargement, enregistrement, suppression). */
function useGestion(charger, creer, modifier, supprimer, libelle) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const recharger = async () => {
    setLoading(true);
    try { setItems(await charger() || []); }
    catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { recharger(); }, []);

  const enregistrer = async (id, data) => {
    const res = id ? await modifier(id, data) : await creer(data);
    Audit.log(id ? `MODIF_${libelle}` : `CREATION_${libelle}`, `« ${data.titre || 'sans titre'} »`);
    toast(id ? 'Modifications enregistrées' : 'Publié ✓', 'success');
    recharger();
    return res;
  };
  const basculer = async item => {
    try { await modifier(item.id, { actif: !item.actif }); recharger(); }
    catch (e) { toast(e.message, 'error'); }
  };
  const effacer = async item => {
    if (!window.confirm(`Supprimer « ${item.titre || 'cet élément'} » ?`)) return;
    try { await supprimer(item.id); Audit.log(`SUPPRESSION_${libelle}`, `« ${item.titre} »`); toast('Supprimé', 'success'); recharger(); }
    catch (e) { toast(e.message, 'error'); }
  };
  return { items, loading, enregistrer, basculer, effacer };
}

// ═══════════════════════════════════════════════════════════════
//  BANNIÈRES
// ═══════════════════════════════════════════════════════════════
const BANNIERE_VIDE = {
  titre: '', sousTitre: '', actionType: 'AUCUNE', actionValeur: '', cible: 'CLIENT',
  dateDebut: '', dateFin: '', ordre: 0, actif: true, imageBase64: null, imageUrl: null,
};

function Bannieres() {
  const g = useGestion(apiContenus.bannieres, apiContenus.creerBanniere, apiContenus.modifierBanniere,
    apiContenus.supprimerBanniere, 'BANNIERE');
  const [edition, setEdition] = useState(null); // null | objet du formulaire

  const enLigne = g.items.filter(b => statut(b).label.includes('En ligne') && b.cible !== 'CHAUFFEUR');

  return (
    <>
      <div className="nd-alert nd-alert-info pb-info">
        💡 Les bannières en ligne <b>s'ajoutent</b> aux deux images de l'app dans le carrousel de l'accueil client
        (onglets Urbaines et Interurbaines) : elles passent en premier, puis viennent toujours les images de l'app.
      </div>

      <div className="pb-toolbar">
        <span className="nd-cell-sub">{enLigne.length} bannière(s) en ligne · {g.items.length} au total</span>
        <button className="nd-btn nd-btn-primary" onClick={() => setEdition({ ...BANNIERE_VIDE })}>+ Nouvelle bannière</button>
      </div>

      {g.loading ? <Spinner center /> : (
        <div className="pb-grid">
          {g.items.map(b => {
            const s = statut(b);
            return (
              <div key={b.id} className="pb-card" style={{ opacity: b.actif ? 1 : .6 }}>
                <div className="pb-card-img">
                  {mediaUrl(b.imageUrl) ? <img src={mediaUrl(b.imageUrl)} alt={b.titre || ''} /> : <div className="pb-noimg">Pas d'image</div>}
                  {(b.titre || b.sousTitre) && (
                    <div className="pb-overlay"><b>{b.titre}</b><span>{b.sousTitre}</span></div>
                  )}
                </div>
                <div className="pb-card-body">
                  <div className="pb-card-top">
                    <b>{b.titre || 'Sans titre'}</b>
                    <span className={`nd-badge ${s.cls}`}>{s.label}</span>
                  </div>
                  <small className="nd-cell-sub">📅 {periode(b)}</small>
                  <small className="nd-cell-sub">{CIBLES[b.cible]} · ordre {b.ordre ?? 0} · {actionLabel(b)}</small>
                  {/* Statistiques envoyées par les apps */}
                  <div className="pb-stats" title="Vues dans le carrousel (1 fois par ouverture de l'app) · ouvertures en plein écran · bouton « Voir » touché">
                    <span><b>{(b.affichages || 0).toLocaleString('fr-FR')}</b> vues</span>
                    <span><b>{(b.ouvertures || 0).toLocaleString('fr-FR')}</b> plein écran</span>
                    <span><b>{(b.clics || 0).toLocaleString('fr-FR')}</b> clics</span>
                    {b.affichages > 0 && <span className="pb-taux">{Math.round(100 * (b.clics || 0) / b.affichages)} % de clics</span>}
                  </div>
                  <div className="pb-card-actions">
                    <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={() => setEdition({
                      ...BANNIERE_VIDE, ...b, dateDebut: versInput(b.dateDebut), dateFin: versInput(b.dateFin), imageBase64: null,
                    })}>✏ Modifier</button>
                    <button className="nd-btn nd-btn-ghost nd-btn-sm" onClick={() => g.basculer(b)}>{b.actif ? '⏸ Désactiver' : '▶ Activer'}</button>
                    <button className="nd-btn-icon danger" onClick={() => g.effacer(b)} title="Supprimer">🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
          {/* Images intégrées à l'app : toujours affichées après les bannières */}
          {['/defaults/pub1.png', '/defaults/pub2.png'].map((src, i) => (
            <div key={src} className="pb-card pb-defaut">
              <div className="pb-card-img"><img src={src} alt={`Publicité ${i + 1}`} /></div>
              <div className="pb-card-body">
                <div className="pb-card-top"><b>Image de l'app {i + 1}</b><span className="nd-badge badge-success">● Toujours affichée</span></div>
                <small className="nd-cell-sub">Intégrée à l'app — vos bannières s'affichent avant elle</small>
              </div>
            </div>
          ))}
        </div>
      )}

      {edition && <FormBanniere initial={edition} onClose={() => setEdition(null)} onSave={g.enregistrer} />}
    </>
  );
}

function FormBanniere({ initial, onClose, onSave }) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = p => setForm(f => ({ ...f, ...p }));
  const apercu = form.imageBase64 || mediaUrl(form.imageUrl);

  const fichier = async f => {
    try { set({ imageBase64: await compresserImage(f) }); }
    catch (e) { toast(e.message, 'error'); }
  };

  const valider = async () => {
    if (!apercu) { toast('Ajoutez une image', 'warning'); return; }
    setSaving(true);
    try {
      const { imageUrl, id, majLe, ...data } = form;
      if (!data.imageBase64) delete data.imageBase64;
      data.ordre = Number(data.ordre) || 0;
      await onSave(initial.id, data);
      onClose();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open title={initial.id ? 'Modifier la bannière' : 'Nouvelle bannière'} onClose={onClose}
      footer={<>
        <button className="nd-btn nd-btn-outline" onClick={onClose}>Annuler</button>
        <button className="nd-btn nd-btn-primary" onClick={valider} disabled={saving}>
          {saving ? <><div className="nd-spinner-sm" /> Enregistrement...</> : initial.id ? 'Enregistrer' : 'Publier'}
        </button>
      </>}>
      <ChampImage apercu={apercu} onFichier={fichier} />
      <div className="nd-form-group">
        <label>Titre affiché sur l'image (facultatif)</label>
        <input className="nd-input" maxLength={60} placeholder="Ex : -20 % ce week-end" value={form.titre || ''} onChange={e => set({ titre: e.target.value })} />
      </div>
      <div className="nd-form-group">
        <label>Sous-titre (facultatif)</label>
        <input className="nd-input" maxLength={100} placeholder="Ex : Sur toutes vos courses jusqu'à dimanche" value={form.sousTitre || ''} onChange={e => set({ sousTitre: e.target.value })} />
      </div>
      <ChampAction form={form} set={set} />
      <ChampsPeriode form={form} set={set} />
      <div className="nd-form-row">
        <div className="nd-form-group" style={{ flex: 1 }}>
          <label>App</label>
          <select className="nd-input nd-select" value={form.cible} onChange={e => set({ cible: e.target.value })}>
            {Object.entries(CIBLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="nd-form-group" style={{ width: 120 }}>
          <label>Ordre</label>
          <input type="number" className="nd-input" value={form.ordre} onChange={e => set({ ordre: e.target.value })} />
        </div>
      </div>
      <label className="pb-check">
        <input type="checkbox" checked={!!form.actif} onChange={e => set({ actif: e.target.checked })} />
        Active (visible pendant la période choisie)
      </label>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ANNONCES
// ═══════════════════════════════════════════════════════════════
const ANNONCE_VIDE = {
  titre: '', message: '', boutonTexte: '', actionType: 'AUCUNE', actionValeur: '', cible: 'CLIENT',
  frequence: 'UNE_FOIS', dateDebut: '', dateFin: '', actif: true, imageBase64: null, imageUrl: null,
  envoyerPush: false, supprimerImage: false,
};

function Annonces() {
  const g = useGestion(apiContenus.annonces, apiContenus.creerAnnonce, apiContenus.modifierAnnonce,
    apiContenus.supprimerAnnonce, 'ANNONCE');
  const [edition, setEdition] = useState(null);

  return (
    <>
      <div className="nd-alert nd-alert-info pb-info">
        💡 Une annonce s'ouvre en fenêtre au lancement de l'app pendant sa période (nouvelle fonctionnalité,
        promotion, information importante). Une seule annonce est montrée par ouverture.
      </div>
      <div className="pb-toolbar">
        <span className="nd-cell-sub">{g.items.length} annonce(s)</span>
        <button className="nd-btn nd-btn-primary" onClick={() => setEdition({ ...ANNONCE_VIDE })}>+ Nouvelle annonce</button>
      </div>

      {g.loading ? <Spinner center /> : !g.items.length ? (
        <div className="nd-card"><div className="nd-empty">
          <div style={{ fontSize: 34, marginBottom: 6 }}>📣</div>
          Aucune annonce. Créez-en une pour présenter une promotion ou une nouveauté.
        </div></div>
      ) : (
        <div className="pb-grid">
          {g.items.map(a => {
            const s = statut(a);
            return (
              <div key={a.id} className="pb-card" style={{ opacity: a.actif ? 1 : .6 }}>
                <div className="pb-card-img">
                  {mediaUrl(a.imageUrl) ? <img src={mediaUrl(a.imageUrl)} alt="" /> : <div className="pb-noimg">📣</div>}
                </div>
                <div className="pb-card-body">
                  <div className="pb-card-top"><b>{a.titre}</b><span className={`nd-badge ${s.cls}`}>{s.label}</span></div>
                  <small className="pb-msg">{a.message}</small>
                  <small className="nd-cell-sub">📅 {periode(a)}</small>
                  <small className="nd-cell-sub">{CIBLES[a.cible]} · {FREQUENCES[a.frequence]}</small>
                  <div className="pb-card-actions">
                    <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={() => setEdition({
                      ...ANNONCE_VIDE, ...a, dateDebut: versInput(a.dateDebut), dateFin: versInput(a.dateFin),
                      imageBase64: null, envoyerPush: false,
                    })}>✏ Modifier</button>
                    <button className="nd-btn nd-btn-ghost nd-btn-sm" onClick={() => g.basculer(a)}>{a.actif ? '⏸ Désactiver' : '▶ Activer'}</button>
                    <button className="nd-btn-icon danger" onClick={() => g.effacer(a)} title="Supprimer">🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {edition && <FormAnnonce initial={edition} onClose={() => setEdition(null)} onSave={g.enregistrer} />}
    </>
  );
}

function FormAnnonce({ initial, onClose, onSave }) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = p => setForm(f => ({ ...f, ...p }));
  const apercu = form.supprimerImage ? null : (form.imageBase64 || mediaUrl(form.imageUrl));

  const fichier = async f => {
    try { set({ imageBase64: await compresserImage(f), supprimerImage: false }); }
    catch (e) { toast(e.message, 'error'); }
  };

  const valider = async () => {
    if (!form.titre.trim()) { toast('Le titre est obligatoire', 'warning'); return; }
    if (form.envoyerPush && !window.confirm('Une notification push sera aussi envoyée maintenant à tous les utilisateurs ciblés. Continuer ?')) return;
    setSaving(true);
    try {
      const { imageUrl, id, majLe, version, ...data } = form;
      if (!data.imageBase64) delete data.imageBase64;
      await onSave(initial.id, data);
      onClose();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open wide title={initial.id ? "Modifier l'annonce" : 'Nouvelle annonce'} onClose={onClose}
      footer={<>
        <button className="nd-btn nd-btn-outline" onClick={onClose}>Annuler</button>
        <button className="nd-btn nd-btn-primary" onClick={valider} disabled={saving}>
          {saving ? <><div className="nd-spinner-sm" /> Enregistrement...</> : initial.id ? 'Enregistrer' : 'Publier'}
        </button>
      </>}>
      <div className="pb-form-2">
        <div>
          <ChampImage apercu={apercu} onFichier={fichier}
            onSupprimer={apercu ? () => set({ imageBase64: null, supprimerImage: true }) : null} />
          <div className="nd-form-group">
            <label>Titre *</label>
            <input className="nd-input" maxLength={70} placeholder="Ex : Nouveau : la livraison en camion 🚚" value={form.titre} onChange={e => set({ titre: e.target.value })} />
          </div>
          <div className="nd-form-group">
            <label>Message</label>
            <textarea className="nd-input" rows={3} maxLength={400} value={form.message || ''} onChange={e => set({ message: e.target.value })}
              placeholder="Décrivez la promotion ou la nouveauté..." />
          </div>
          <div className="nd-form-group">
            <label>Texte du bouton (facultatif)</label>
            <input className="nd-input" maxLength={30} placeholder="Ex : J'en profite" value={form.boutonTexte || ''} onChange={e => set({ boutonTexte: e.target.value })} />
          </div>
          <ChampAction form={form} set={set} />
          <ChampsPeriode form={form} set={set} />
          <div className="nd-form-row">
            <div className="nd-form-group" style={{ flex: 1 }}>
              <label>App</label>
              <select className="nd-input nd-select" value={form.cible} onChange={e => set({ cible: e.target.value })}>
                {Object.entries(CIBLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="nd-form-group" style={{ flex: 1 }}>
              <label>Fréquence</label>
              <select className="nd-input nd-select" value={form.frequence} onChange={e => set({ frequence: e.target.value })}>
                {Object.entries(FREQUENCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <label className="pb-check">
            <input type="checkbox" checked={!!form.actif} onChange={e => set({ actif: e.target.checked })} />
            Active (affichée pendant la période choisie)
          </label>
          <label className="pb-check">
            <input type="checkbox" checked={!!form.envoyerPush} onChange={e => set({ envoyerPush: e.target.checked })} />
            Envoyer aussi une notification push maintenant
          </label>
        </div>

        {/* Aperçu de la fenêtre dans l'app */}
        <div className="pb-preview">
          <small className="nd-cell-sub">Aperçu dans l'app</small>
          <div className="pb-dialog">
            {apercu ? <img src={apercu} alt="" /> : <div className="pb-dialog-noimg">📣</div>}
            <div className="pb-dialog-body">
              <b>{form.titre || "Titre de l'annonce"}</b>
              <p>{form.message || 'Votre message apparaîtra ici.'}</p>
              <span className="pb-dialog-btn">
                {form.boutonTexte || (form.actionType === 'AUCUNE' ? 'Compris' : 'Découvrir')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
