import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ToastProvider, useAuth } from './context/AppContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/Login';
import Dashboard from './pages/Dashboard';
import Chauffeurs from './pages/Chauffeurs';
import Clients from './pages/Clients';
import Commandes from './pages/Commandes';
import Supervision from './pages/Supervision';
import Notifications from './pages/Notifications';
import Publicites from './pages/Publicites';
import Contenus from './pages/Contenus';
import Tarifs from './pages/Tarifs';
import Documents from './pages/Documents';
import ControleApp from './pages/ControleApp';
import AlertesSos from './pages/AlertesSos';
import Suppressions from './pages/Suppressions';
import Regions from './pages/Regions';
import Entreprises from './pages/Entreprises';
import MonEntreprise from './pages/MonEntreprise';
import EntVehicules from './pages/entreprise/Vehicules';
import EntChauffeurs from './pages/entreprise/Chauffeurs';
import EntProfil from './pages/entreprise/Profil';
import EntTrajets from './pages/entreprise/Trajets';
import {
  Livraisons, Trajets, Vehicules, Reservations,
  Admins, AuditLog, Settings
} from './pages/OtherPages';

function PrivateRoute({ children }) {
  const { logged } = useAuth();
  return logged ? children : <Navigate to="/login" replace />;
}
function PublicRoute({ children }) {
  const { logged } = useAuth();
  return !logged ? children : <Navigate to="/" replace />;
}

/** Accueil : le gérant d'une entreprise arrive sur son espace, les admins sur le tableau de bord. */
function Accueil() {
  const { user } = useAuth();
  return user?.role === 'GESTIONNAIRE_FLOTTE' ? <Navigate to="/mon-entreprise" replace /> : <Dashboard />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index element={<Accueil />} />
        <Route path="mon-entreprise" element={<MonEntreprise />} />
        <Route path="mon-entreprise/vehicules"  element={<EntVehicules />} />
        <Route path="mon-entreprise/chauffeurs" element={<EntChauffeurs />} />
        <Route path="mon-entreprise/profil"     element={<EntProfil />} />
        <Route path="mon-entreprise/trajets"    element={<EntTrajets />} />
        <Route path="entreprises"   element={<Entreprises />} />
        <Route path="supervision"   element={<Supervision />} />
        <Route path="sos"           element={<AlertesSos />} />
        <Route path="suppressions"  element={<Suppressions />} />
        <Route path="regions"       element={<Regions />} />
        <Route path="publicites"    element={<Publicites />} />
        <Route path="contenus"      element={<Contenus />} />
        <Route path="tarifs"        element={<Tarifs />} />
        <Route path="documents"     element={<Documents />} />
        <Route path="controle"      element={<ControleApp />} />
        <Route path="sessions"      element={<ControleApp mode="sessions" />} />
        <Route path="chauffeurs"    element={<Chauffeurs />} />
        <Route path="clients"       element={<Clients />} />
        <Route path="commandes"     element={<Commandes />} />
        <Route path="livraisons"    element={<Livraisons />} />
        <Route path="trajets"       element={<Trajets />} />
        <Route path="vehicules"     element={<Vehicules />} />
        <Route path="reservations"  element={<Reservations />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="admins"        element={<Admins />} />
        <Route path="audit"         element={<AuditLog />} />
        <Route path="settings"      element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
