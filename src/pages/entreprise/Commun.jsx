import { useState } from 'react';
import { money } from '../../services/api';

/**
 * Éléments partagés par l'espace entreprise et la fiche admin (« modules en commun »).
 */

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const libelleMois = cle => { // « 2026-11 » → « nov. 2026 »
  const [a, m] = String(cle).split('-');
  return `${MOIS[Number(m) - 1] || m} ${a}`;
};

/** Tuile chiffre clé : libellé, valeur, précision. */
export function Tuile({ label, value, sub, ton }) {
  return (
    <div className={`ee-tuile${ton ? ` ee-tuile-${ton}` : ''}`}>
      <div className="ee-tuile-label">{label}</div>
      <div className="ee-tuile-valeur">{value ?? '—'}</div>
      {sub && <div className="ee-tuile-sub">{sub}</div>}
    </div>
  );
}

/**
 * Recettes des 6 derniers mois — une seule série (pas de légende : le titre la nomme).
 * Barres ≤ 24 px, bout arrondi, base droite ; survol = info-bulle ; seule la
 * dernière valeur est écrite ; tableau disponible pour lire tous les chiffres.
 */
export function GraphiqueRecettes({ donnees = [] }) {
  const [survol, setSurvol] = useState(null);
  const max = Math.max(1, ...donnees.map(d => Number(d.montant) || 0));
  const dernier = donnees.length - 1;
  return (
    <div className="ee-graph">
      <div className="ee-graph-zone" role="img"
        aria-label={`Recettes des 6 derniers mois : ${donnees.map(d => `${libelleMois(d.mois)} ${money(d.montant)}`).join(', ')}`}>
        {donnees.map((d, i) => {
          const h = Math.round(((Number(d.montant) || 0) / max) * 100);
          return (
            <div key={d.mois} className="ee-graph-col"
              onMouseEnter={() => setSurvol(i)} onMouseLeave={() => setSurvol(null)}
              onFocus={() => setSurvol(i)} onBlur={() => setSurvol(null)} tabIndex={0}>
              {/* Étiquette et info-bulle accrochées au sommet de la barre (jamais par-dessus) */}
              <div className="ee-graph-barre" style={{ height: `${Math.max(h, Number(d.montant) > 0 ? 2 : 0)}%` }}>
                {survol === i && (
                  <div className="ee-graph-bulle"><b>{money(d.montant)}</b><span>{libelleMois(d.mois)}</span></div>
                )}
                {i === dernier && survol !== i && Number(d.montant) > 0 && (
                  <div className="ee-graph-etiquette">{money(d.montant)}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="ee-graph-axe">
        {donnees.map(d => <span key={d.mois}>{libelleMois(d.mois).split(' ')[0]}</span>)}
      </div>
      <details className="ee-graph-table">
        <summary>Voir le tableau</summary>
        <table className="nd-table">
          <thead><tr><th>Mois</th><th>Recette</th></tr></thead>
          <tbody>{donnees.map(d => <tr key={d.mois}><td>{libelleMois(d.mois)}</td><td>{money(d.montant)}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}

// Bus et minibus → rubrique « Bus » de l'app client ; voiture 7 places → rubrique « Allô Sénégal »
export const TYPES_VEHICULE = { BUS: 'Bus', MINIBUS: 'Minibus (Ndiaga Ndiaye…)', VOITURE: 'Voiture 7 places (Allô Sénégal)' };
export const ETATS_VEHICULE = {
  EN_SERVICE: ['badge-success', 'En service'],
  EN_MAINTENANCE: ['badge-warn', 'En maintenance'],
  HORS_SERVICE: ['badge-danger', 'Hors service'],
};

export function EtatVehicule({ etat }) {
  const [cls, label] = ETATS_VEHICULE[etat] || ['badge-secondary', etat || '—'];
  return <span className={`nd-badge ${cls}`}>{label}</span>;
}
