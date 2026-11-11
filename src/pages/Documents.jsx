import { useEffect, useState } from 'react';
import { apiControle, fmtDT, fmtDate, Audit } from '../services/api';
import { Spinner, Modal } from '../components/ui';
import { useToast } from '../context/AppContext';

const FILTRES = {
  EN_ATTENTE: 'À vérifier',
  VALIDE: 'Validés',
  REFUSE: 'Refusés',
  EXPIRE: 'Expirés',
  TOUS: 'Tous',
};
const STATUTS = {
  EN_ATTENTE: ['badge-warn', 'À vérifier'],
  VALIDE: ['badge-success', 'Validé'],
  REFUSE: ['badge-danger', 'Refusé'],
  EXPIRE: ['badge-secondary', 'Expiré'],
};
const MOTIFS = ['Photo floue ou illisible', 'Document expiré', 'Le nom ne correspond pas au compte', 'Mauvais document envoyé'];

/** Vignette chargée avec le jeton admin (la route de l'image est protégée). */
function Photo({ id, onClick, grand = false }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let u;
    apiControle.fichierDocument(id).then(x => { u = x; setUrl(x); }).catch(() => setErr(true));
    return () => u && URL.revokeObjectURL(u);
  }, [id]);
  if (err) return <div className="dc-photo dc-vide">Image indisponible</div>;
  if (!url) return <div className="dc-photo dc-vide">…</div>;
  return <img src={url} alt="Document" className={grand ? 'dc-grand' : 'dc-photo'} onClick={onClick} />;
}

export default function Documents() {
  const toast = useToast();
  const [filtre, setFiltre] = useState('EN_ATTENTE');
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(null);
  const [refus, setRefus] = useState(null);
  const [motif, setMotif] = useState('');
  const [busy, setBusy] = useState(null);

  const charger = async (f = filtre) => {
    setLoading(true);
    try { setDocs(await apiControle.documents(f) || []); }
    catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(filtre); }, [filtre]);

  const valider = async d => {
    setBusy(d.id);
    try {
      await apiControle.validerDocument(d.id);
      Audit.log('DOCUMENT_VALIDE', `${d.libelle} — ${d.chauffeurNom}`);
      toast(`${d.libelle} de ${d.chauffeurNom} validé — chauffeur prévenu`, 'success');
      setZoom(null);
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  const refuser = async () => {
    const d = refus;
    setBusy(d.id);
    try {
      await apiControle.refuserDocument(d.id, motif);
      Audit.log('DOCUMENT_REFUSE', `${d.libelle} — ${d.chauffeurNom} : ${motif}`);
      toast('Document refusé — le chauffeur a reçu le motif', 'success');
      setRefus(null); setZoom(null); setMotif('');
      await charger();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left">
          <h1>Documents chauffeurs</h1>
          <p>Permis, carte grise, assurance envoyés depuis l'app chauffeur. Le chauffeur est notifié à chaque décision et 15 jours avant l'expiration.</p>
        </div>
        <button className="nd-btn nd-btn-ghost" onClick={() => charger()}>↻ Actualiser</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(FILTRES).map(([k, l]) => (
          <button key={k} className={`nd-btn nd-btn-sm ${filtre === k ? 'nd-btn-primary' : 'nd-btn-outline'}`} onClick={() => setFiltre(k)}>{l}</button>
        ))}
      </div>

      {loading ? <Spinner center /> : docs.length === 0 ? (
        <div className="nd-card"><div className="nd-card-body" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40 }}>{filtre === 'EN_ATTENTE' ? '✅' : '📭'}</div>
          <p className="nd-cell-sub">{filtre === 'EN_ATTENTE' ? 'Aucun document à vérifier' : 'Aucun document'}</p>
        </div></div>
      ) : (
        <div className="dc-grid">
          {docs.map(d => {
            const [cls, label] = STATUTS[d.statut] || ['badge-secondary', d.statut];
            return (
              <div key={d.id} className="nd-card dc-card">
                <Photo id={d.id} onClick={() => setZoom(d)} />
                <div className="nd-card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <b>{d.libelle}</b><span className={`nd-badge ${cls}`}>{label}</span>
                  </div>
                  <div style={{ marginTop: 6 }}>👤 {d.chauffeurNom} <span className="nd-cell-sub">{d.chauffeurTelephone}</span></div>
                  <small className="nd-cell-sub" style={{ display: 'block' }}>Envoyé le {fmtDT(d.envoyeLe)}</small>
                  <small className="nd-cell-sub" style={{ display: 'block' }}>
                    {d.dateExpiration ? `Expire le ${fmtDate(d.dateExpiration)}` : "Pas de date d'expiration"}
                  </small>
                  {d.motifRefus && <small style={{ display: 'block', color: 'var(--nd-red)' }}>Motif : {d.motifRefus}</small>}
                  {d.statut === 'EN_ATTENTE' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button className="nd-btn nd-btn-primary nd-btn-sm" disabled={busy === d.id} onClick={() => valider(d)}>✔ Valider</button>
                      <button className="nd-btn nd-btn-outline nd-btn-sm" disabled={busy === d.id} onClick={() => { setRefus(d); setMotif(MOTIFS[0]); }}>✖ Refuser</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!zoom} wide title={zoom ? `${zoom.libelle} — ${zoom.chauffeurNom}` : ''} onClose={() => setZoom(null)}
        footer={zoom?.statut === 'EN_ATTENTE' && (
          <>
            <button className="nd-btn nd-btn-outline" onClick={() => { setRefus(zoom); setMotif(MOTIFS[0]); }}>✖ Refuser</button>
            <button className="nd-btn nd-btn-primary" disabled={busy === zoom?.id} onClick={() => valider(zoom)}>✔ Valider</button>
          </>
        )}>
        {zoom && <Photo id={zoom.id} grand />}
      </Modal>

      <Modal open={!!refus} title="Refuser le document" onClose={() => setRefus(null)}
        footer={<>
          <button className="nd-btn nd-btn-ghost" onClick={() => setRefus(null)}>Annuler</button>
          <button className="nd-btn nd-btn-danger" disabled={!motif.trim() || busy === refus?.id} onClick={refuser}>Refuser et prévenir le chauffeur</button>
        </>}>
        <p className="nd-cell-sub">Le chauffeur recevra ce motif par notification et pourra renvoyer une photo.</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
          {MOTIFS.map(m => (
            <button key={m} className={`nd-btn nd-btn-sm ${motif === m ? 'nd-btn-primary' : 'nd-btn-outline'}`} onClick={() => setMotif(m)}>{m}</button>
          ))}
        </div>
        <textarea className="nd-input" rows={3} value={motif} onChange={e => setMotif(e.target.value)} />
      </Modal>
    </div>
  );
}
