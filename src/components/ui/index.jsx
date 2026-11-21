import { useEffect, useState } from 'react';
import { STATUS_MAP, ROLE_MAP, avatarColor } from '../../services/api';

// ─── Status Badge ─────────────────────────────────────────────
export function StatusBadge({ status }) {
  const { cls, label } = STATUS_MAP[status] || { cls:'badge-secondary', label: status||'—' };
  return <span className={`nd-badge ${cls}`}>{label}</span>;
}

// ─── Role Badge ─────────────────────────────────────────────
export function RoleBadge({ role }) {
  const { cls, label } = ROLE_MAP[role] || { cls:'role-default', label: role||'—' };
  return <span className={`nd-badge ${cls}`}>{label}</span>;
}

// ─── Avatar ─────────────────────────────────────────────────
export function Avatar({ name, size=36 }) {
  const letter = (name||'?')[0].toUpperCase();
  const color  = avatarColor(name||'?');
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      background:color, color:'#fff',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontWeight:700, fontSize:Math.round(size*0.4), flexShrink:0
    }}>{letter}</div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────
export function Spinner({ center=false }) {
  if (center) return <div className="nd-loading-center"><div className="nd-spinner"/></div>;
  return <div className="nd-spinner"/>;
}

// ─── Empty ─────────────────────────────────────────────────
export function EmptyRow({ cols, msg='Aucune donnée' }) {
  return (
    <tr>
      <td colSpan={cols} className="nd-empty">
        <div>
          <div style={{ fontSize:36, color:'#94a3b8', marginBottom:8 }}>📭</div>
          <div>{msg}</div>
        </div>
      </td>
    </tr>
  );
}

// ─── Loading Row ─────────────────────────────────────────────
export function LoadingRow({ cols }) {
  return <tr><td colSpan={cols} className="nd-empty"><Spinner/></td></tr>;
}

// ─── Modal ─────────────────────────────────────────────────
export function Modal({ open, title, onClose, children, footer, wide = false }) {
  if (!open) return null;
  return (
    <div className="nd-modal-overlay" onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div className={`nd-modal${wide ? ' nd-modal-wide' : ''}`}>
        <div className="nd-modal-header">
          <span className="nd-modal-title">{title}</span>
          <button className="nd-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="nd-modal-body">{children}</div>
        {footer && <div className="nd-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────
export function StatCard({ color, icon, value, label }) {
  return (
    <div className={`nd-stat-card ${color}`}>
      <div className="nd-stat-icon">{icon}</div>
      <div className="nd-stat-num">{value ?? '—'}</div>
      <div className="nd-stat-label">{label}</div>
    </div>
  );
}

// ─── Mini Stat Card ─────────────────────────────────────────────
export function MiniCard({ color='var(--nd-primary)', value, label }) {
  return (
    <div className="nd-mini-card" style={{ borderTopColor:color, borderTopWidth:2 }}>
      <div className="nd-mini-num" style={{ color }}>{value ?? '—'}</div>
      <div className="nd-mini-label">{label}</div>
    </div>
  );
}

// ─── KPI Row ─────────────────────────────────────────────
export function KpiRow({ label, val, label2, pct, color }) {
  return (
    <div className="nd-perf-row">
      <div style={{ flex:1 }}>
        <div className="nd-perf-label">{label}</div>
        <div className="nd-progress">
          <div className="nd-progress-bar" style={{ width:`${pct||0}%`, background:color }} />
        </div>
      </div>
      <div className="nd-perf-val" style={{ color }}>{label2||`${pct||0}%`}</div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────
export function DetailRow({ label, value }) {
  return (
    <div className="nd-detail-row">
      <span className="nd-detail-key">{label}</span>
      <span className="nd-detail-val">{value ?? '—'}</span>
    </div>
  );
}


// ─── Pagination de l'affichage (les données restent toutes en mémoire : la recherche couvre tout) ───
export const PAR_PAGE = 50;

/** Lignes de la page courante + barre « ‹ 1–50 sur 312 › ». Revient à la page 1 quand la liste change. */
export function usePagination(lignes, parPage = PAR_PAGE) {
  const [page, setPage] = useState(0);
  const total = lignes.length;
  const pages = Math.max(1, Math.ceil(total / parPage));
  useEffect(() => { setPage(0); }, [total]);
  const p = Math.min(page, pages - 1);
  const visibles = lignes.slice(p * parPage, (p + 1) * parPage);
  const barre = total <= parPage ? null : (
    <div className="nd-pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '10px 16px' }}>
      <span className="nd-cell-sub">{p * parPage + 1}–{Math.min(total, (p + 1) * parPage)} sur {total}</span>
      <button className="nd-btn nd-btn-ghost nd-btn-sm" disabled={p === 0} onClick={() => setPage(p - 1)} aria-label="Page précédente">‹ Précédent</button>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{p + 1} / {pages}</span>
      <button className="nd-btn nd-btn-ghost nd-btn-sm" disabled={p >= pages - 1} onClick={() => setPage(p + 1)} aria-label="Page suivante">Suivant ›</button>
    </div>
  );
  return { visibles, barre };
}
