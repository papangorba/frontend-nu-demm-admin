import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, XCircle, MapPinned, Repeat, ArrowRight, Users } from 'lucide-react';
import { apiMonEntreprise, Audit, money } from '../../services/api';
import { Spinner, Modal } from '../../components/ui';
import { useToast, useAuth } from '../../context/AppContext';
import Passagers from './Passagers';

/**
 * Trajets de l'entreprise (SaaS, partie 3d-1) : ils sont proposés aux clients de
 * l'app Ñu Demm, qui réservent leurs places. Trajets récurrents (suggestion 1),
 * modification (les passagers sont prévenus d'un changement d'horaire) et
 * annulation d'un départ ou de toute la série (passagers prévenus).
 */

const JOURS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Jeu'], [5, 'Ven'], [6, 'Sam'], [7, 'Dim']];
const STATUTS = {
  ACTIF: ['badge-success', 'Ouvert à la réservation'],
  COMPLET: ['badge-warn', 'Complet'],
  TERMINE: ['badge-secondary', 'Terminé'],
  ANNULE: ['badge-danger', 'Annulé'],
};
const deux = n => String(n).padStart(2, '0');
const aujourdhui = () => { const d = new Date(); return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`; };
const NOMS_JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
/** « lun. 10 nov. · 07h30 » */
const quand = iso => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${NOMS_JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} · ${deux(d.getHours())}h${deux(d.getMinutes())}`;
};

/** Nombre de départs d'une série (même calcul que le serveur). */
function compterDeparts(date, jours, jusquau) {
  if (!date || !jusquau || jours.length === 0) return 0;
  const fin = new Date(`${jusquau}T23:59`);
  let n = 0;
  for (let d = new Date(`${date}T00:00`); d <= fin; d.setDate(d.getDate() + 1)) {
    const iso = d.getDay() === 0 ? 7 : d.getDay();
    if (jours.includes(iso)) n++;
  }
  return n;
}

const VIDE = { lieuDepart: '', lieuDestination: '', date: '', heure: '07:00', vehiculeId: '', chauffeurId: '', prixParPlace: '', arrets: '', notes: '', repeter: false, jours: [1, 2, 3, 4, 5], jusquau: '' };

