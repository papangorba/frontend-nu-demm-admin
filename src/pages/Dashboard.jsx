import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale,
  BarElement, PointElement, LineElement, Filler,
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { apiAdmin, apiCommandes, apiFiche, fmtDT, money, Audit } from '../services/api';
import { StatCard, StatusBadge, Spinner, KpiRow } from '../components/ui';
import { Wallet, Car, Package, UserPlus, Navigation, Hourglass, Bike, Users, BadgeDollarSign, Send } from 'lucide-react';
import { useToast, useAuth, useTheme } from '../context/AppContext';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler);

const STATUS_COLORS = {
  EN_ATTENTE: '#f59e0b', ACCEPTEE: '#06b6d4', EN_COURS: '#3b82f6', TERMINEE: '#22c55e',
  LIVREE: '#22c55e', ANNULEE: '#ef4444', EXPIREE: '#64748b',
};
const fmt = n => (n ?? 0).toLocaleString('fr-FR');

export default function Dashboard() {
  const toast = useToast();
  const { user } = useAuth();
  const { dark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState(null);
  const [recent, setRecent] = useState([]);

  const greet = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  };

  const [activiteComptes, setActiviteComptes] = useState(null);
  const [statsPrix, setStatsPrix] = useState(null);
  const [argent, setArgent] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [dash, cmds, act, prix, modules] = await Promise.allSettled([apiAdmin.dashboard(), apiCommandes.all(), apiFiche.activite(), apiFiche.statsPrix(), apiAdmin.modules()]);
      // Seulement la partie finance des modules (paiements en ligne, recharges, retraits, remboursements)
      if (modules.status === 'fulfilled') setArgent(modules.value?.argent || null);
      if (act.status === 'fulfilled') setActiviteComptes(act.value);
      if (prix.status === 'fulfilled') setStatsPrix(prix.value);
      if (dash.status === 'fulfilled') setD(dash.value);
      else throw dash.reason;
      if (cmds.status === 'fulfilled') {
        setRecent([...(cmds.value || [])].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 8));
      }
      Audit.log('DASHBOARD_VIEW', 'Tableau de bord consulté');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const textColor = dark ? '#a8a4b6' : '#625e72';
  // Couleurs de la marque, plus claires en thème sombre pour rester lisibles
  const cViolet = dark ? '#9b84da' : '#452778';
  const cMauve = dark ? '#d3a1d5' : '#ab71ad';
  const gridColor = dark ? 'rgba(255,255,255,.07)' : 'rgba(29,26,39,.06)';

  const u = d?.utilisateurs || {};
  const c = d?.commandes || {};
  const l = d?.livraisons || {};
  const jours = d?.jours || [];

  const revenusJour = (c.revenusAujourdhui || 0) + (l.revenusAujourdhui || 0);
  const revenusTotal = (c.revenusTotal || 0) + (l.revenusTotal || 0);
  const termineesC = c.parStatut?.TERMINEE || 0;
  const livrees = l.parStatut?.LIVREE || 0;
  const annuleesC = (c.parStatut?.ANNULEE || 0) + (c.parStatut?.EXPIREE || 0);

  const activite = {
    labels: jours.map(j => new Date(j.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })),
    datasets: [
      { label: 'Courses', data: jours.map(j => j.commandes), borderColor: cViolet, backgroundColor: dark ? 'rgba(155,132,218,.12)' : 'rgba(69,39,120,.08)', fill: true, tension: .35, pointRadius: 3 },
      { label: 'Livraisons', data: jours.map(j => j.livraisons), borderColor: cMauve, backgroundColor: dark ? 'rgba(211,161,213,.10)' : 'rgba(171,113,173,.10)', fill: true, tension: .35, pointRadius: 3 },
    ],
  };
  const revenus = {
    labels: activite.labels,
    datasets: [{ label: 'Revenus (FCFA)', data: jours.map(j => j.revenus), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,.15)', fill: true, tension: .35, pointRadius: 3 }],
  };
  const joursArgent = argent?.jours || [];
  const courbeArgent = {
    labels: joursArgent.map(j => new Date(j.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })),
    datasets: [
      { label: 'Payé en ligne par les clients', data: joursArgent.map(j => j.clients), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,.12)', fill: true, tension: .35, pointRadius: 3 },
      { label: 'Recharges des chauffeurs', data: joursArgent.map(j => j.recharges), borderColor: cViolet, backgroundColor: 'transparent', tension: .35, pointRadius: 3 },
      { label: 'Retraits envoyés', data: joursArgent.map(j => j.retraits), borderColor: '#f59e0b', backgroundColor: 'transparent', tension: .35, pointRadius: 3, borderDash: [5, 4] },
    ],
  };
  const statuts = Object.entries(c.parStatut || {});
  const donut = {
    labels: statuts.map(([s]) => s),
    datasets: [{ data: statuts.map(([, n]) => n), backgroundColor: statuts.map(([s]) => STATUS_COLORS[s] || '#64748b'), borderWidth: 0, hoverOffset: 8 }],
  };
  const lineOpts = {
    responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    plugins: { legend: { labels: { color: textColor, boxWidth: 12 } } },
    scales: {
      x: { ticks: { color: textColor, font: { size: 11 } }, grid: { display: false } },
      // precision 0 : pas de « 0,1 course » sur l'axe
      y: { ticks: { color: textColor, font: { size: 11 }, precision: 0 }, grid: { color: gridColor }, beginAtZero: true, suggestedMax: 5 },
    },
  };

  return (
    <div className="fade-in">
      <div className="nd-welcome-bar">
        <div>
          <div className="nd-welcome-title">{greet()}, {user?.name || 'Admin'}</div>
          <div className="nd-welcome-sub">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/supervision" className="nd-btn nd-btn-primary">🛰 Supervision en direct</Link>
          <button className="nd-btn nd-btn-outline" onClick={load} disabled={loading}>
            {loading ? <><div className="nd-spinner-sm" /> Chargement...</> : '↺ Actualiser'}
          </button>
        </div>
      </div>

      {loading && !d ? <Spinner center /> : d && (
        <>
          {d.pushActif === false && (
            <div className="nd-alert nd-alert-warn" style={{ marginBottom: 18 }}>
              <span>⚠ Notifications push désactivées sur le serveur : ajoutez la variable <b>FIREBASE_CREDENTIALS</b> sur Render.</span>
            </div>
          )}

          {/* Aujourd'hui */}
          <div className="db-section-title">Aujourd'hui</div>
          <div className="nd-stat-grid" style={{ marginBottom: 22 }}>
            <StatCard color="c-green"  icon={<Wallet color="var(--nd-green)" />} value={fmt(revenusJour)} label="Revenus du jour (FCFA)" />
            <StatCard color="c-red"    icon={<Car color="var(--nd-red)" />} value={fmt(c.aujourdhui)} label="Courses du jour" />
            <StatCard color="c-purple" icon={<Package color="var(--nd-purple)" />} value={fmt(l.aujourdhui)} label="Livraisons du jour" />
            <StatCard color="c-blue"   icon={<UserPlus color="var(--nd-blue)" />} value={fmt(u.nouveauxAujourdhui)} label="Nouveaux inscrits" />
          </div>

          {/* En direct */}
          <div className="db-section-title">En ce moment</div>
          <div className="nd-stat-grid" style={{ marginBottom: 22 }}>
            <StatCard color="c-cyan"   icon={<Navigation color="var(--nd-cyan)" />}  value={fmt((c.enCours || 0) + (l.enCours || 0))} label="Trajets en cours" />
            <StatCard color="c-amber"  icon={<Hourglass color="var(--nd-amber)" />} value={fmt((c.enAttente || 0) + (l.enAttente || 0))} label="En attente d'un chauffeur" />
            <StatCard color="c-orange" icon={<Bike color="var(--nd-orange)" />} value={fmt(u.chauffeurs)} label="Chauffeurs inscrits" />
            <StatCard color="c-teal"   icon={<Users color="var(--nd-teal)" />} value={fmt(u.clients)} label={`Clients${u.suspendus ? ` · ${u.suspendus} suspendu(s)` : ''}`} />
          </div>

          {/* Argent en ligne (Wave / Orange Money) */}
          {argent && <>
            <div className="db-section-title">Argent en ligne{argent.paiementEnLigne ? '' : ' · paiement en ligne fermé'}</div>
            <div className="nd-stat-grid" style={{ marginBottom: 22 }}>
              <StatCard color="c-green" icon={<Wallet color="var(--nd-green)" />} value={`${fmt(argent.montantAujourdhui)} F`}
                label={`Payé en ligne aujourd'hui · ${fmt(argent.payesAujourdhui)} paiement(s)${argent.echecsAujourdhui ? ` · ${fmt(argent.echecsAujourdhui)} échec(s)` : ''}`} />
              <StatCard color="c-teal" icon={<BadgeDollarSign color="var(--nd-teal)" />} value={`${fmt(argent.montantMois)} F`}
                label={`Payé en ligne ce mois · dont ${fmt(argent.rechargesMois)} F de recharges chauffeurs`} />
              <StatCard color={argent.retraitsATraiter ? 'c-amber' : 'c-blue'} icon={<Send color={argent.retraitsATraiter ? 'var(--nd-amber)' : 'var(--nd-blue)'} />}
                value={fmt((argent.retraitsATraiter || 0) + (argent.retraitsEnCours || 0))}
                label={`Retraits à envoyer (${fmt(argent.montantRetraits)} F) · envoi ${argent.retraitsAuto ? 'automatique' : "par l'équipe"}`} />
              <StatCard color="c-purple" icon={<Hourglass color="var(--nd-purple)" />} value={fmt(argent.remboursementsEnCours)}
                label="Remboursements en cours" />
            </div>
          </>}

          {/* Activité des comptes */}
          {activiteComptes && <>
            <div className="db-section-title">Activité des comptes</div>
            <div className="nd-card" style={{ marginBottom: 22 }}>
              <div className="nd-card-body-p0"><div className="nd-table-wrap">
                <table className="nd-table">
                  <thead><tr><th></th><th>Comptes</th><th>Nouveaux (7 j)</th><th>Actifs 24 h</th><th>Actifs 7 j</th><th>Actifs 30 j</th>
                    <th>⚠ Inactifs ≥ {activiteComptes.seuilAlerteJours} j</th><th>Jamais revenus</th><th title="Appareils qui reçoivent les notifications">Joignables</th></tr></thead>
                  <tbody>
                    {[['clients', 'Clients', '/clients'], ['chauffeurs', 'Chauffeurs', '/chauffeurs']].map(([k, nom, lien]) => {
                      const a = activiteComptes[k] || {};
                      return <tr key={k}>
                        <td><Link to={lien}><b>{nom}</b></Link></td>
                        <td><b>{fmt(a.comptes)}</b></td><td>{fmt(a.nouveaux7j)}</td><td>{fmt(a.actifs24h)}</td><td>{fmt(a.actifs7j)}</td><td>{fmt(a.actifs30j)}</td>
                        <td style={{ color: a.inactifs ? 'var(--nd-red)' : undefined, fontWeight: a.inactifs ? 700 : 400 }}>{fmt(a.inactifs)}</td>
                        <td>{fmt(a.jamaisRevenus)}</td><td>{fmt(a.joignables)}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div></div>
              <div className="nd-card-body" style={{ paddingTop: 8 }}>
                <small className="nd-cell-sub">Le nombre exact de téléchargements se lit dans Play Console / App Store Connect ;
                  ici : comptes créés et appareils joignables par notification. Seuil d'alerte réglable dans « Contrôle des apps ».</small>
              </div>
            </div>
          </>}

          {/* Prix négociés */}
          {statsPrix && <>
            <div className="db-section-title">Prix négociés</div>
            <div className="nd-stat-grid" style={{ marginBottom: 22 }}>
              <StatCard color="c-amber" icon={<Wallet color="var(--nd-amber)" />} value={fmt(statsPrix.hausses.trajets)}
                label={`Hausses du client · ${statsPrix.hausses.tauxReussite} % ont trouvé un chauffeur`} />
              <StatCard color="c-green" icon={<Car color="var(--nd-green)" />} value={`+${statsPrix.hausses.hausseMoyennePourcent} %`}
                label="Hausse moyenne des clients" />
              <StatCard color="c-purple" icon={<Users color="var(--nd-purple)" />} value={fmt(statsPrix.offres.total)}
                label={`Offres des chauffeurs · ${fmt(statsPrix.offres.parStatut.ACCEPTEE)} acceptées (${statsPrix.offres.tauxAcceptation} %)`} />
              <StatCard color="c-blue" icon={<Hourglass color="var(--nd-blue)" />} value={`+${statsPrix.offres.hausseMoyennePourcent} %`}
                label={`Hausse moyenne des offres acceptées · ${statsPrix.reglages.offresActives ? 'offres activées' : 'offres coupées'}`} />
            </div>
          </>}

          {/* Courbes 14 jours */}
          <div className="nd-grid-2">
            <div className="nd-card">
              <div className="nd-card-header"><span className="nd-card-title">Activité — 14 derniers jours</span></div>
              <div className="nd-card-body"><div style={{ height: 240 }}><Line data={activite} options={lineOpts} /></div></div>
            </div>
            <div className="nd-card">
              <div className="nd-card-header">
                <span className="nd-card-title">Revenus — 14 derniers jours</span>
                <small className="nd-cell-sub">Total : {money(revenusTotal)}</small>
              </div>
              <div className="nd-card-body"><div style={{ height: 240 }}><Line data={revenus} options={{ ...lineOpts, plugins: { legend: { display: false } } }} /></div></div>
            </div>
          </div>

          {argent && (
            <div className="nd-card" style={{ marginTop: 20 }}>
              <div className="nd-card-header">
                <span className="nd-card-title">Argent en ligne — 14 derniers jours</span>
                <Link to="/finances" className="nd-btn nd-btn-ghost nd-btn-sm">Finances →</Link>
              </div>
              <div className="nd-card-body"><div style={{ height: 240 }}><Line data={courbeArgent} options={lineOpts} /></div></div>
            </div>
          )}

          <div className="nd-grid-2" style={{ marginTop: 20 }}>
            {/* Dernières commandes */}
            <div className="nd-card">
              <div className="nd-card-header">
                <span className="nd-card-title">Dernières courses</span>
                <Link to="/commandes" className="nd-btn nd-btn-ghost nd-btn-sm">Voir tout →</Link>
              </div>
              <div className="nd-card-body-p0">
                <div className="nd-table-wrap">
                  <table className="nd-table">
                    <thead><tr><th>#</th><th>Trajet</th><th>Prix</th><th>Statut</th><th>Date</th></tr></thead>
                    <tbody>
                      {recent.map(r => (
                        <tr key={r.id}>
                          <td className="nd-table-id">#{r.id}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <small>{r.depart || '—'} → {r.destination || '—'}</small>
                          </td>
                          <td><strong style={{ color: 'var(--nd-amber)' }}>{r.price != null ? `${fmt(r.price)} F` : '—'}</strong></td>
                          <td><StatusBadge status={r.status || 'EN_ATTENTE'} /></td>
                          <td><small className="nd-cell-sub">{fmtDT(r.createdAt)}</small></td>
                        </tr>
                      ))}
                      {!recent.length && <tr><td colSpan={5} className="nd-empty">Aucune course</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Qualité de service */}
            <div className="nd-card">
              <div className="nd-card-header"><span className="nd-card-title">Qualité de service</span></div>
              <div className="nd-card-body">
                <div style={{ height: 170, marginBottom: 12 }}>
                  {statuts.length ? (
                    <Doughnut data={donut} options={{
                      responsive: true, maintainAspectRatio: false, cutout: '68%',
                      plugins: { legend: { position: 'right', labels: { color: textColor, boxWidth: 12, padding: 10 } } },
                    }} />
                  ) : <div className="nd-empty">Aucune donnée</div>}
                </div>
                <KpiRow label="Courses terminées" pct={c.total ? Math.round(termineesC / c.total * 100) : 0}
                  label2={`${termineesC}/${c.total || 0}`} color="var(--nd-green)" />
                <KpiRow label="Livraisons livrées" pct={l.total ? Math.round(livrees / l.total * 100) : 0}
                  label2={`${livrees}/${l.total || 0}`} color="var(--nd-purple)" />
                <KpiRow label="Courses annulées ou sans chauffeur" pct={c.total ? Math.round(annuleesC / c.total * 100) : 0}
                  label2={`${annuleesC}/${c.total || 0}`} color="var(--nd-primary)" />
              </div>
            </div>
          </div>

          {/* Actions rapides */}
          <div className="nd-card" style={{ marginTop: 20 }}>
            <div className="nd-card-header"><span className="nd-card-title">Actions rapides</span></div>
            <div className="nd-card-body">
              <div className="db-actions">
                {[
                  { to: '/supervision', icon: '🛰', label: 'Carte en direct' },
                  { to: '/notifications', icon: '🔔', label: 'Envoyer une notification' },
                  { to: '/chauffeurs', icon: '🏍', label: 'Gérer les chauffeurs' },
                  { to: '/clients', icon: '👤', label: 'Gérer les clients' },
                  { to: '/commandes', icon: '🛒', label: 'Toutes les courses' },
                  { to: '/audit', icon: '📋', label: "Journal d'audit" },
                ].map(a => (
                  <Link key={a.to} to={a.to} className="db-action"><span>{a.icon}</span>{a.label}</Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
