import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiAuth, setBaseUrl, getBaseUrl, Audit } from '../services/api';
import { useAuth, useToast } from '../context/AppContext';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showBase, setShowBase] = useState(false);
  const [baseUrl, setBaseUrlState] = useState(getBaseUrl());
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  const submit = async e => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const res = await apiAuth.login(form);
      if (!res) throw new Error('Pas de réponse du serveur. Réessayez (le serveur Render peut mettre ~1 min à démarrer).');
      const token = res.token || res.accessToken || res.jwt;
      const user = res.user || res.admin || { email: form.email, role: res.role || 'ADMIN', name: res.name || form.email,
        // Entreprise de transport (SaaS) : son nom s'affiche dans l'en-tête
        ...(res.flotteId ? { flotteId: res.flotteId, flotteNom: res.flotteNom } : {}) };
      if (!token) throw new Error('Token non reçu du serveur');
      login(token, user);
      Audit.log('LOGIN', `Connexion admin: ${form.email}`);
      toast('Connexion réussie ! Bienvenue 👋', 'success');
      nav(user.role === 'GESTIONNAIRE_FLOTTE' ? '/mon-entreprise' : '/');
    } catch (e) {
      setErr(e.message);
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveBase = () => {
    setBaseUrl(baseUrl);
    toast('URL backend sauvegardée', 'success');
  };

  return (
    <div className="nd-login-screen">
      <div className="nd-login-card">
        {/* Logo */}
        <div className="nd-login-logo">
          <div className="nd-login-logo-icon"><img src="/logo.png" alt="Ñu Demm" /></div>
          <div>
            <div className="nd-login-title">Ñu Demm</div>
            <div className="nd-login-sub">Panneau d'administration</div>
          </div>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="nd-form-group">
            <label>Email administrateur</label>
            <input
              type="email" className="nd-input" required
              placeholder="admin@nudemm.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="nd-form-group">
            <label>Mot de passe</label>
            <input
              type="password" className="nd-input" required
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>

          {err && (
            <div className="nd-alert nd-alert-danger">
              <span>⚠</span> {err}
            </div>
          )}

          <button type="submit" className="nd-btn nd-btn-primary" disabled={loading} style={{ marginTop: 4, justifyContent: 'center' }}>
            {loading ? <><div className="nd-spinner-sm" /> Connexion...</> : '🔓 Se connecter'}
          </button>
        </form>

        {/* Backend config */}
        <div style={{ marginTop: 20 }}>
          <button
            type="button"
            onClick={() => setShowBase(v => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--nd-text-dim)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            ⚙ {showBase ? 'Masquer' : 'Configurer'} l'URL du backend
          </button>
          {showBase && (
            <div style={{ marginTop: 10, padding: 14, background: 'var(--nd-surface2)', borderRadius: 10, border: '1px solid var(--nd-border)', display: 'flex', gap: 8 }}>
              <input
                type="text" className="nd-input"
                placeholder="http://localhost:8080"
                value={baseUrl}
                onChange={e => setBaseUrlState(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={saveBase}>Sauver</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
