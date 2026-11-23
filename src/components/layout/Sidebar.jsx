import EclairsBarre from './EclairsBarre';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Radar, Car, IdCard, Users, ShoppingBag, Truck, Route, CarFront, CalendarDays,
  Bell, Megaphone, FileText, BadgeDollarSign, SlidersHorizontal, Clock, ShieldCheck, ScrollText, Settings,
  Moon, Sun, LogOut, PanelLeftClose, PanelLeftOpen, Siren, Building2, Bus, Gauge, UserRound, MapPinned, UserX, Store, AudioLines, Package, Wallet,
} from 'lucide-react';
import { Auth } from '../../services/api';
import { Avatar, RoleBadge } from '../ui';
import { useAuth, useTheme } from '../../context/AppContext';
import { useNouveautes } from './nouveautes';

/** Icônes du menu (lignes fines, comme les apps professionnelles). */
export const ICONES = {
  dashboard: LayoutDashboard, supervision: Radar, sos: Siren, entreprises: Building2, 'mon-entreprise': Gauge, 'ent-vehicules': Bus, 'ent-chauffeurs': UserRound, 'ent-profil': Building2, 'ent-trajets': MapPinned, chauffeurs: Car, documents: IdCard, clients: Users, 'comptes-pro': Store, suppressions: UserX,
  commandes: ShoppingBag, livraisons: Truck, 'envois-colis': Package, finances: Wallet, trajets: Route, vehicules: CarFront, reservations: CalendarDays,
  notifications: Bell, publicites: Megaphone, contenus: FileText, tarifs: BadgeDollarSign, controle: SlidersHorizontal, sessions: Clock, regions: MapPinned, 'wolof-ndiaye': AudioLines,
  admins: ShieldCheck, audit: ScrollText, settings: Settings,
};

