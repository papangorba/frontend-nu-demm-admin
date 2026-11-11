import { useEffect, useState } from 'react';
import { Bus, Plus, KeyRound, Copy, CheckCircle2, AlertTriangle, PauseCircle, PlayCircle, Wallet, Pencil, RefreshCw } from 'lucide-react';
import { apiEntreprises, Audit, fmtDate, fmtDT, money } from '../services/api';
import { Spinner, Modal, MiniCard } from '../components/ui';
import { Tuile, GraphiqueRecettes, EtatVehicule } from './entreprise/Commun';
import { useToast } from '../context/AppContext';

/**
 * Entreprises de transport abonnées (SaaS, partie 3b).
 * L'admin crée l'entreprise et les identifiants de son gérant, encaisse les
 * abonnements mensuels et gère les formules. Le gérant se connecte ensuite
 * sur ce même site et ne voit que son entreprise.
 */

const FILTRES = { TOUTES: 'Toutes', ACTIVE: 'Actives', RENOUVELER: 'À renouveler', SUSPENDUE: 'Suspendues' };
const MOYENS = { WAVE: 'Wave', ORANGE_MONEY: 'Orange Money', ESPECES: 'Espèces', VIREMENT: 'Virement', AUTRE: 'Autre' };
const VIDE = {
  nom: '', ninea: '', rccm: '', ville: '', adresse: '', telephone: '', email: '',
  formule: 'STARTER', joursEssai: '14', nomGestionnaire: '', emailConnexion: '', motDePasse: '',
};

/** Badge d'état de l'abonnement (suggestion 7 : fin proche mise en évidence). */
function EtatAbonnement({ e }) {
  if (e.statut === 'SUSPENDUE') return <span className="nd-badge badge-danger">Suspendue</span>;
  if (!e.abonnementValide) return <span className="nd-badge badge-danger">Abonnement expiré</span>;
  if (e.aRenouveler) return <span className="nd-badge badge-warn">Expire dans {e.joursRestants} j</span>;
  return <span className="nd-badge badge-success">Active · {e.joursRestants} j</span>;
}

function Champ({ label, children, aide }) {
  return (
    <div className="nd-form-group">
      <label>{label}</label>
      {children}
      {aide && <small className="nd-cell-sub">{aide}</small>}
    </div>
  );
}

/** Identifiants à transmettre au gérant (le mot de passe n'est plus jamais affiché ensuite). */
function Identifiants({ data, onClose }) {
  const toast = useToast();
  if (!data) return null;
  const lien = window.location.origin + '/login';
  const message =
    `Bonjour ${data.gestionnaire || ''},\n\n` +
    `Votre espace « ${data.nom} » sur Ñu Demm est prêt.\n` +
    `Adresse : ${lien}\nE-mail : ${data.identifiant}\nMot de passe : ${data.motDePasse}\n\n` +
    `Vous pourrez y gérer vos véhicules, vos chauffeurs et vos trajets.`;
  const copier = async () => {
    try { await navigator.clipboard.writeText(message); toast('Message copié : collez-le dans WhatsApp ou un e-mail', 'success'); }
    catch { toast('Copie impossible : sélectionnez le texte à la main', 'error'); }
  };
  return (
    <Modal open title="Identifiants du gérant" onClose={onClose}
      footer={<>
        <button className="nd-btn nd-btn-ghost" onClick={onClose}>Fermer</button>
        <button className="nd-btn nd-btn-primary" onClick={copier}><Copy size={15} /> Copier le message</button>
      </>}>
      <div className="ent-alerte"><AlertTriangle size={16} /> Notez ou envoyez ces identifiants maintenant : le mot de passe ne sera plus affiché.</div>
      <div className="ent-identifiants">
        <div><span>E-mail</span><b>{data.identifiant}</b></div>
        <div><span>Mot de passe</span><b className="ent-mdp">{data.motDePasse}</b></div>
      </div>
      <textarea className="nd-input" rows={7} readOnly value={message} style={{ marginTop: 12 }} />
    </Modal>
  );
}

