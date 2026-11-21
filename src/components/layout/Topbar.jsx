import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Clock, KeyRound, Sun, Moon } from 'lucide-react';
import { Auth } from '../../services/api';
import { Avatar } from '../ui';
import { useAuth, useTheme } from '../../context/AppContext';
import { ICONES, MENU_SECTIONS } from './Sidebar';
import EclairsBarre from './EclairsBarre';
import StatutVoix from './StatutVoix';

/** Titre + icône de chaque page, tirés du menu (une seule source). */
const PAGES = Object.fromEntries(
  MENU_SECTIONS.flatMap(s => s.items).map(m => [m.to, { label: m.label, Icone: ICONES[m.id] }])
);

export default function Topbar({ onMenuClick }) {
  const { user } = useAuth();
  const { theme, setDark, setLight } = useTheme();
  const location = useLocation();
  const [clock, setClock] = useState('');
  const [remaining, setRemaining] = useState(Auth.tokenRemainingMinutes());

  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
      setRemaining(Auth.tokenRemainingMinutes());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const page = PAGES[location.pathname] || { label: 'Administration' };
  const { Icone } = page;

  return (
    <header className="nd-topbar">
      <EclairsBarre />
      <div className="nd-topbar-left">
        <button className="nd-icon-btn" onClick={onMenuClick} title="Réduire / agrandir le menu"><Menu /></button>
        <div className="nd-page-title">{Icone && <Icone />}{page.label}</div>
      </div>
      <div className="nd-topbar-right">
        <StatutVoix />
        <div className="nd-topbar-clock"><Clock />{clock}</div>
        {remaining > 0 && (
          <div className="nd-topbar-token" style={{ color: remaining <= 5 ? 'var(--nd-amber)' : 'var(--nd-text-muted)' }}>
            <KeyRound />{remaining} min
          </div>
        )}
        <button className="nd-icon-btn" onClick={theme === 'dark' ? setLight : setDark}
          title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}>
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
        <div className="nd-topbar-user">
          <Avatar name={user?.name || user?.email || 'A'} size={32} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{(user?.name || user?.email || 'Admin').split(' ')[0]}</span>
        </div>
      </div>
    </header>
  );
}
