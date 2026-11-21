import { Suspense, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Spinner } from '../ui';
import { BandeauSos } from '../../pages/AlertesSos';
import { ThemeProvider, useAuth } from '../../context/AppContext';

/** Pages autorisées au gérant d'une entreprise de transport (le serveur refuse le reste de toute façon). */
const PAGES_ENTREPRISE = ['/mon-entreprise']; // + sous-pages /mon-entreprise/vehicules, /chauffeurs, /profil

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  if (user?.role === 'GESTIONNAIRE_FLOTTE' && !PAGES_ENTREPRISE.some(p => location.pathname.startsWith(p))) {
    return <Navigate to="/mon-entreprise" replace />;
  }

  return (
    <ThemeProvider>
      <div className="nd-layout">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
        <div className={`nd-main${collapsed ? ' collapsed' : ''}`}>
          <Topbar onMenuClick={() => setCollapsed(c => !c)} />
          <BandeauSos />
          <div className="nd-content">
            {/* Chaque page arrive floue puis devient nette, ses blocs l'un après l'autre (comme dans les apps) */}
            <div key={location.pathname} className="nd-apparition">
              <Suspense fallback={<Spinner center />}><Outlet /></Suspense>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
