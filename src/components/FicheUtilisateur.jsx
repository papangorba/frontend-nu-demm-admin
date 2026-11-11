import { useEffect, useState } from 'react';
import { Phone, MapPin, Car, FileText, BarChart3, Clock, Bell, BellOff, Building2, AlertTriangle, CheckCircle2, XCircle, Eye, Users, Star, ShieldAlert } from 'lucide-react';
import { apiFiche, apiControle, Audit, fmtDT, fmtDate } from '../services/api';
import { Avatar, Modal, Spinner } from './ui';
import { useToast } from '../context/AppContext';

/**
 * Fiche complète d'un client ou d'un chauffeur : activité (inscription, dernière connexion,
 * inactivité en alerte), véhicule(s) cliquables, documents (voir / valider / refuser), statistiques.
 */

const STATUT_DOC = {
  VALIDE: ['badge-success', 'Validé'], EN_ATTENTE: ['badge-warn', 'À vérifier'], REFUSE: ['badge-danger', 'Refusé'],
  EXPIRE: ['badge-danger', 'Expiré'], MANQUANT: ['badge-secondary', 'Manquant'],
};
const NOMS_VEHICULE = { type: 'Type', marque: 'Marque', modele: 'Modèle', couleur: 'Couleur', anneeFabrication: 'Année',
  numeroImmatriculation: 'Immatriculation', nombrePlaces: 'Places', etat: 'État' };

/** « il y a 3 j » / « aujourd'hui » */
export function ilYa(d) {
  if (!d) return 'jamais';
  const j = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (j <= 0) {
    const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000);
    return h <= 0 ? "à l'instant" : `il y a ${h} h`;
  }
  return j === 1 ? 'hier' : `il y a ${j} j`;
}

/** Jours sans activité (dernière connexion, sinon inscription) */
export function joursInactif(u) {
  const ref = u?.derniereConnexion || u?.dateInscription;
  return ref ? Math.floor((Date.now() - new Date(ref).getTime()) / 86400000) : null;
}

/** Badge « Inactif depuis X j » si le seuil est dépassé */
export function BadgeInactivite({ user, seuil }) {
  const j = joursInactif(user);
  if (j == null || j < (seuil || 30)) return null;
  return <span className="nd-badge badge-danger" title="Alerte d'inactivité" style={{ whiteSpace: 'nowrap' }}>
    <AlertTriangle size={11} /> Inactif {j} j
  </span>;
}

function Ligne({ label, children }) {
  return <div className="nd-detail-row"><span className="nd-detail-label">{label}</span><span className="nd-detail-val">{children ?? '—'}</span></div>;
}

function Section({ icone: Icone, titre, children, alerte }) {
  return (
    <div className="nd-card" style={{ marginBottom: 14, borderColor: alerte ? 'var(--nd-red)' : undefined }}>
      <div className="nd-card-header"><span className="nd-card-title" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icone size={16} /> {titre}</span></div>
      <div className="nd-card-body">{children}</div>
    </div>
  );
}

function Compteurs({ titre, c }) {
  if (!c) return null;
  return <Ligne label={titre}>
    <b>{c.total}</b> · {c.terminees} terminé(e)s · {c.annulees} annulé(e)s{c.expirees ? ` · ${c.expirees} sans chauffeur` : ''}{c.enCours ? ` · ${c.enCours} en cours` : ''}
  </Ligne>;
}

