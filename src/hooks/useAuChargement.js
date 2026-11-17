import { useEffect, useRef } from 'react';

/**
 * Lance `fn` une seule fois, à l'ouverture de la page (comme useEffect(..., [])),
 * en appelant toujours sa dernière version : plus d'avertissement « missing dependency ».
 */
export default function useAuChargement(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => { ref.current(); }, []);
}
