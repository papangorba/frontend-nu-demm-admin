import { lazy as reactLazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ToastProvider, useAuth } from './context/AppContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/Login';
// Chaque page est téléchargée seulement quand on l'ouvre (l'admin démarre plus vite).
// Après une mise en ligne, un onglet resté ouvert peut chercher un fichier de page qui n'existe plus :
// on recharge l'admin une seule fois (sinon la page resterait blanche).
const lazy = charger => reactLazy(() => charger().then(page => {
  try { sessionStorage.removeItem('nd-recharge'); } catch { /* stockage bloqué */ }
  return page;
}).catch(erreur => {
  let deja = false;
  try { deja = sessionStorage.getItem('nd-recharge') === '1'; sessionStorage.setItem('nd-recharge', '1'); } catch { /* stockage bloqué */ }
  if (!deja) { window.location.reload(); return new Promise(() => {}); }
  throw erreur;
}));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Chauffeurs = lazy(() => import('./pages/Chauffeurs'));
const Clients = lazy(() => import('./pages/Clients'));
const Commandes = lazy(() => import('./pages/Commandes'));
const Supervision = lazy(() => import('./pages/Supervision'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Publicites = lazy(() => import('./pages/Publicites'));
const Contenus = lazy(() => import('./pages/Contenus'));
const Tarifs = lazy(() => import('./pages/Tarifs'));
const Documents = lazy(() => import('./pages/Documents'));
const ControleApp = lazy(() => import('./pages/ControleApp'));
const AlertesSos = lazy(() => import('./pages/AlertesSos'));
const Suppressions = lazy(() => import('./pages/Suppressions'));
const EnvoisColis = lazy(() => import('./pages/EnvoisColis'));
const Finances = lazy(() => import('./pages/Finances'));
const ComptesPro = lazy(() => import('./pages/ComptesPro'));
const Regions = lazy(() => import('./pages/Regions'));
const WolofNdiaye = lazy(() => import('./pages/WolofNdiaye'));
const Entreprises = lazy(() => import('./pages/Entreprises'));
const MonEntreprise = lazy(() => import('./pages/MonEntreprise'));
const EntVehicules = lazy(() => import('./pages/entreprise/Vehicules'));
const EntChauffeurs = lazy(() => import('./pages/entreprise/Chauffeurs'));
const EntProfil = lazy(() => import('./pages/entreprise/Profil'));
const EntTrajets = lazy(() => import('./pages/entreprise/Trajets'));
const autres = () => import('./pages/OtherPages');
const Livraisons = lazy(() => autres().then(m => ({ default: m.Livraisons })));
const Trajets = lazy(() => autres().then(m => ({ default: m.Trajets })));
const Vehicules = lazy(() => autres().then(m => ({ default: m.Vehicules })));
const Reservations = lazy(() => autres().then(m => ({ default: m.Reservations })));
const Admins = lazy(() => autres().then(m => ({ default: m.Admins })));
const AuditLog = lazy(() => autres().then(m => ({ default: m.AuditLog })));
const Settings = lazy(() => autres().then(m => ({ default: m.Settings })));

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
        <Route path="envois-colis"  element={<EnvoisColis />} />
        <Route path="finances"      element={<Finances />} />
        <Route path="comptes-pro"   element={<ComptesPro />} />
        <Route path="regions"       element={<Regions />} />
        <Route path="wolof-ndiaye"  element={<WolofNdiaye />} />
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
