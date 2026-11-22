import { useEffect, useState } from 'react';
import { Package, Phone, RefreshCw, XCircle, CheckCircle2, MessageSquare } from 'lucide-react';
import { apiEnvoisColis, Audit, fmtDT } from '../services/api';
import { Spinner } from '../components/ui';
import { useToast } from '../context/AppContext';

/**
 * Allô Sénégal → « Envoi de colis » : colis confiés aux particuliers qui font un trajet interurbain.
 * Demandé → accepté ou refusé par le chauffeur → remis contre le code de retrait du destinataire.
 * Le code n'apparaît jamais ici (seuls l'expéditeur et le destinataire le connaissent).
 */

const STATUTS = {
  EN_ATTENTE: ['badge-warn', 'En attente du chauffeur'],
  ACCEPTE:    ['badge-info', 'Accepté'],
  REMIS:      ['badge-success', 'Remis'],
  REFUSE:     ['badge-danger', 'Refusé'],
  ANNULE:     ['badge-secondary', 'Annulé'],
};
const TAILLES = { PETIT: 'Petit', MOYEN: 'Moyen', GRAND: 'Grand' };
const FILTRES = [
  ['EN_COURS', 'En cours', e => e.statut === 'EN_ATTENTE' || e.statut === 'ACCEPTE'],
  ['REMIS', 'Remis', e => e.statut === 'REMIS'],
  ['ARRETES', 'Refusés / annulés', e => e.statut === 'REFUSE' || e.statut === 'ANNULE'],
  ['TOUS', 'Tous', () => true],
];

const joli = t => (t || '').replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');
const fcfa = n => `${Number(n || 0).toLocaleString('fr-FR')} F`;

function Tel({ numero }) {
  if (!numero) return null;
  return (
    <a href={`tel:+221${numero}`} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <Phone size={12} />{joli(numero)}
    </a>
  );
}

