import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { apiMonEntreprise, fmtDate, fmtDT, money, mediaUrl } from '../services/api';
import { Spinner } from '../components/ui';
import { Tuile, GraphiqueRecettes } from './entreprise/Commun';

/**
 * Tableau de bord du gérant d'une entreprise de transport (SaaS, partie 3c).
 * Il ne voit que SON entreprise : le serveur la déduit de son compte.
 */
export default function MonEntreprise() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  const charger = () => apiMonEntreprise.tableauDeBord().then(x => { setD(x); setErr(''); }).catch(x => setErr(x.message));
  useEffect(() => { charger(); }, []);

  if (err) return <div className="nd-card"><div className="nd-card-body">{err}</div></div>;
  if (!d) return <Spinner center />;
  const e = d.entreprise;
  const evolution = d.recetteMoisPrecedent > 0
    ? Math.round(((d.recetteMois - d.recetteMoisPrecedent) / d.recetteMoisPrecedent) * 100) : null;

  return (
    <div className="fade-in">
      <div className="nd-page-header">
        <div className="nd-page-header-left ee-titre">
          {e.logoUrl && <img className="ee-logo-petit" src={mediaUrl(e.logoUrl)} alt="" />}
          <div>
            <h1>{e.nom}</h1>
            <p>Formule {e.formuleNom} · abonnement jusqu'au {fmtDate(e.abonnementJusquau)}</p>
          </div>
        </div>
        <button className="nd-btn nd-btn-ghost" onClick={charger}><RefreshCw size={15} /> Actualiser</button>
      </div>

      {/* Suggestion 7 : rappel avant la fin de l'abonnement */}
      {!e.abonnementValide ? (
        <div className="ent-alerte ent-alerte-forte"><AlertTriangle size={18} />
          Votre abonnement est terminé depuis le {fmtDate(e.abonnementJusquau)}. Vos trajets ne sont plus proposés aux clients
          et vous ne pouvez plus modifier votre flotte : contactez l'équipe Ñu Demm pour le renouveler.
        </div>
      ) : e.aRenouveler ? (
        <div className="ent-alerte"><AlertTriangle size={18} />
          Votre abonnement se termine dans {e.joursRestants} jour(s), le {fmtDate(e.abonnementJusquau)}. Pensez à le renouveler auprès de l'équipe Ñu Demm.
        </div>
      ) : null}

      <div className="ee-tuiles">
        <Tuile label="Recette du mois" value={money(d.recetteMois)}
          sub={evolution === null ? `Mois précédent : ${money(d.recetteMoisPrecedent)}`
            : `${evolution >= 0 ? '+' : ''}${evolution} % par rapport au mois précédent`} />
        <Tuile label="Réservations du mois" value={d.reservationsMois} sub="confirmées ou effectuées" />
        <Tuile label="Véhicules en service" value={`${d.vehiculesEnService} / ${d.vehicules}`}
          sub={`${d.placesTotales} places au total${e.maxVehicules ? ` · ${e.maxVehicules} véhicules max` : ''}`} />
        <Tuile label="Chauffeurs" value={d.chauffeurs} />
        <Tuile label="Trajets à venir" value={d.trajetsAVenir} sub={<Link to="/mon-entreprise/trajets">Voir mes trajets</Link>} />
      </div>

      <div className="nd-grid-2" style={{ marginTop: 16 }}>
        <div className="nd-card"><div className="nd-card-body">
          <h3 className="ee-h3">Recettes des 6 derniers mois</h3>
          <GraphiqueRecettes donnees={d.recettesParMois} />
        </div></div>
        <div className="nd-card"><div className="nd-card-body">
          <h3 className="ee-h3">Recettes par trajet ce mois-ci</h3>
          {d.recettesParTrajet.length === 0 ? (
            <p className="nd-cell-sub">Aucune réservation ce mois-ci. Vos trajets apparaîtront ici dès les premières réservations.</p>
          ) : (
            <div className="nd-table-wrap"><table className="nd-table">
              <thead><tr><th>Trajet</th><th>Départ</th><th>Places</th><th>Recette</th></tr></thead>
              <tbody>{d.recettesParTrajet.map(t => (
                <tr key={t.trajetId}>
                  <td><b>{t.libelle}</b></td>
                  <td><small>{fmtDT(t.depart)}</small></td>
                  <td>{t.places}</td>
                  <td><b>{money(t.montant)}</b></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div></div>
      </div>

      {d.vehicules === 0 && (
        <div className="nd-card" style={{ marginTop: 16 }}><div className="nd-card-body">
          <b>Pour bien démarrer</b>
          <ol className="ee-etapes">
            <li><Link to="/mon-entreprise/vehicules">Ajoutez vos bus, minibus ou voitures</Link> avec leur nombre de places.</li>
            <li><Link to="/mon-entreprise/chauffeurs">Enregistrez vos chauffeurs</Link> pour les affecter à vos trajets.</li>
            <li><Link to="/mon-entreprise/trajets">Créez vos trajets</Link> : ils sont proposés aux clients de l'app Ñu Demm, qui réservent leurs places.</li>
            <li><Link to="/mon-entreprise/profil">Ajoutez votre logo</Link> : il sera affiché aux clients à côté de vos trajets.</li>
          </ol>
        </div></div>
      )}
    </div>
  );
}