export default function Entreprises() {
  const toast = useToast();
  const [onglet, setOnglet] = useState('ENTREPRISES');
  const [filtre, setFiltre] = useState('TOUTES');
  const [liste, setListe] = useState(null);
  const [ind, setInd] = useState(null);
  const [formules, setFormules] = useState([]);
  const [creation, setCreation] = useState(null);     // formulaire « Nouvelle entreprise »
  const [identifiants, setIdentifiants] = useState(null);
  const [detail, setDetail] = useState(null);         // entreprise ouverte
  const [edition, setEdition] = useState(null);       // formulaire de modification
  const [paiements, setPaiements] = useState([]);
  const [activite, setActivite] = useState(null);   // modules en commun : tableau de bord, véhicules, chauffeurs
  const [paiement, setPaiement] = useState(null);     // formulaire de paiement
  const [formuleEdit, setFormuleEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const charger = async () => {
    try {
      const [l, i, f] = await Promise.all([apiEntreprises.liste(), apiEntreprises.indicateurs(), apiEntreprises.formules()]);
      setListe(l || []); setInd(i); setFormules(f || []);
    } catch (e) { toast(e.message, 'error'); setListe(x => x || []); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const visibles = (liste || []).filter(e =>
    filtre === 'TOUTES' ? true
      : filtre === 'RENOUVELER' ? e.statut === 'ACTIVE' && (e.aRenouveler || !e.abonnementValide)
        : e.statut === filtre);

  const nomFormule = code => formules.find(f => f.code === code)?.nom || code;

  // ─── Actions ───────────────────────────────────────────────
  const creer = async () => {
    setBusy(true);
    try {
      const r = await apiEntreprises.creer(creation);
      Audit.log('ENTREPRISE_CREEE', `${r.nom} — gérant ${r.identifiant}`);
      setCreation(null);
      setIdentifiants(r);
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const ouvrir = async e => {
    setDetail(e); setPaiements([]); setActivite(null);
    try { setPaiements(await apiEntreprises.paiements(e.id) || []); } catch { /* historique indisponible */ }
    try {
      const [tdb, vehicules, chauffeurs] = await Promise.all([
        apiEntreprises.tableauDeBord(e.id), apiEntreprises.vehicules(e.id), apiEntreprises.chauffeurs(e.id)]);
      setActivite({ tdb, vehicules: vehicules || [], chauffeurs: chauffeurs || [] });
    } catch { setActivite({ erreur: true }); }
  };

  const rafraichirDetail = async id => {
    const l = await apiEntreprises.liste();
    setListe(l || []);
    setDetail((l || []).find(x => x.id === id) || null);
    setInd(await apiEntreprises.indicateurs());
    try { setPaiements(await apiEntreprises.paiements(id) || []); } catch { /* ignore */ }
  };

  const enregistrerEdition = async () => {
    setBusy(true);
    try {
      await apiEntreprises.modifier(detail.id, edition);
      Audit.log('ENTREPRISE_MODIFIEE', detail.nom);
      toast('Entreprise mise à jour', 'success');
      setEdition(null);
      await rafraichirDetail(detail.id);
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const payer = async () => {
    setBusy(true);
    try {
      const d = { mois: paiement.mois, moyen: paiement.moyen, reference: paiement.reference };
      if (paiement.montant !== '') d.montant = paiement.montant;
      const r = await apiEntreprises.payer(detail.id, d);
      Audit.log('ABONNEMENT_PAYE', `${detail.nom} — ${paiement.mois} mois, ${r.paiement.montant} F`);
      toast(`Paiement enregistré : abonnement jusqu'au ${fmtDate(r.flotte.abonnementJusquau)}`, 'success');
      setPaiement(null);
      await rafraichirDetail(detail.id);
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const nouveauMdp = async () => {
    if (!window.confirm(`Générer un nouveau mot de passe pour le gérant de « ${detail.nom} » ? L'ancien ne marchera plus.`)) return;
    try {
      const r = await apiEntreprises.motDePasse(detail.id);
      Audit.log('ENTREPRISE_MDP', detail.nom);
      setIdentifiants(r);
    } catch (e) { toast(e.message, 'error'); }
  };

  const basculer = async () => {
    const suspendre = detail.statut === 'ACTIVE';
    if (suspendre && !window.confirm(`Suspendre « ${detail.nom} » ? Son gérant ne pourra plus se connecter.`)) return;
    try {
      await (suspendre ? apiEntreprises.suspendre(detail.id) : apiEntreprises.reactiver(detail.id));
      Audit.log(suspendre ? 'ENTREPRISE_SUSPENDUE' : 'ENTREPRISE_REACTIVEE', detail.nom);
      toast(suspendre ? 'Entreprise suspendue' : 'Entreprise réactivée', 'success');
      await rafraichirDetail(detail.id);
    } catch (e) { toast(e.message, 'error'); }
  };

  const enregistrerFormule = async () => {
    setBusy(true);
    try {
      await apiEntreprises.modifierFormule(formuleEdit.code, {
        nom: formuleEdit.nom, prixMensuel: formuleEdit.prixMensuel,
        maxVehicules: formuleEdit.maxVehicules ?? '', description: formuleEdit.description, actif: formuleEdit.actif,
      });
      Audit.log('FORMULE_MODIFIEE', `${formuleEdit.code} — ${formuleEdit.prixMensuel} F`);
      toast('Formule mise à jour', 'success');
      setFormuleEdit(null);
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const champ = (obj, set, cle) => ({ value: obj[cle] ?? '', onChange: ev => set({ ...obj, [cle]: ev.target.value }) });
  const prixFormule = paiement && detail ? (formules.find(f => f.code === detail.formule)?.prixMensuel || 0) : 0;

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Entreprises de transport</h1>
          <p>Sociétés de bus et de voitures abonnées à Ñu Demm. Vous créez leur compte ; elles gèrent ensuite leur flotte et leurs trajets depuis ce site.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="nd-btn nd-btn-ghost" onClick={charger}><RefreshCw size={15} /> Actualiser</button>
          <button className="nd-btn nd-btn-primary" onClick={() => setCreation({ ...VIDE })}><Plus size={15} /> Nouvelle entreprise</button>
        </div>
      </div>

      <div className="ent-kpis">
        <MiniCard color="var(--nd-green)" value={ind?.actives} label="Actives" />
        <MiniCard color="var(--nd-amber)" value={ind?.aRenouveler} label="À renouveler (≤ 7 j)" />
        <MiniCard color="var(--nd-red)" value={ind?.suspendues} label="Suspendues" />
        <MiniCard color="var(--nd-primary)" value={ind ? money(ind.encaisseMois) : null} label="Encaissé ce mois" />
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '4px 0 16px', flexWrap: 'wrap' }}>
        {[['ENTREPRISES', 'Entreprises'], ['FORMULES', "Formules d'abonnement"]].map(([k, l]) => (
          <button key={k} className={`nd-btn nd-btn-sm ${onglet === k ? 'nd-btn-primary' : 'nd-btn-outline'}`} onClick={() => setOnglet(k)}>{l}</button>
        ))}
      </div>

      {onglet === 'FORMULES' ? (
        <div className="ent-formules">
          {formules.map(f => (
            <div key={f.code} className="nd-card"><div className="nd-card-body">
              <div className="ent-entete">
                <b style={{ fontSize: 16 }}>{f.nom}</b>
                {f.actif === false ? <span className="nd-badge badge-secondary">Masquée</span> : <span className="nd-badge badge-success">Proposée</span>}
              </div>
              <div className="ent-prix">{money(f.prixMensuel)}<small> / mois</small></div>
              <div className="nd-cell-sub">{f.maxVehicules ? `Jusqu'à ${f.maxVehicules} véhicules` : 'Véhicules illimités'}</div>
              <p style={{ fontSize: 13, marginTop: 8 }}>{f.description}</p>
              <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={() => setFormuleEdit({ ...f })}><Pencil size={14} /> Modifier</button>
            </div></div>
          ))}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {Object.entries(FILTRES).map(([k, l]) => (
              <button key={k} className={`nd-btn nd-btn-sm ${filtre === k ? 'nd-btn-primary' : 'nd-btn-ghost'}`} onClick={() => setFiltre(k)}>{l}</button>
            ))}
          </div>
          {liste === null ? <Spinner center /> : visibles.length === 0 ? (
            <div className="nd-card"><div className="nd-card-body" style={{ textAlign: 'center', padding: 40 }}>
              <Bus size={40} color="var(--nd-text-dim)" />
              <p className="nd-cell-sub">{liste.length === 0 ? 'Aucune entreprise pour le moment. Créez la première avec « Nouvelle entreprise ».' : 'Aucune entreprise dans cette catégorie'}</p>
            </div></div>
          ) : (
            <div className="nd-card"><div className="nd-card-body-p0"><div className="nd-table-wrap">
              <table className="nd-table">
                <thead><tr><th>Entreprise</th><th>Ville</th><th>Gérant</th><th>Formule</th><th>Véhicules</th><th>Abonnement</th><th></th></tr></thead>
                <tbody>
                  {visibles.map(e => (
                    <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => ouvrir(e)}>
                      <td><b>{e.nom}</b><small className="nd-cell-sub" style={{ display: 'block' }}>{e.telephone}</small></td>
                      <td>{e.ville}</td>
                      <td>{e.gestionnaire || '—'}</td>
                      <td>{e.formuleNom || e.formule}</td>
                      <td>{e.nombreVehicules}{e.maxVehicules ? ` / ${e.maxVehicules}` : ''}<small className="nd-cell-sub" style={{ display: 'block' }}>{e.nombreChauffeurs} chauffeur(s)</small></td>
                      <td><EtatAbonnement e={e} /><small className="nd-cell-sub" style={{ display: 'block' }}>jusqu'au {fmtDate(e.abonnementJusquau)}</small></td>
                      <td><button className="nd-btn nd-btn-outline nd-btn-sm">Ouvrir</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></div></div>
          )}
        </>
      )}

      {/* ─── Nouvelle entreprise ─── */}
      <Modal open={!!creation} wide title="Nouvelle entreprise de transport" onClose={() => setCreation(null)}
        footer={<>
          <button className="nd-btn nd-btn-ghost" onClick={() => setCreation(null)}>Annuler</button>
          <button className="nd-btn nd-btn-primary" disabled={busy} onClick={creer}><CheckCircle2 size={15} /> Créer l'entreprise et ses identifiants</button>
        </>}>
        {creation && <>
          <h4 className="ent-section">L'entreprise</h4>
          <div className="nd-form-row">
            <Champ label="Nom *"><input className="nd-input" {...champ(creation, setCreation, 'nom')} placeholder="Ex. Dakar Dem Dikk Express" /></Champ>
            <Champ label="Ville *"><input className="nd-input" {...champ(creation, setCreation, 'ville')} placeholder="Ex. Thiès" /></Champ>
            <Champ label="Téléphone *"><input className="nd-input" {...champ(creation, setCreation, 'telephone')} placeholder="33 820 11 22" /></Champ>
            <Champ label="E-mail de l'entreprise"><input className="nd-input" {...champ(creation, setCreation, 'email')} /></Champ>
            <Champ label="NINEA"><input className="nd-input" {...champ(creation, setCreation, 'ninea')} /></Champ>
            <Champ label="RCCM"><input className="nd-input" {...champ(creation, setCreation, 'rccm')} /></Champ>
          </div>
          <Champ label="Adresse"><input className="nd-input" {...champ(creation, setCreation, 'adresse')} /></Champ>

          <h4 className="ent-section">Abonnement</h4>
          <div className="nd-form-row">
            <Champ label="Formule">
              <select className="nd-input nd-select" {...champ(creation, setCreation, 'formule')}>
                {formules.filter(f => f.actif !== false).map(f => (
                  <option key={f.code} value={f.code}>{f.nom} — {money(f.prixMensuel)}/mois · {f.maxVehicules ? `${f.maxVehicules} véhicules` : 'illimité'}</option>
                ))}
              </select>
            </Champ>
            <Champ label="Jours offerts au départ" aide="Essai gratuit avant le premier paiement (0 = aucun)">
              <input className="nd-input" type="number" min="0" max="365" {...champ(creation, setCreation, 'joursEssai')} />
            </Champ>
          </div>

          <h4 className="ent-section">Compte du gérant</h4>
          <div className="nd-form-row">
            <Champ label="Nom du gérant *"><input className="nd-input" {...champ(creation, setCreation, 'nomGestionnaire')} /></Champ>
            <Champ label="E-mail de connexion *"><input className="nd-input" type="email" {...champ(creation, setCreation, 'emailConnexion')} /></Champ>
          </div>
          <Champ label="Mot de passe" aide="Laissez vide pour en générer un automatiquement (recommandé).">
            <input className="nd-input" {...champ(creation, setCreation, 'motDePasse')} placeholder="Généré automatiquement" />
          </Champ>
        </>}
      </Modal>

      <Identifiants data={identifiants} onClose={() => setIdentifiants(null)} />

      {/* ─── Fiche d'une entreprise ─── */}
      <Modal open={!!detail && !edition && !paiement} wide title={detail?.nom || ''} onClose={() => setDetail(null)}
        footer={detail && <>
          <button className={`nd-btn ${detail.statut === 'ACTIVE' ? 'nd-btn-outline' : 'nd-btn-primary'}`} onClick={basculer}>
            {detail.statut === 'ACTIVE' ? <><PauseCircle size={15} /> Suspendre</> : <><PlayCircle size={15} /> Réactiver</>}
          </button>
          <button className="nd-btn nd-btn-outline" onClick={nouveauMdp}><KeyRound size={15} /> Nouveau mot de passe</button>
          <button className="nd-btn nd-btn-outline" onClick={() => setEdition({
            nom: detail.nom, ville: detail.ville, telephone: detail.telephone, email: detail.email || '',
            ninea: detail.ninea || '', rccm: detail.rccm || '', adresse: detail.adresse || '', formule: detail.formule,
          })}><Pencil size={15} /> Modifier</button>
          <button className="nd-btn nd-btn-primary" onClick={() => setPaiement({ mois: '1', moyen: 'WAVE', reference: '', montant: '' })}>
            <Wallet size={15} /> Enregistrer un paiement
          </button>
        </>}>
        {detail && <>
          <div className="ent-entete" style={{ marginBottom: 12 }}>
            <EtatAbonnement e={detail} />
            <span className="nd-cell-sub">Abonnement jusqu'au <b>{fmtDate(detail.abonnementJusquau)}</b></span>
          </div>
          {(detail.aRenouveler || !detail.abonnementValide) && detail.statut === 'ACTIVE' && (
            <div className="ent-alerte"><AlertTriangle size={16} />
              {detail.abonnementValide ? `L'abonnement se termine dans ${detail.joursRestants} jour(s) : pensez à relancer l'entreprise.`
                : "L'abonnement est terminé : ses trajets ne sont plus proposés aux clients tant qu'il n'est pas renouvelé."}
            </div>
          )}
          <div className="ent-infos">
            <div><span>Formule</span><b>{nomFormule(detail.formule)}</b> {detail.prixMensuel != null && `· ${money(detail.prixMensuel)}/mois`}</div>
            <div><span>Véhicules</span><b>{detail.nombreVehicules}{detail.maxVehicules ? ` / ${detail.maxVehicules} max` : ' (illimité)'}</b></div>
            <div><span>Chauffeurs</span><b>{detail.nombreChauffeurs}</b></div>
            <div><span>Gérant</span><b>{detail.gestionnaire || '—'}</b></div>
            <div><span>Téléphone</span><b>{detail.telephone}</b></div>
            <div><span>E-mail</span><b>{detail.email || '—'}</b></div>
            <div><span>Ville</span><b>{detail.ville}</b></div>
            <div><span>Adresse</span><b>{detail.adresse || '—'}</b></div>
            <div><span>NINEA</span><b>{detail.ninea || '—'}</b></div>
            <div><span>RCCM</span><b>{detail.rccm || '—'}</b></div>
            <div><span>Créée le</span><b>{fmtDT(detail.createdAt)}</b> {detail.valideePar && <small className="nd-cell-sub">par {detail.valideePar}</small>}</div>
          </div>
          <h4 className="ent-section">Activité de l'entreprise</h4>
          {!activite ? <Spinner /> : activite.erreur ? <p className="nd-cell-sub">Activité indisponible.</p> : <>
            <div className="ee-tuiles">
              <Tuile label="Recette du mois" value={money(activite.tdb.recetteMois)} sub={`Total : ${money(activite.tdb.recetteTotale)}`} />
              <Tuile label="Véhicules en service" value={`${activite.tdb.vehiculesEnService} / ${activite.tdb.vehicules}`} sub={`${activite.tdb.placesTotales} places`} />
              <Tuile label="Chauffeurs" value={activite.tdb.chauffeurs} />
              <Tuile label="Trajets à venir" value={activite.tdb.trajetsAVenir} />
            </div>
            <div className="ee-sous-titre">Recettes des 6 derniers mois</div>
            <GraphiqueRecettes donnees={activite.tdb.recettesParMois} />
            {activite.vehicules.length > 0 && (
              <div className="nd-table-wrap" style={{ marginTop: 12 }}><table className="nd-table">
                <thead><tr><th>Véhicule</th><th>Type</th><th>Places</th><th>État</th></tr></thead>
                <tbody>{activite.vehicules.map(v => (
                  <tr key={v.id}><td className="ent-mdp">{v.numeroImmatriculation}</td><td>{v.typeLibelle}</td><td>{v.nombrePlaces}</td><td><EtatVehicule etat={v.etat} /></td></tr>
                ))}</tbody>
              </table></div>
            )}
            {activite.chauffeurs.length > 0 && (
              <div className="nd-table-wrap" style={{ marginTop: 12 }}><table className="nd-table">
                <thead><tr><th>Chauffeur</th><th>Téléphone</th><th>Trajets</th></tr></thead>
                <tbody>{activite.chauffeurs.map(c => (
                  <tr key={c.id}><td>{c.name}</td><td className="ent-mdp">{c.telephone}</td><td>{c.trajets}</td></tr>
                ))}</tbody>
              </table></div>
            )}
          </>}

          <h4 className="ent-section">Paiements d'abonnement</h4>
          {paiements.length === 0 ? <p className="nd-cell-sub">Aucun paiement enregistré.</p> : (
            <div className="nd-table-wrap"><table className="nd-table">
              <thead><tr><th>Date</th><th>Période</th><th>Montant</th><th>Moyen</th><th>Référence</th><th>Par</th></tr></thead>
              <tbody>{paiements.map(p => (
                <tr key={p.id}>
                  <td>{fmtDate(p.createdAt)}</td>
                  <td>{fmtDate(p.periodeDebut)} → {fmtDate(p.periodeFin)} <small className="nd-cell-sub">({p.mois} mois)</small></td>
                  <td><b>{money(p.montant)}</b></td>
                  <td>{MOYENS[p.moyen] || p.moyen}</td>
                  <td>{p.reference || '—'}</td>
                  <td><small>{p.enregistrePar}</small></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </>}
      </Modal>

      {/* ─── Modifier ─── */}
      <Modal open={!!edition} wide title={`Modifier — ${detail?.nom || ''}`} onClose={() => setEdition(null)}
        footer={<>
          <button className="nd-btn nd-btn-ghost" onClick={() => setEdition(null)}>Annuler</button>
          <button className="nd-btn nd-btn-primary" disabled={busy} onClick={enregistrerEdition}>Enregistrer</button>
        </>}>
        {edition && <>
          <div className="nd-form-row">
            <Champ label="Nom"><input className="nd-input" {...champ(edition, setEdition, 'nom')} /></Champ>
            <Champ label="Ville"><input className="nd-input" {...champ(edition, setEdition, 'ville')} /></Champ>
            <Champ label="Téléphone"><input className="nd-input" {...champ(edition, setEdition, 'telephone')} /></Champ>
            <Champ label="E-mail"><input className="nd-input" {...champ(edition, setEdition, 'email')} /></Champ>
            <Champ label="NINEA"><input className="nd-input" {...champ(edition, setEdition, 'ninea')} /></Champ>
            <Champ label="RCCM"><input className="nd-input" {...champ(edition, setEdition, 'rccm')} /></Champ>
          </div>
          <Champ label="Adresse"><input className="nd-input" {...champ(edition, setEdition, 'adresse')} /></Champ>
          <Champ label="Formule" aide="Le changement s'applique aux prochains paiements.">
            <select className="nd-input nd-select" {...champ(edition, setEdition, 'formule')}>
              {formules.map(f => <option key={f.code} value={f.code}>{f.nom} — {money(f.prixMensuel)}/mois</option>)}
            </select>
          </Champ>
        </>}
      </Modal>

      {/* ─── Paiement ─── */}
      <Modal open={!!paiement} title={`Paiement d'abonnement — ${detail?.nom || ''}`} onClose={() => setPaiement(null)}
        footer={<>
          <button className="nd-btn nd-btn-ghost" onClick={() => setPaiement(null)}>Annuler</button>
          <button className="nd-btn nd-btn-primary" disabled={busy} onClick={payer}><Wallet size={15} /> Enregistrer</button>
        </>}>
        {paiement && <>
          <Champ label="Durée payée">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['1', '3', '6', '12'].map(m => (
                <button key={m} className={`nd-btn nd-btn-sm ${paiement.mois === m ? 'nd-btn-primary' : 'nd-btn-outline'}`}
                  onClick={() => setPaiement({ ...paiement, mois: m })}>{m} mois</button>
              ))}
            </div>
          </Champ>
          <div className="nd-form-row" style={{ marginTop: 12 }}>
            <Champ label="Moyen">
              <select className="nd-input nd-select" {...champ(paiement, setPaiement, 'moyen')}>
                {Object.entries(MOYENS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Champ>
            <Champ label="Référence" aide="N° de transaction Wave / OM, de reçu…">
              <input className="nd-input" {...champ(paiement, setPaiement, 'reference')} />
            </Champ>
          </div>
          <Champ label="Montant reçu (F CFA)" aide={`Laissez vide pour le tarif de la formule : ${money(prixFormule * Number(paiement.mois))}`}>
            <input className="nd-input" type="number" min="0" {...champ(paiement, setPaiement, 'montant')} placeholder={String(prixFormule * Number(paiement.mois))} />
          </Champ>
          <p className="nd-cell-sub" style={{ marginTop: 10 }}>
            Les mois s'ajoutent après la fin actuelle de l'abonnement ({fmtDate(detail?.abonnementJusquau)}), ou à partir d'aujourd'hui s'il est déjà terminé.
          </p>
        </>}
      </Modal>

      {/* ─── Formule ─── */}
      <Modal open={!!formuleEdit} title={`Formule ${formuleEdit?.nom || ''}`} onClose={() => setFormuleEdit(null)}
        footer={<>
          <button className="nd-btn nd-btn-ghost" onClick={() => setFormuleEdit(null)}>Annuler</button>
          <button className="nd-btn nd-btn-primary" disabled={busy} onClick={enregistrerFormule}>Enregistrer</button>
        </>}>
        {formuleEdit && <>
          <div className="nd-form-row">
            <Champ label="Nom"><input className="nd-input" {...champ(formuleEdit, setFormuleEdit, 'nom')} /></Champ>
            <Champ label="Prix mensuel (F CFA)"><input className="nd-input" type="number" min="0" {...champ(formuleEdit, setFormuleEdit, 'prixMensuel')} /></Champ>
          </div>
          <Champ label="Nombre maximum de véhicules" aide="Vide = illimité">
            <input className="nd-input" type="number" min="1" {...champ(formuleEdit, setFormuleEdit, 'maxVehicules')} />
          </Champ>
          <Champ label="Description"><textarea className="nd-input" rows={3} {...champ(formuleEdit, setFormuleEdit, 'description')} /></Champ>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
            <input type="checkbox" checked={formuleEdit.actif !== false} onChange={ev => setFormuleEdit({ ...formuleEdit, actif: ev.target.checked })} />
            Proposée lors de la création d'une entreprise
          </label>
        </>}
      </Modal>
    </div>
  );
}