export const MENU_SECTIONS = [
  {
    // Espace d'une entreprise de transport abonnée (rôle GESTIONNAIRE_FLOTTE)
    label: 'Mon entreprise',
    items: [
      { id: 'mon-entreprise', label: 'Tableau de bord', to: '/mon-entreprise' },
      { id: 'ent-trajets',    label: 'Mes trajets',     to: '/mon-entreprise/trajets' },
      { id: 'ent-vehicules',  label: 'Mes véhicules',   to: '/mon-entreprise/vehicules' },
      { id: 'ent-chauffeurs', label: 'Mes chauffeurs',  to: '/mon-entreprise/chauffeurs' },
      { id: 'ent-profil',     label: 'Mon entreprise',  to: '/mon-entreprise/profil' },
    ]
  },
  {
    label: 'Principal',
    items: [
      { id: 'dashboard',    label: 'Tableau de bord', to: '/' },
      { id: 'supervision',  label: 'Supervision live', to: '/supervision' },
      { id: 'sos',          label: 'Alertes SOS',     to: '/sos' },
    ]
  },
  {
    label: 'Utilisateurs',
    items: [
      { id: 'chauffeurs',   label: 'Chauffeurs',      to: '/chauffeurs' },
      { id: 'documents',    label: 'Documents',       to: '/documents' },
      { id: 'clients',      label: 'Clients',         to: '/clients' },
      { id: 'comptes-pro',  label: 'Clients pros',    to: '/comptes-pro' },
      { id: 'suppressions', label: 'Suppressions de compte', to: '/suppressions' },
      { id: 'sessions',     label: 'Sessions & connexion', to: '/sessions' },
    ]
  },
  {
    label: 'Opérations',
    items: [
      { id: 'commandes',    label: 'Commandes',       to: '/commandes' },
      { id: 'livraisons',   label: 'Livraisons',      to: '/livraisons' },
      { id: 'envois-colis', label: 'Envois de colis', to: '/envois-colis' },
      { id: 'finances',     label: 'Finances',        to: '/finances' },
      { id: 'trajets',      label: 'Trajets',         to: '/trajets' },
      { id: 'vehicules',    label: 'Véhicules',       to: '/vehicules' },
      { id: 'reservations', label: 'Réservations',    to: '/reservations' },
    ]
  },
  {
    label: 'Admin',
    items: [
      { id: 'entreprises',   label: 'Entreprises de transport', to: '/entreprises' },
      { id: 'notifications', label: 'Notifications',   to: '/notifications' },
      { id: 'publicites',    label: 'Pubs & annonces', to: '/publicites' },
      { id: 'contenus',      label: 'Textes des apps', to: '/contenus' },
      { id: 'tarifs',        label: 'Tarifs',          to: '/tarifs' },
      { id: 'controle',      label: 'Contrôle des apps', to: '/controle' },
      { id: 'regions',       label: 'Services par région', to: '/regions' },
      { id: 'wolof-ndiaye',  label: 'Wolof Ndiaye',    to: '/wolof-ndiaye' },
      { id: 'admins',        label: 'Administrateurs', to: '/admins' },
      { id: 'audit',         label: "Journal d'audit", to: '/audit' },
      { id: 'settings',      label: 'Paramètres',      to: '/settings' },
    ]
  },
];
export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const { theme, setDark, setLight } = useTheme();
  const remaining = Auth.tokenRemainingMinutes();
  const nouveautes = useNouveautes();

  return (
    <aside className={`nd-sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Brand */}
      <div className="nd-sidebar-brand">
        <EclairsBarre />
        <div className="nd-brand-icon"><img src="/logo.png" alt="Ñu Demm" /></div>
        <div className="nd-brand-text">
          <span className="nd-brand-name">Ñu Demm</span>
          <span className="nd-brand-sub">Administration</span>
        </div>
        <button className="nd-sidebar-toggle" onClick={onToggle} title="Réduire">
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* User */}
      <div className="nd-sidebar-user">
        <Avatar name={user?.name || user?.email || 'A'} size={38} />
        <div className="nd-user-info">
          <div className="nd-user-name">{user?.name || user?.email || 'Admin'}</div>
          <div className="nd-user-role"><RoleBadge role={user?.role} /></div>
          {remaining > 0 && (
            <div style={{ fontSize: 10, marginTop: 3, color: remaining <= 5 ? 'var(--nd-amber)' : 'var(--nd-green)' }}>
              Session : {remaining} min
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="nd-sidebar-nav">
        {MENU_SECTIONS.map(section => {
          const visibleItems = section.items.filter(m => Auth.can(m.id));
          if (!visibleItems.length) return null;
          return (
            <div key={section.label}>
              <span className="nd-sec-label">{section.label}</span>
              <ul>
                {visibleItems.map(m => {
                  const Icone = ICONES[m.id];
                  const n = nouveautes[m.id] || 0;
                  return (
                  <li key={m.id}>
                    <NavLink
                      to={m.to}
                      title={n ? `${m.label} — ${n} nouveau${n > 1 ? 'x' : ''}` : m.label}
                      className={({ isActive }) => isActive ? 'active' : ''}
                      end={m.to === '/' || m.to === '/mon-entreprise'}
                    >
                      <span className="nd-menu-icon">{Icone && <Icone />}
                        {n > 0 && <span className="nd-menu-point" aria-hidden="true" />}</span>
                      <span className="nd-menu-label">{m.label}</span>
                      {n > 0 && <span className="nd-menu-nouveau" aria-label={`${n} nouveautés`}>{n > 99 ? '99+' : n}</span>}
                    </NavLink>
                  </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className="nd-theme-row">
        <span className="nd-theme-label">
          {theme === 'dark' ? 'Thème sombre' : 'Thème clair'}
        </span>
        <div className="nd-theme-switch">
          <button
            className={`nd-theme-btn${theme === 'dark' ? ' active' : ''}`}
            onClick={setDark}
            title="Thème sombre"
          ><Moon size={14} /></button>
          <button
            className={`nd-theme-btn${theme === 'light' ? ' active' : ''}`}
            onClick={setLight}
            title="Thème clair"
          ><Sun size={14} /></button>
        </div>
      </div>

      {/* Footer */}
      <div className="nd-sidebar-footer">
        <button className="nd-logout-btn" onClick={logout}>
          <LogOut size={17} />
          <span className="nd-logout-text">Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