export default function EnvoisColis() {
  const toast = useToast();
  const [envois, setEnvois] = useState(null);
  const [filtre, setFiltre] = useState('EN_COURS');
  const [recherche, setRecherche] = useState('');
  const [busy, setBusy] = useState(null);

  const charger = async () => {
    try { setEnvois(await apiEnvoisColis.liste() || []); }
    catch (e) { toast(e.message, 'error'); setEnvois(x => x || []); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const annuler = async e => {
    const motif = window.prompt(`Annuler l'envoi #${e.id} (${e.description}) ?\nL'expéditeur et le chauffeur seront prévenus. Motif :`, 'Litige signalé');
    if (motif === null) return;
    setBusy(e.id);
    try {
      await apiEnvoisColis.annuler(e.id, motif);
      Audit.log('COLIS_ANNULE', `Envoi #${e.id} — ${e.description}`);
      toast('Envoi annulé : expéditeur et chauffeur prévenus', 'success');
      await charger();
    } catch (err) { toast(err.message, 'error'); }
    finally { setBusy(null); }
  };

  const tous = envois || [];
  const compte = k => tous.filter(FILTRES.find(f => f[0] === k)[2]).length;
  const q = recherche.trim().toLowerCase();
  const liste = tous
    .filter(FILTRES.find(f => f[0] === filtre)[2])
    .filter(e => !q || [e.description, e.lieuDepart, e.lieuDestination, e.nomChauffeur, e.expediteurNom, e.nomDestinataire,
      e.expediteurTelephone, e.telephoneDestinataire, e.telephoneChauffeur, `#${e.id}`]
      .some(v => (v || '').toString().toLowerCase().includes(q)));
  const montantRemis = tous.filter(e => e.statut === 'REMIS').reduce((s, e) => s + (e.prix || 0), 0);

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Envois de colis</h1>
          <p>Allô Sénégal : colis confiés aux particuliers qui font un trajet interurbain. Le chauffeur accepte ou refuse,
            puis remet le colis contre le code de retrait que l'expéditeur a donné au destinataire (aussi envoyé par SMS).</p>
        </div>
        <button className="nd-btn nd-btn-ghost" onClick={charger}><RefreshCw size={15} /> Actualiser</button>
      </div>

      <div className="nd-stat-grid">
        {[['En cours', compte('EN_COURS')], ['Remis', compte('REMIS')], ['Refusés / annulés', compte('ARRETES')], ['Montant des colis remis', fcfa(montantRemis)]]
          .map(([l, v]) => (
            <div key={l} className="nd-card"><div className="nd-card-body">
              <div className="nd-cell-sub">{l}</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{v}</div>
            </div></div>
          ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTRES.map(([k, l]) => (
          <button key={k} className={`nd-btn nd-btn-sm ${filtre === k ? 'nd-btn-primary' : 'nd-btn-outline'}`} onClick={() => setFiltre(k)}>
            {l}{k !== 'TOUS' && compte(k) ? ` (${compte(k)})` : ''}
          </button>
        ))}
        <input className="nd-input" style={{ maxWidth: 280, marginLeft: 'auto' }} placeholder="Rechercher (ville, nom, numéro…)"
          value={recherche} onChange={e => setRecherche(e.target.value)} />
      </div>

      {envois === null ? <Spinner center /> : liste.length === 0 ? (
        <div className="nd-card"><div className="nd-card-body" style={{ textAlign: 'center', padding: 40 }}>
          <CheckCircle2 size={40} color="var(--nd-green)" />
          <p className="nd-cell-sub">{q ? 'Aucun envoi ne correspond à la recherche' : 'Aucun envoi dans cette rubrique'}</p>
        </div></div>
      ) : (
        <div className="nd-card"><div className="nd-table-wrap">
          <table className="nd-table">
            <thead><tr>
              <th>Envoi</th><th>Trajet</th><th>Expéditeur</th><th>Destinataire</th><th>Statut</th><th style={{ textAlign: 'right' }}>Actions</th>
            </tr></thead>
            <tbody>
              {liste.map(e => {
                const [cls, label] = STATUTS[e.statut] || ['badge-secondary', e.statut];
                return (
                  <tr key={e.id}>
                    <td style={{ maxWidth: 240 }}>
                      <b><Package size={13} /> #{e.id}</b> {e.description}
                      <div className="nd-cell-sub">{[TAILLES[e.taille] || e.taille, e.poidsKg ? `${e.poidsKg} kg` : null, fcfa(e.prix)].filter(Boolean).join(' · ')}</div>
                      <div className="nd-cell-sub">Demandé le {fmtDT(e.creeLe)}</div>
                    </td>
                    <td>
                      <b>{e.lieuDepart} → {e.lieuDestination}</b>
                      <div className="nd-cell-sub">{fmtDT(e.dateHeureDepart)}</div>
                      <div className="nd-cell-sub">{e.nomChauffeur} <Tel numero={e.telephoneChauffeur} /></div>
                    </td>
                    <td>{e.expediteurNom}<div className="nd-cell-sub"><Tel numero={e.expediteurTelephone} /></div></td>
                    <td>
                      {e.nomDestinataire}<div className="nd-cell-sub"><Tel numero={e.telephoneDestinataire} /></div>
                      {e.smsDestinataireLe && <div className="nd-cell-sub" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <MessageSquare size={12} /> Code envoyé par SMS le {fmtDT(e.smsDestinataireLe)}</div>}
                    </td>
                    <td>
                      <span className={`nd-badge ${cls}`}>{label}</span>
                      {e.remisLe && <div className="nd-cell-sub">{fmtDT(e.remisLe)}</div>}
                      {e.motifRefus && <div className="nd-cell-sub">{e.motifRefus}</div>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {(e.statut === 'EN_ATTENTE' || e.statut === 'ACCEPTE') && (
                        <button className="nd-btn nd-btn-outline nd-btn-sm" disabled={busy === e.id} onClick={() => annuler(e)}>
                          <XCircle size={14} /> Annuler
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div></div>
      )}
    </div>
  );
}
