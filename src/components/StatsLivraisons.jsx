import { useEffect, useState } from 'react';
import { apiLivraisons } from '../services/api';
import { Spinner } from './ui';

const PERIODES = [[7, '7 jours'], [30, '30 jours'], [90, '3 mois']];
const SERVICES = {
  LIVRAISON: { nom: '📦 Livraison (moto)', couleur: '#F79009' },
  CARGO: { nom: '🚚 Cargo (3 roues, fourgonnette, camion)', couleur: '#1570EF' },
};
const VEHICULES = { MOTO: 'Moto', TROIS_ROUES: '3 roues', FOURGONNETTE: 'Fourgonnette', CAMION: 'Camion' };

const nb = v => (v == null ? '—' : Number(v).toLocaleString('fr-FR'));
const min = v => (v == null ? '—' : v < 60 ? `${v} min` : `${Math.floor(v / 60)} h ${String(Math.round(v % 60)).padStart(2, '0')}`);

/**
 * Tableau de bord Livraison / Cargo : délais, part sans livreur, chiffre d'affaires,
 * régions et zones où il manque des livreurs ou des véhicules cargo.
 */
export default function StatsLivraisons() {
  const [jours, setJours] = useState(30);
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setS(null); setErr('');
    apiLivraisons.stats(jours).then(setS).catch(e => setErr(e.message));
  }, [jours]);

  return (
    <div className="nd-card" style={{ marginBottom: 20 }}>
      <div className="nd-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className="nd-card-title">📊 Tableau de bord Livraison / Cargo</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIODES.map(([j, l]) => (
            <button key={j} className={`nd-btn nd-btn-sm ${jours === j ? 'nd-btn-primary' : 'nd-btn-outline'}`} onClick={() => setJours(j)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="nd-card-body">
        {err ? <div className="nd-alert nd-alert-danger">{err}</div> : !s ? <Spinner center /> : <>
          <div className="sl-grille">
            {Object.entries(SERVICES).map(([k, info]) => {
              const v = s.services?.[k] || {};
              return (
                <div key={k} className="sl-service" style={{ borderTopColor: info.couleur }}>
                  <b style={{ color: info.couleur }}>{info.nom}</b>
                  <div className="sl-chiffres">
                    <div><span>{nb(v.demandes)}</span>demandes</div>
                    <div><span>{v.tauxReussite == null ? '—' : `${v.tauxReussite} %`}</span>livrées</div>
                    <div className={v.tauxSansLivreur >= 30 ? 'sl-alerte' : ''}><span>{v.tauxSansLivreur == null ? '—' : `${v.tauxSansLivreur} %`}</span>sans livreur</div>
                    <div><span>{min(v.delaiPriseEnChargeMin)}</span>prise en charge</div>
                    <div><span>{min(v.dureeLivraisonMin)}</span>durée de livraison</div>
                    <div><span>{nb(v.panierMoyen)} F</span>panier moyen</div>
                    <div><span>{nb(v.chiffreAffaires)} F</span>chiffre d'affaires</div>
                    <div><span>{nb(v.annulees)}</span>annulées</div>
                  </div>
                  <small className="nd-cell-sub">
                    {nb(v.programmees)} programmée(s) · {nb(v.tournees)} tournée(s) · {nb(v.avecAide)} avec manutention
                  </small>
                </div>
              );
            })}
          </div>

          {s.aRenforcer?.length > 0 && (
            <div className="nd-alert nd-alert-warn" style={{ marginTop: 14, display: 'block' }}>
              <b>⚠ Zones à renforcer</b>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {s.aRenforcer.map((z, i) => (
                  <li key={i}><b>{z.region}</b> — {z.service === 'CARGO' ? 'Cargo' : 'Livraison'} : {z.raison} ({z.demandes} demande(s))</li>
                ))}
              </ul>
            </div>
          )}

          <div className="nd-table-wrap" style={{ marginTop: 14 }}>
            <table className="nd-table">
              <thead><tr>
                <th>Région</th><th>Livraisons</th><th>Sans livreur</th><th>Livreurs moto (en ligne)</th>
                <th>Cargo</th><th>Sans véhicule</th><th>Véhicules cargo (en ligne)</th>
              </tr></thead>
              <tbody>
                {(s.regions || []).map(r => (
                  <tr key={r.code}>
                    <td><b>{r.nom}</b></td>
                    <td>{r.demandesLivraison}</td>
                    <td style={{ color: r.sansLivreurLivraison ? '#d92d20' : undefined }}>{r.sansLivreurLivraison}</td>
                    <td>{r.livreursMoto} <small className="nd-cell-sub">({r.livreursMotoEnLigne})</small></td>
                    <td>{r.demandesCargo}</td>
                    <td style={{ color: r.sansLivreurCargo ? '#d92d20' : undefined }}>{r.sansLivreurCargo}</td>
                    <td>{r.vehiculesCargo} <small className="nd-cell-sub">({r.vehiculesCargoEnLigne})</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small className="nd-cell-sub" style={{ display: 'block', marginTop: 8 }}>
            Par véhicule demandé : {Object.entries(s.parVehicule || {}).map(([k, v]) => `${VEHICULES[k] || k} ${v}`).join(' · ') || '—'}
          </small>
        </>}
      </div>
    </div>
  );
}
