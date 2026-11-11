import { useEffect, useRef, useState } from 'react';
import { Printer, Ticket, Send, CheckCircle2 } from 'lucide-react';
import { apiMonEntreprise, Audit, money } from '../../services/api';
import { Spinner, Modal } from '../../components/ui';
import { useToast } from '../../context/AppContext';

/**
 * Passagers d'un départ (SaaS, partie 3d-2) :
 *  - liste d'embarquement imprimable (suggestion 2) ;
 *  - contrôle des billets par code ou en cochant (suggestion 3) ;
 *  - message à tous les passagers du départ (suggestion 4).
 */

const deux = n => String(n).padStart(2, '0');
const quand = iso => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—'
    : `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()} à ${deux(d.getHours())}h${deux(d.getMinutes())}`;
};
const echapper = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Ouvre la liste dans une fenêtre propre et lance l'impression (ou l'enregistrement en PDF). */
function imprimer(d, entreprise) {
  const t = d.trajet;
  const lignes = d.passagers.map((p, i) => `
    <tr><td>${i + 1}</td><td>${echapper(p.nom)}</td><td>${echapper(p.telephone)}</td><td class="c">${p.places}</td>
    <td class="code">${echapper(p.codeBillet)}</td><td class="r">${p.resteAPayer > 0 ? echapper(money(p.resteAPayer)) : 'Payé'}</td>
    <td class="c">${p.embarque ? '✔' : '☐'}</td></tr>`).join('');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Passagers ${echapper(t.lieuDepart)} - ${echapper(t.lieuDestination)}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#111}
    h1{font-size:20px;margin:0 0 4px} .sous{color:#444;margin:0 0 14px;font-size:13px}
    .infos{display:flex;gap:24px;flex-wrap:wrap;font-size:13px;margin-bottom:14px}
    table{width:100%;border-collapse:collapse;font-size:13px} th,td{border:1px solid #999;padding:6px 8px;text-align:left}
    th{background:#eee} .c{text-align:center} .r{text-align:right} .code{font-family:Consolas,monospace;letter-spacing:.05em}
    .pied{margin-top:18px;font-size:12px;color:#444;display:flex;justify-content:space-between}
    @media print{body{margin:10mm}}
  </style></head><body>
  <h1>${echapper(entreprise || 'Liste des passagers')}</h1>
  <p class="sous">Liste d'embarquement · imprimée le ${quand(new Date().toISOString())}</p>
  <div class="infos">
    <div><b>Trajet :</b> ${echapper(t.lieuDepart)} → ${echapper(t.lieuDestination)}</div>
    <div><b>Départ :</b> ${quand(t.dateHeureDepart)}</div>
    <div><b>Véhicule :</b> ${echapper(t.vehicule || '—')}</div>
    <div><b>Chauffeur :</b> ${echapper(t.chauffeur || '—')}</div>
  </div>
  <table><thead><tr><th>N°</th><th>Passager</th><th>Téléphone</th><th class="c">Places</th><th>Billet</th><th class="r">À encaisser</th><th class="c">Monté</th></tr></thead>
  <tbody>${lignes || '<tr><td colspan="7" class="c">Aucun passager</td></tr>'}</tbody></table>
  <div class="pied"><span>${d.reservations} réservation(s) · ${d.places} place(s) sur ${t.nombrePlacesTotal}</span>
  <span>Total ${echapper(money(d.montantTotal))} · acompte reçu ${echapper(money(d.acompte))}</span></div>
  <script>window.onload = () => { window.print(); };</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  return true;
}

export default function Passagers({ trajet, entreprise, onClose, onChange }) {
  const toast = useToast();
  const [d, setD] = useState(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const champCode = useRef(null);
  const ouvert = trajet && (trajet.statut === 'ACTIF' || trajet.statut === 'COMPLET');

  const charger = async () => {
    try { setD(await apiMonEntreprise.passagers(trajet.id)); }
    catch (e) { toast(e.message, 'error'); onClose(); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (trajet) { setD(null); setCode(''); setMessage(''); charger(); } }, [trajet?.id]);

  if (!trajet) return null;

  const valider = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const p = await apiMonEntreprise.embarquer(trajet.id, { code: code.trim() });
      toast(`✔ ${p.nom} · ${p.places} place(s)${p.resteAPayer > 0 ? ` · reste ${money(p.resteAPayer)} à encaisser` : ''}`, 'success');
      setCode('');
      await charger();
      onChange?.();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); champCode.current?.focus(); }
  };

  const cocher = async (p, embarque) => {
    try {
      await apiMonEntreprise.embarquer(trajet.id, { reservationId: p.reservationId, embarque });
      await charger();
    } catch (e) { toast(e.message, 'error'); }
  };

  const envoyer = async () => {
    setBusy(true);
    try {
      const r = await apiMonEntreprise.messagePassagers(trajet.id, message);
      Audit.log('MESSAGE_PASSAGERS', `${trajet.lieuDepart} → ${trajet.lieuDestination} (${r.passagersPrevenus})`);
      toast(`Message envoyé à ${r.passagersPrevenus} passager(s)`, 'success');
      setMessage('');
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open wide title={`Passagers · ${trajet.lieuDepart} → ${trajet.lieuDestination}`} onClose={onClose}
      footer={<>
        <button className="nd-btn nd-btn-ghost" onClick={onClose}>Fermer</button>
        <button className="nd-btn nd-btn-primary" disabled={!d}
          onClick={() => { if (!imprimer(d, entreprise)) toast("Autorisez les fenêtres surgissantes pour imprimer", 'error'); }}>
          <Printer size={15} /> Imprimer la liste
        </button>
      </>}>
      {!d ? <Spinner center /> : <>
        <div className="ps-resume">
          <div><span>Départ</span><b>{quand(trajet.dateHeureDepart)}</b></div>
          <div><span>Réservations</span><b>{d.reservations}</b></div>
          <div><span>Places</span><b>{d.places} / {trajet.nombrePlacesTotal}</b></div>
          <div><span>Montés</span><b>{d.placesEmbarquees} / {d.places}</b></div>
          <div><span>Acompte reçu</span><b>{money(d.acompte)}</b></div>
          <div><span>À encaisser</span><b>{money(d.montantTotal - d.acompte)}</b></div>
        </div>

        {ouvert && (
          <div className="ps-controle">
            <Ticket size={18} />
            <input ref={champCode} className="nd-input" value={code} placeholder="Code du billet (ex. ND-7K4P ou 7K4P)"
              onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') valider(); }} />
            <button className="nd-btn nd-btn-primary" disabled={busy || !code.trim()} onClick={valider}><CheckCircle2 size={15} /> Valider</button>
          </div>
        )}

        {d.passagers.length === 0 ? <p className="nd-cell-sub">Aucune réservation pour ce départ.</p> : (
          <div className="nd-table-wrap"><table className="nd-table">
            <thead><tr><th>Monté</th><th>Passager</th><th>Téléphone</th><th>Places</th><th>Billet</th><th>À encaisser</th></tr></thead>
            <tbody>{d.passagers.map(p => (
              <tr key={p.reservationId} className={p.embarque ? 'ps-monte' : ''}>
                <td><input type="checkbox" checked={p.embarque} disabled={!ouvert} onChange={e => cocher(p, e.target.checked)}
                  aria-label={`${p.nom} est monté`} /></td>
                <td><b>{p.nom}</b></td>
                <td><a href={`tel:${p.telephone}`}>{p.telephone}</a></td>
                <td>{p.places}</td>
                <td className="ent-mdp">{p.codeBillet}</td>
                <td>{p.resteAPayer > 0 ? <b>{money(p.resteAPayer)}</b> : <span className="nd-badge badge-success">Payé</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}

        {ouvert && d.passagers.length > 0 && (
          <div className="ps-message">
            <label><b>Message aux {d.reservations} passager(s)</b> <small className="nd-cell-sub">— reçu en notification dans l'app Ñu Demm</small></label>
            <textarea className="nd-input" rows={2} maxLength={300} value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Ex. Embarquement au quai 3, 20 min avant le départ." />
            <div className="ps-message-pied">
              <small className="nd-cell-sub">{message.length} / 300</small>
              <button className="nd-btn nd-btn-outline nd-btn-sm" disabled={busy || message.trim().length < 5} onClick={envoyer}><Send size={14} /> Envoyer</button>
            </div>
          </div>
        )}
      </>}
    </Modal>
  );
}