export default function FicheUtilisateur({ userId, onClose, onOuvrirAutre }) {
  const toast = useToast();
  const [f, setF] = useState(null);
  const [vehicule, setVehicule] = useState(null);
  const [doc, setDoc] = useState(null);        // { ...document, url }
  const [busy, setBusy] = useState(null);

  const charger = async () => {
    try { setF(await apiFiche.fiche(userId)); }
    catch (e) { toast(e.message, 'error'); onClose(); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (userId) { setF(null); charger(); } }, [userId]);

  const voirDocument = async d => {
    try { setDoc({ ...d, url: await apiControle.fichierDocument(d.id) }); }
    catch (e) { toast(e.message, 'error'); }
  };
  const traiter = async (d, valider) => {
    const motif = valider ? null : window.prompt('Motif du refus (le chauffeur le recevra) :', 'Photo illisible');
    if (!valider && motif === null) return;
    setBusy(d.id);
    try {
      if (valider) await apiControle.validerDocument(d.id); else await apiControle.refuserDocument(d.id, motif);
      Audit.log(valider ? 'DOCUMENT_VALIDE' : 'DOCUMENT_REFUSE', `${d.libelle} — ${f.identite.name}`);
      toast(valider ? 'Document validé' : 'Document refusé', 'success');
      setDoc(null);
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  if (!userId) return null;
  const chauffeur = f?.identite?.role === 'CHAUFFEUR';
  const a = f?.activite, st = f?.statistiques;

  return (
    <>
      <Modal open wide title={chauffeur ? 'Fiche chauffeur' : 'Fiche client'} onClose={onClose}>
        {!f ? <Spinner center /> : (
          <div>
            {/* En-tête */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              <Avatar name={f.identite.name || '?'} size={56} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{f.identite.name || '—'} <small className="nd-cell-sub">#{f.identite.id}</small></div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  <span className="nd-badge badge-secondary">{chauffeur ? 'Chauffeur' : 'Client'}</span>
                  {f.identite.compteActif ? <span className="nd-badge badge-success">● Actif</span> : <span className="nd-badge badge-danger">⛔ Suspendu</span>}
                  {a.alerteInactivite && <span className="nd-badge badge-danger"><AlertTriangle size={11} /> Inactif depuis {a.joursInactif} j</span>}
                  {chauffeur && (a.enLigne ? <span className="nd-badge badge-success">En ligne</span> : <span className="nd-badge badge-secondary">Hors ligne</span>)}
                  {st.enCours && <span className="nd-badge badge-warn">Trajet en cours</span>}
                </div>
              </div>
              <a className="nd-btn nd-btn-outline nd-btn-sm" href={`tel:+221${f.identite.telephone}`}><Phone size={14} /> {f.identite.telephone}</a>
            </div>

            <div className="nd-grid-2">
              <div>
                <Section icone={Clock} titre="Activité" alerte={a.alerteInactivite}>
                  <Ligne label="Inscrit le">{fmtDT(a.dateInscription)}</Ligne>
                  <Ligne label="Dernière connexion">{a.derniereConnexion ? <>{fmtDT(a.derniereConnexion)} <small className="nd-cell-sub">({ilYa(a.derniereConnexion)})</small></> : <span className="nd-cell-sub">jamais revenu depuis l'inscription</span>}</Ligne>
                  <Ligne label="Inactivité">{a.joursInactif != null ? <span style={{ color: a.alerteInactivite ? 'var(--nd-red)' : undefined, fontWeight: a.alerteInactivite ? 700 : 400 }}>
                    {a.joursInactif} jour(s){a.alerteInactivite ? ` — au-delà du seuil de ${a.seuilAlerteJours} j` : ''}</span> : '—'}</Ligne>
                  <Ligne label="Dernier trajet">{st.dernierTrajet ? `${fmtDT(st.dernierTrajet)} (${ilYa(st.dernierTrajet)})` : 'aucun'}</Ligne>
                  <Ligne label="Notifications">{a.notificationsActives ? <span><Bell size={13} /> joignable</span> : <span className="nd-cell-sub"><BellOff size={13} /> non joignable</span>}</Ligne>
                  {chauffeur && <Ligne label="Dernière position">{a.latitude ? <a href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`} target="_blank" rel="noreferrer"><MapPin size={13} /> voir sur la carte</a> : '—'}{a.dernierePosition && <small className="nd-cell-sub"> · {ilYa(a.dernierePosition)}</small>}</Ligne>}
                </Section>

                <Section icone={Users} titre="Compte">
                  <Ligne label="Téléphone">{f.identite.telephone}</Ligne>
                  <Ligne label="E-mail">{f.identite.email}</Ligne>
                  {f.entreprise && <Ligne label="Entreprise"><Building2 size={13} /> {f.entreprise.nom} {!f.entreprise.abonnementValide && <span className="nd-badge badge-danger">abonnement expiré</span>}</Ligne>}
                  {f.autresComptes?.length > 0 && <Ligne label="Même numéro">
                    {f.autresComptes.map(o => <button key={o.id} className="nd-btn nd-btn-outline nd-btn-sm" onClick={() => onOuvrirAutre?.(o.id)}>
                      Compte {o.role === 'CHAUFFEUR' ? 'chauffeur' : 'client'} #{o.id}</button>)}
                  </Ligne>}
                </Section>

                <Section icone={BarChart3} titre="Statistiques">
                  <Compteurs titre="Courses" c={st.courses} />
                  <Compteurs titre="Livraisons" c={st.livraisons} />
                  <Ligne label={chauffeur ? 'Gains' : 'Dépenses'}><b>{(chauffeur ? st.gainsTotal : st.depensesTotal)?.toLocaleString('fr-FR')} F</b></Ligne>
                  {chauffeur ? <>
                    <Ligne label="Note">{st.noteMoyenne ? <><Star size={13} /> {st.noteMoyenne} / 5 ({st.nombreAvis} avis)</> : 'aucun avis'}</Ligne>
                    <Ligne label="Trajets Taxi-Bokko">{st.trajetsTaxiBokko}</Ligne>
                  </> : <>
                    <Ligne label="Réservations (bus…)">{st.reservations}</Ligne>
                    <Ligne label="Contacts d'urgence">{st.contactsUrgence}</Ligne>
                  </>}
                  <Ligne label="Alertes SOS">{st.alertesSos ? <span style={{ color: 'var(--nd-red)' }}><ShieldAlert size={13} /> {st.alertesSos}</span> : 0}</Ligne>
                  {chauffeur && st.derniersAvis?.length > 0 && <div style={{ marginTop: 8 }}>
                    {st.derniersAvis.map((n, i) => <div key={i} className="nd-cell-sub" style={{ padding: '4px 0', borderTop: '1px solid var(--nd-border)' }}>
                      {'★'.repeat(n.note)}{'☆'.repeat(5 - n.note)} {n.commentaire ? `« ${n.commentaire} »` : ''} <small>· {fmtDate(n.date)}</small></div>)}
                  </div>}
                </Section>
              </div>

              {chauffeur && <div>
                <Section icone={Car} titre="Véhicule">
                  {f.vehicules.length === 0 ? <div className="nd-cell-sub">Aucun véhicule enregistré</div> :
                    f.vehicules.map(v => (
                      <button key={v.id} type="button" className="nd-card" onClick={() => setVehicule(v)}
                        style={{ width: '100%', textAlign: 'left', padding: 12, cursor: 'pointer', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                        <Car size={28} />
                        <span style={{ flex: 1 }}>
                          <b>{[v.marque, v.modele].filter(Boolean).join(' ') || v.type}</b>
                          <span className="nd-cell-sub" style={{ display: 'block' }}>{v.type} · {v.couleur || 'couleur ?'} · <b>{v.numeroImmatriculation}</b></span>
                        </span>
                        <Eye size={16} />
                      </button>))}
                </Section>

                <Section icone={FileText} titre="Permis" alerte={!!f.permis.alerte}>
                  <Ligne label="Numéro">{f.permis.numero}</Ligne>
                  <Ligne label="Expire le">{f.permis.expiration ? <>{fmtDate(f.permis.expiration)} {f.permis.alerte === 'EXPIRE' && <span className="nd-badge badge-danger">expiré</span>}{f.permis.alerte === 'BIENTOT' && <span className="nd-badge badge-warn">expire bientôt</span>}</> : '—'}</Ligne>
                </Section>

                <Section icone={FileText} titre="Documents" alerte={f.documents && !f.documents.enRegle}>
                  <div style={{ marginBottom: 8 }}>{f.documents.enRegle
                    ? <span className="nd-badge badge-success"><CheckCircle2 size={11} /> En règle — reçoit des courses</span>
                    : <span className="nd-badge badge-danger"><XCircle size={11} /> Pas en règle{f.documents.obligatoires ? ' — ne reçoit pas de courses' : ''}</span>}</div>
                  {f.documents.documents.map(d => {
                    const [cls, lib] = STATUT_DOC[d.statut] || ['badge-secondary', d.statut];
                    return <div key={d.type} className="nd-detail-row" style={{ alignItems: 'center' }}>
                      <span className="nd-detail-label">{d.libelle}{d.obligatoire ? ' *' : ''}</span>
                      <span className="nd-detail-val" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <span className={`nd-badge ${cls}`}>{lib}</span>
                        {d.dateExpiration && <small className="nd-cell-sub">exp. {fmtDate(d.dateExpiration)}</small>}
                        {d.id && <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={() => voirDocument(d)}><Eye size={13} /> Voir</button>}
                      </span>
                    </div>;
                  })}
                  {f.documents.documents.some(d => d.motifRefus) && <small className="nd-cell-sub">Motifs de refus visibles en ouvrant le document.</small>}
                </Section>
              </div>}
            </div>
          </div>
        )}
      </Modal>

      {/* Véhicule (cliquable depuis la fiche) */}
      <Modal open={!!vehicule} title="Véhicule" onClose={() => setVehicule(null)}>
        {vehicule && <div>
          {Object.entries(NOMS_VEHICULE).map(([k, l]) => <Ligne key={k} label={l}>{vehicule[k] ?? '—'}</Ligne>)}
          <Ligne label="Appartient à">{vehicule.flotteId ? `l'entreprise #${vehicule.flotteId}` : 'le chauffeur (indépendant)'}</Ligne>
        </div>}
      </Modal>

      {/* Document : photo + validation */}
      <Modal open={!!doc} wide title={doc ? doc.libelle : ''} onClose={() => { if (doc?.url) URL.revokeObjectURL(doc.url); setDoc(null); }}
        footer={doc && doc.statut === 'EN_ATTENTE' ? <>
          <button className="nd-btn nd-btn-outline" disabled={busy === doc.id} onClick={() => traiter(doc, false)}><XCircle size={14} /> Refuser</button>
          <button className="nd-btn nd-btn-primary" disabled={busy === doc.id} onClick={() => traiter(doc, true)}><CheckCircle2 size={14} /> Valider</button>
        </> : null}>
        {doc && <div style={{ textAlign: 'center' }}>
          <img src={doc.url} alt={doc.libelle} style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: 8 }} />
          <div className="nd-cell-sub" style={{ marginTop: 8 }}>
            Envoyé le {fmtDT(doc.envoyeLe)}{doc.dateExpiration ? ` · expire le ${fmtDate(doc.dateExpiration)}` : ''}
            {doc.motifRefus && <div style={{ color: 'var(--nd-red)' }}>Motif du refus : {doc.motifRefus}</div>}
          </div>
        </div>}
      </Modal>
    </>
  );
}