export default function Trajets() {
  const toast = useToast();
  const [periode, setPeriode] = useState('A_VENIR');
  const [liste, setListe] = useState(null);
  const [vehicules, setVehicules] = useState([]);
  const [chauffeurs, setChauffeurs] = useState([]);
  const [form, setForm] = useState(null);        // création ou modification
  const [annulation, setAnnulation] = useState(null);
  const [passagers, setPassagers] = useState(null);  // départ dont on ouvre la liste d'embarquement
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const charger = async (p = periode) => {
    try {
      const [t, v, c] = await Promise.all([apiMonEntreprise.trajets(p), apiMonEntreprise.vehicules(), apiMonEntreprise.chauffeurs()]);
      setListe(t || []); setVehicules(v || []); setChauffeurs((c || []).filter(x => x.actif));
    } catch (e) { toast(e.message, 'error'); setListe(l => l || []); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setListe(null); charger(periode); }, [periode]);

  const enService = vehicules.filter(v => v.etat === 'EN_SERVICE');
  const nbDeparts = useMemo(() => (form && !form.id && form.repeter ? compterDeparts(form.date, form.jours, form.jusquau) : 1),
    [form]);

  const ouvrirCreation = () => setForm({ ...VIDE, vehiculeId: enService[0]?.id || '', chauffeurId: chauffeurs[0]?.id || '' });
  const ouvrirModification = t => {
    const d = new Date(t.dateHeureDepart);
    setForm({
      ...VIDE, id: t.id, reservations: t.reservations,
      lieuDepart: t.lieuDepart, lieuDestination: t.lieuDestination,
      date: `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`, heure: `${deux(d.getHours())}:${deux(d.getMinutes())}`,
      vehiculeId: t.vehiculeId, chauffeurId: t.chauffeurId, prixParPlace: t.prixParPlace,
      arrets: (t.arrets || []).join(', '), notes: t.notes || '',
    });
  };

  const enregistrer = async () => {
    if (!form.date || !form.heure) { toast("Indiquez la date et l'heure de départ", 'error'); return; }
    const d = {
      lieuDepart: form.lieuDepart, lieuDestination: form.lieuDestination,
      dateHeureDepart: `${form.date}T${form.heure}`,
      vehiculeId: form.vehiculeId, chauffeurId: form.chauffeurId, prixParPlace: form.prixParPlace,
      arrets: form.arrets.split(',').map(a => a.trim()).filter(Boolean), notes: form.notes,
    };
    if (!form.id && form.repeter) d.repetition = { jours: form.jours, jusquau: form.jusquau };
    setBusy(true);
    try {
      if (form.id) {
        await apiMonEntreprise.modifierTrajet(form.id, d);
        Audit.log('TRAJET_MODIFIE', `${d.lieuDepart} → ${d.lieuDestination}`);
        toast(form.reservations > 0 ? 'Trajet modifié — les passagers sont prévenus si l\'heure change' : 'Trajet modifié', 'success');
      } else {
        const crees = await apiMonEntreprise.creerTrajet(d);
        Audit.log('TRAJET_CREE', `${d.lieuDepart} → ${d.lieuDestination} (${crees.length} départ(s))`);
        toast(crees.length > 1 ? `${crees.length} départs créés : ils sont proposés aux clients` : 'Trajet créé : il est proposé aux clients', 'success');
      }
      setForm(null);
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const annuler = async () => {
    setBusy(true);
    try {
      const r = await apiMonEntreprise.annulerTrajet(annulation.t.id, { serie: annulation.serie, motif: annulation.motif });
      Audit.log('TRAJET_ANNULE', `${annulation.t.lieuDepart} → ${annulation.t.lieuDestination} (${r.trajetsAnnules})`);
      toast(`${r.trajetsAnnules} départ(s) annulé(s) · ${r.passagersPrevenus} passager(s) prévenu(s)`, 'success');
      setAnnulation(null);
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const champ = cle => ({ value: form?.[cle] ?? '', onChange: ev => setForm({ ...form, [cle]: ev.target.value }) });
  const basculerJour = j => setForm({ ...form, jours: form.jours.includes(j) ? form.jours.filter(x => x !== j) : [...form.jours, j].sort() });
  const manque = vehicules.length === 0 || chauffeurs.length === 0;

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Mes trajets</h1>
          <p>Vos départs sont proposés aux clients de l'application Ñu Demm (rubrique <b>Bus</b> pour vos bus et minibus, <b>Allô Sénégal</b> pour vos voitures 7 places), qui réservent et paient leurs places.</p>
        </div>
        <button className="nd-btn nd-btn-primary" disabled={manque} onClick={ouvrirCreation}><Plus size={15} /> Nouveau trajet</button>
      </div>
      {manque && liste !== null && (
        <div className="ent-alerte">Pour créer un trajet, ajoutez d'abord{vehicules.length === 0 && <> un <Link to="/mon-entreprise/vehicules">véhicule</Link></>}
          {vehicules.length === 0 && chauffeurs.length === 0 && ' et'}{chauffeurs.length === 0 && <> un <Link to="/mon-entreprise/chauffeurs">chauffeur</Link></>}.</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['A_VENIR', 'À venir'], ['PASSES', 'Passés et annulés']].map(([k, l]) => (
          <button key={k} className={`nd-btn nd-btn-sm ${periode === k ? 'nd-btn-primary' : 'nd-btn-outline'}`} onClick={() => setPeriode(k)}>{l}</button>
        ))}
      </div>

      {liste === null ? <Spinner center /> : liste.length === 0 ? (
        <div className="nd-card"><div className="nd-card-body" style={{ textAlign: 'center', padding: 40 }}>
          <MapPinned size={40} color="var(--nd-text-dim)" />
          <p className="nd-cell-sub">{periode === 'A_VENIR' ? 'Aucun trajet à venir. Créez votre premier départ avec « Nouveau trajet ».' : 'Aucun trajet passé.'}</p>
        </div></div>
      ) : (
        <div className="nd-card"><div className="nd-card-body-p0"><div className="nd-table-wrap">
          <table className="nd-table">
            <thead><tr><th>Départ</th><th>Trajet</th><th>Véhicule · chauffeur</th><th>Places</th><th>Prix</th><th>Recette</th><th>Statut</th><th></th></tr></thead>
            <tbody>{liste.map(t => {
              const [cls, label] = STATUTS[t.statut] || ['badge-secondary', t.statut];
              const ouvert = t.statut === 'ACTIF' || t.statut === 'COMPLET';
              return (
                <tr key={t.id}>
                  <td><b>{quand(t.dateHeureDepart)}</b>{t.serieId && <small className="nd-cell-sub" style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Repeat size={12} /> Série</small>}</td>
                  <td><b className="tr-trajet">{t.lieuDepart} <ArrowRight size={13} /> {t.lieuDestination}</b>
                    {t.arrets?.length > 0 && <small className="nd-cell-sub" style={{ display: 'block' }}>Arrêts : {t.arrets.join(', ')}</small>}</td>
                  <td><small>{t.vehicule || '—'}</small><small className="nd-cell-sub" style={{ display: 'block' }}>{t.chauffeur}</small></td>
                  <td><b>{t.placesReservees}</b> / {t.nombrePlacesTotal}<small className="nd-cell-sub" style={{ display: 'block' }}>{t.reservations} réservation(s)</small></td>
                  <td>{money(t.prixParPlace)}</td>
                  <td><b>{money(t.recette)}</b></td>
                  <td><span className={`nd-badge ${cls}`}>{label}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="nd-btn nd-btn-outline nd-btn-sm" title="Passagers, billets et message" onClick={() => setPassagers(t)}><Users size={14} /></button>
                      {ouvert && <>
                        <button className="nd-btn nd-btn-outline nd-btn-sm" title="Modifier" onClick={() => ouvrirModification(t)}><Pencil size={14} /></button>
                        <button className="nd-btn nd-btn-outline nd-btn-sm" title="Annuler" onClick={() => setAnnulation({ t, serie: false, motif: '' })}><XCircle size={14} /></button>
                      </>}
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div></div></div>
      )}

      {/* ─── Créer / modifier ─── */}
      <Modal open={!!form} wide title={form?.id ? 'Modifier le trajet' : 'Nouveau trajet'} onClose={() => setForm(null)}
        footer={<>
          <button className="nd-btn nd-btn-ghost" onClick={() => setForm(null)}>Annuler</button>
          <button className="nd-btn nd-btn-primary" disabled={busy || (form?.repeter && nbDeparts === 0)} onClick={enregistrer}>
            {form?.id ? 'Enregistrer' : nbDeparts > 1 ? `Créer ${nbDeparts} départs` : 'Créer le trajet'}
          </button>
        </>}>
        {form && <>
          {form.id && form.reservations > 0 && (
            <div className="ent-alerte">{form.reservations} réservation(s) sur ce trajet : le départ et la destination ne peuvent plus changer. Si vous changez l'heure, les passagers sont prévenus.</div>
          )}
          <div className="nd-form-row">
            <div className="nd-form-group"><label>Départ *</label><input className="nd-input" {...champ('lieuDepart')} disabled={form.reservations > 0} placeholder="Ex. Dakar, gare des Baux maraîchers" /></div>
            <div className="nd-form-group"><label>Destination *</label><input className="nd-input" {...champ('lieuDestination')} disabled={form.reservations > 0} placeholder="Ex. Thiès" /></div>
            <div className="nd-form-group"><label>{form.repeter ? 'Premier départ *' : 'Date *'}</label><input className="nd-input" type="date" min={aujourdhui()} {...champ('date')} /></div>
            <div className="nd-form-group"><label>Heure *</label><input className="nd-input" type="time" {...champ('heure')} /></div>
            <div className="nd-form-group"><label>Véhicule *</label>
              <select className="nd-input nd-select" {...champ('vehiculeId')}>
                {enService.map(v => <option key={v.id} value={v.id}>{v.typeLibelle} · {v.numeroImmatriculation} · {v.nombrePlaces} places</option>)}
              </select>
              {enService.length < vehicules.length && <small className="nd-cell-sub">Les véhicules en maintenance ou hors service ne sont pas proposés.</small>}
            </div>
            <div className="nd-form-group"><label>Chauffeur *</label>
              <select className="nd-input nd-select" {...champ('chauffeurId')}>
                {chauffeurs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div className="nd-form-group"><label>Prix par place (F CFA) *</label><input className="nd-input" type="number" min="100" step="50" {...champ('prixParPlace')} placeholder="Ex. 3500" /></div>
            <div className="nd-form-group"><label>Arrêts</label><input className="nd-input" {...champ('arrets')} placeholder="Ex. Rufisque, Diamniadio" />
              <small className="nd-cell-sub">Séparés par des virgules</small></div>
          </div>
          <div className="nd-form-group"><label>Informations pour les passagers</label>
            <textarea className="nd-input" rows={2} {...champ('notes')} placeholder="Ex. Embarquement 15 min avant · 1 bagage en soute compris" /></div>

          {!form.id && (
            <div className="tr-repeter">
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
                <input type="checkbox" checked={form.repeter} onChange={ev => setForm({ ...form, repeter: ev.target.checked })} />
                <Repeat size={15} /> Répéter ce trajet
              </label>
              {form.repeter && <>
                <div className="tr-jours">
                  {JOURS.map(([n, l]) => (
                    <button key={n} type="button" className={`nd-btn nd-btn-sm ${form.jours.includes(n) ? 'nd-btn-primary' : 'nd-btn-outline'}`} onClick={() => basculerJour(n)}>{l}</button>
                  ))}
                </div>
                <div className="nd-form-row" style={{ marginTop: 10 }}>
                  <div className="nd-form-group"><label>Jusqu'au *</label><input className="nd-input" type="date" min={form.date || aujourdhui()} {...champ('jusquau')} /></div>
                  <div className="nd-form-group"><label>Départs créés</label>
                    <div className="tr-compte">{nbDeparts > 0 ? `${nbDeparts} départ(s) à ${form.heure}` : 'Choisissez les jours et la date de fin'}</div>
                    {nbDeparts > 62 && <small style={{ color: 'var(--nd-red)' }}>62 départs au maximum par série</small>}
                  </div>
                </div>
              </>}
            </div>
          )}
        </>}
      </Modal>

      <Passagers trajet={passagers} entreprise={user?.flotteNom} onClose={() => setPassagers(null)} onChange={() => charger()} />

      {/* ─── Annuler ─── */}
      <Modal open={!!annulation} title="Annuler le trajet" onClose={() => setAnnulation(null)}
        footer={<>
          <button className="nd-btn nd-btn-ghost" onClick={() => setAnnulation(null)}>Retour</button>
          <button className="nd-btn nd-btn-danger" disabled={busy} onClick={annuler}>Annuler et prévenir les passagers</button>
        </>}>
        {annulation && <>
          <p><b>{annulation.t.lieuDepart} → {annulation.t.lieuDestination}</b> · {quand(annulation.t.dateHeureDepart)}</p>
          <p className="nd-cell-sub">{annulation.t.reservations > 0
            ? `${annulation.t.reservations} réservation(s) seront annulées et les passagers recevront une notification.`
            : 'Aucune réservation sur ce départ.'}</p>
          {annulation.t.serieId && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0' }}>
              <input type="checkbox" checked={annulation.serie} onChange={ev => setAnnulation({ ...annulation, serie: ev.target.checked })} />
              Annuler aussi tous les départs suivants de cette série
            </label>
          )}
          <div className="nd-form-group"><label>Motif (envoyé aux passagers)</label>
            <input className="nd-input" value={annulation.motif} onChange={ev => setAnnulation({ ...annulation, motif: ev.target.value })} placeholder="Ex. Panne du véhicule" /></div>
        </>}
      </Modal>
    </div>
  );
}
