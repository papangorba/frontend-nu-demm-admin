import { useEffect, useState } from 'react';
import { Send, XCircle, Phone, RefreshCw } from 'lucide-react';
import { apiFinances, Audit, Auth, fmtDT } from '../services/api';
import { useToast } from '../context/AppContext';

const fcfa = n => `${Number(n || 0).toLocaleString('fr-FR')} F`;
const joli = t => (t || '').replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');
const MOYENS = { WAVE: 'Wave', ORANGE_MONEY: 'Orange Money' };

/**
 * Retraits demandés par les chauffeurs depuis leur solde Ñu Demm (comme Yango) : l'argent des courses payées en
 * ligne y est crédité, le chauffeur le retire quand il veut. L'équipe l'envoie sur Wave / Orange Money, puis saisit
 * la référence de l'envoi. Refuser rend le montant au chauffeur.
 */
export default function RetraitsChauffeurs() {
  const toast = useToast();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(null);
  const habilite = Auth.argent() && !Auth.lectureSeule();

  const charger = async () => {
    try { setD(await apiFinances.retraits()); } catch (e) { toast(e.message, 'error'); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);
  if (!d) return null;

  const payer = async r => {
    const ref = window.prompt(`Envoyez ${fcfa(r.montant)} par ${MOYENS[r.moyen]} au ${joli(r.telephone)} (${r.nom || 'chauffeur'}), puis saisissez la référence de l'envoi :`, '');
    if (ref === null) return;
    setBusy(r.id);
    try {
      await apiFinances.payerRetrait(r.id, ref);
      Audit.log('RETRAIT_PAYE', `#${r.id} ${fcfa(r.montant)} ${MOYENS[r.moyen]} ${r.telephone} réf. ${ref}`);
      toast('Retrait marqué envoyé : le chauffeur est prévenu', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  const refuser = async r => {
    const motif = window.prompt('Motif du refus (le montant revient sur le solde du chauffeur) :', '');
    if (motif === null) return;
    setBusy(r.id);
    try {
      await apiFinances.refuserRetrait(r.id, motif);
      Audit.log('RETRAIT_REFUSE', `#${r.id} ${fcfa(r.montant)} : ${motif}`);
      toast('Retrait refusé, montant rendu', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  const enAttente = d.enAttente || [];
  return (
    <div className="nd-card" style={{ marginBottom: 16 }}>
      <div className="nd-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h3><Send size={16} /> Retraits à envoyer ({enAttente.length})</h3>
        <button className="nd-btn nd-btn-ghost nd-btn-sm" onClick={charger}><RefreshCw size={14} /></button>
      </div>
      {enAttente.length === 0 ? (
        <div className="nd-card-body nd-cell-sub">Aucun retrait en attente. Les chauffeurs retirent depuis Mon solde l'argent des courses payées en ligne.</div>
      ) : (
        <div className="nd-table-wrap"><table className="nd-table">
          <thead><tr><th>Chauffeur</th><th>Montant</th><th>Envoyer sur</th><th>Demandé</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {enAttente.map(r => (
              <tr key={r.id}>
                <td><b>{r.nom || `#${r.chauffeurId}`}</b><div className="nd-cell-sub"><Phone size={11} /> {joli(r.telephoneCompte)}</div></td>
                <td><b>{fcfa(r.montant)}</b><div className="nd-cell-sub">solde après : {fcfa(r.soldeActuel)}</div></td>
                <td>{MOYENS[r.moyen]}<div className="nd-cell-sub" style={{ fontFamily: 'monospace' }}>{joli(r.telephone)}</div></td>
                <td className="nd-cell-sub">{fmtDT(r.creeLe)}{r.statut === 'EN_COURS' && <div><span className="badge badge-info">Envoi PayTech en cours</span></div>}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {habilite && <>
                    <button className="nd-btn nd-btn-primary nd-btn-sm" disabled={busy === r.id} onClick={() => payer(r)}><Send size={14} /> Envoyé</button>{' '}
                    <button className="nd-btn nd-btn-outline nd-btn-sm" disabled={busy === r.id} onClick={() => refuser(r)}><XCircle size={14} /> Refuser</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      {(d.recents || []).length > 0 && (
        <details style={{ padding: '0 16px 12px' }}>
          <summary className="nd-cell-sub" style={{ cursor: 'pointer' }}>Derniers retraits traités ({d.recents.length})</summary>
          {d.recents.map(r => (
            <div key={r.id} className="nd-cell-sub" style={{ marginTop: 4 }}>
              {fmtDT(r.traiteLe)} · {r.nom} · {fcfa(r.montant)} {MOYENS[r.moyen]} · {r.statut === 'PAYE' ? `envoyé, réf. ${r.referenceEnvoi}` : `refusé : ${r.motifRefus}`}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
