/**
 * Éclairs de la page de connexion, posés sur la barre du haut et l'en-tête du menu
 * (comme dans les apps mobiles). Purement décoratif : ne bloque aucun clic,
 * coupé si l'ordinateur demande moins d'animations.
 * Trois éclairs à des endroits différents, chacun à son rythme : jamais deux flashs identiques à la suite.
 */
const ECLAIRS = [
  { d: 'M40 -4 L34 20 L44 23 L26 52 L37 55 L18 86 L27 62 L17 60 L30 34 L21 31 Z', x: '18%', duree: '7.3s', retard: '0s' },
  { d: 'M40 -4 L33 22 L42 25 L28 48 L36 50 L22 76 L29 56 L21 54 L31 32 L24 30 Z', x: '57%', duree: '9.1s', retard: '2.6s' },
  { d: 'M40 -4 L35 16 L43 19 L30 44 L38 46 L26 70 L32 52 L25 50 L33 30 L27 28 Z', x: '86%', duree: '11.7s', retard: '5.2s' },
];

export default function EclairsBarre() {
  return (
    <div className="nd-eclairs" aria-hidden="true">
      <div className="nd-eclairs-voile" />
      {ECLAIRS.map((e, i) => (
        <svg key={i} viewBox="0 0 60 80" className="nd-eclair"
          style={{ left: e.x, animationDuration: e.duree, animationDelay: e.retard }}>
          <path d={e.d} />
        </svg>
      ))}
    </div>
  );
}
