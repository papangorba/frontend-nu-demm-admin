import { useEffect, useState } from 'react';
import { Fingerprint, RefreshCw, CheckCircle2, XCircle, RotateCcw, Phone } from 'lucide-react';
import { apiIdentite, Audit, Auth, fmtDT } from '../services/api';
import { Spinner } from '../components/ui';
import { useToast } from '../context/AppContext';

/**
 * Contrôle d'identité des chauffeurs. Chaque permis, plaque, numéro de pièce, photo de document et téléphone laisse
 * une empreinte (jamais la valeur elle-même) gardée même après la suppression d'un compte. Quand un autre compte
 * chauffeur présente la même, une alerte apparaît ici : même personne revenue avec un autre numéro, pièce prêtée,
 * photo réutilisée, voiture partagée…
 */

const ETATS = {
  ACTIF:    ['badge-success',   'Actif'],
  SUSPENDU: ['badge-warn',      'Suspendu'],
  SUPPRIME: ['badge-danger',    'Supprimé'],
};
const STATUTS = {
  OUVERTE:       ['badge-warn',      'À vérifier'],
  TRAITEE:       ['badge-success',   'Traitée'],
  FAUSSE_ALERTE: ['badge-secondary', 'Fausse alerte'],
};
const joli = t => (t || '').replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');

function Compte({ c }) {
  if (!c) return null;
  const [cls, label] = ETATS[c.etat] || ['badge-secondary', c.etat];
  return (
    <div>
      <b>{c.nom || `Compte #${c.id}`}</b> <span className={`nd-badge ${cls}`}>{label}</span>
      <div className="nd-cell-sub">#{c.id}{c.inscritLe ? ` · inscrit le ${fmtDT(c.inscritLe)}` : ''}</div>
      {c.telephone && <a href={`tel:+221${c.telephone}`} className="nd-cell-sub" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
        <Phone size={12} />{joli(c.telephone)}</a>}
    </div>
  );
}

export default function Identite() {
  const toast = useToast();
  const [alertes, setAlertes] = useState(null);
  const [filtre, setFiltre] = useState('OUVERTE');
  const [busy, setBusy] = useState(null);
  const lecture = Auth.lectureSeule();

  const charger = async (f = filtre) => {
    setAlertes(null);
    try { setAlertes(await apiIdentite.alertes(f) || []); }
    catch (e) { toast(e.message, 'error'); setAlertes([]); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(filtre); }, [filtre]);

  const traiter = async (a, statut) => {
    const question = statut === 'TRAITEE'
      ? 'Qu\'avez-vous vérifié et décidé ? (ex. « même personne : nouveau compte suspendu », « frères, voiture partagée de jour / de nuit »)'
      : statut === 'FAUSSE_ALERTE' ? 'Pourquoi est-ce une fausse alerte ?' : null;
    let note = null;
    if (question) {
      note = window.prompt(question, '');
      if (note === null) return;
      if (note.trim().length < 5) { toast('Écrivez au moins quelques mots (5 caractères)', 'error'); return; }
    }
    setBusy(a.id);
    try {
      await apiIdentite.traiter(a.id, statut, note);
      Audit.log('IDENTITE_ALERTE', `Alerte #${a.id} (${a.libelle}) → ${statut}${note ? ' : ' + note : ''}`);
      toast('Alerte mise à jour', 'success');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Contrôle d'identité</h1>
          <p>Un chauffeur qui revient avec un autre numéro est reconnu par son permis, sa plaque, le numéro de sa pièce,
            la photo de ses documents ou son téléphone. Seule une empreinte est gardée (jamais la pièce elle-même),
            même après la suppression du compte. <b>Rouge</b> : l'autre compte est suspendu ou supprimé, ou la photo est identique.</p>
        </div>
        <button className="nd-btn nd-btn-ghost" onClick={() => charger()}><RefreshCw size={15} /> Actualiser</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['OUVERTE', 'À vérifier'], ['TRAITEE', 'Traitées'], ['FAUSSE_ALERTE', 'Fausses alertes'], ['TOUTES', 'Toutes']].map(([k, l]) => (
          <button key={k} className={`nd-btn nd-btn-sm ${filtre === k ? 'nd-btn-primary' : 'nd-btn-outline'}`} onClick={() => setFiltre(k)}>{l}</button>
        ))}
      </div>

      {alertes === null ? <Spinner center /> : alertes.length === 0 ? (
        <div className="nd-card"><div className="nd-card-body" style={{ textAlign: 'center', padding: 40 }}>
          <CheckCircle2 size={40} color="var(--nd-green)" />
          <p className="nd-cell-sub">{filtre === 'OUVERTE' ? 'Aucune alerte à vérifier' : 'Aucune alerte'}</p>
        </div></div>
      ) : (
        <div className="nd-card"><div className="nd-table-wrap">
          <table className="nd-table">
            <thead><tr>
              <th>Alerte</th><th>Nouveau compte</th><th>Compte déjà connu</th><th>Statut</th><th style={{ textAlign: 'right' }}>Actions</th>
            </tr></thead>
            <tbody>
              {alertes.map(a => {
                const [cls, label] = STATUTS[a.statut] || ['badge-secondary', a.statut];
                return (
                  <tr key={a.id}>
                    <td style={{ maxWidth: 280 }}>
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontWeight: 700,
                        color: a.gravite === 'HAUTE' ? 'var(--nd-red)' : 'var(--nd-orange)' }}>
                        <Fingerprint size={15} /> {a.libelle}
                      </span>
                      <div className="nd-cell-sub">{fmtDT(a.creeLe)} · {a.gravite === 'HAUTE' ? 'gravité haute' : 'à vérifier'}</div>
                      <div className="nd-cell-sub">{a.explication}</div>
                    </td>
                    <td><Compte c={a.compte} /></td>
                    <td><Compte c={a.autreCompte} /></td>
                    <td><span className={`nd-badge ${cls}`}>{label}</span>
                      {a.note && <div className="nd-cell-sub">{a.note}</div>}
                      {a.traitePar && <div className="nd-cell-sub">par {a.traitePar}</div>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {!lecture && (a.statut === 'OUVERTE' ? <>
                        <button className="nd-btn nd-btn-primary nd-btn-sm" disabled={busy === a.id} onClick={() => traiter(a, 'TRAITEE')}>
                          <CheckCircle2 size={14} /> Traiter
                        </button>{' '}
                        <button className="nd-btn nd-btn-outline nd-btn-sm" disabled={busy === a.id} onClick={() => traiter(a, 'FAUSSE_ALERTE')}>
                          <XCircle size={14} /> Fausse alerte
                        </button>
                      </> : (
                        <button className="nd-btn nd-btn-ghost nd-btn-sm" disabled={busy === a.id} onClick={() => traiter(a, 'OUVERTE')}>
                          <RotateCcw size={14} /> Rouvrir
                        </button>
                      ))}
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
