import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, Zap, Activity, MapPinned, Bell } from 'lucide-react';
import { apiAuth, setBaseUrl, getBaseUrl, Audit } from '../services/api';
import { useAuth, useToast } from '../context/AppContext';

/** Éclair en zigzag (mêmes formes que dans les apps mobiles) */
const ECLAIR_1 = 'M330 -10 L318 38 L338 44 L300 112 L322 118 L276 196 L292 150 L272 146 L300 92 L280 86 Z';
const ECLAIR_2 = 'M392 30 L384 62 L396 66 L372 112 L384 82 L374 78 Z';

/** Panneau décoratif : dégradé violet, halo, éclairs qui flashent, route et voiture jaune */
function PanneauOrage() {
  return (
    <div className="lg-orage" aria-hidden="true">
      <div className="lg-flash" />
      <svg className="lg-eclairs" viewBox="0 0 400 300" preserveAspectRatio="xMaxYMin meet">
        <defs>
          <filter id="lg-lueur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path d={ECLAIR_1} className="lg-eclair" filter="url(#lg-lueur)" />
        <path d={ECLAIR_2} className="lg-eclair lg-eclair-petit" filter="url(#lg-lueur)" />
      </svg>
      <svg className="lg-route" viewBox="0 0 400 60" preserveAspectRatio="none">
        <path id="lg-chemin" d="M-20 50 C 120 10, 250 70, 420 18" className="lg-chaussee" />
        <path d="M-20 50 C 120 10, 250 70, 420 18" className="lg-pointilles" />
      </svg>
      <div className="lg-voiture"><span /></div>
    </div>
  );
}

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [voir, setVoir] = useState(false);
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
    <div className="lg-ecran">
      {/* En-tête / panneau gauche */}
      <section className="lg-entete">
        <PanneauOrage />
        <div className="lg-entete-contenu">
          <div className="lg-marque">
            <div className="lg-logo"><img src="/logo.png" alt="Ñu Demm" /></div>
            <div className="lg-marque-nom">Ñu Demm <small>Admin</small></div>
          </div>
          <h1 className="lg-bienvenue">Bienvenue</h1>
          <p className="lg-slogan">Pilotez courses, livraisons et chauffeurs partout au Sénégal.</p>
        </div>
      </section>

      {/* Carte blanche */}
      <section className="lg-carte">
        <svg className="lg-carte-eclairs" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d="M352 -10 L338 60 L360 66 L318 150 L342 156 L290 258" />
          <path d="M28 220 L44 280 L24 286 L62 360 L40 364 L96 446" />
          <path d="M388 360 L372 420 L392 426 L356 500 L376 506 L334 590" />
        </svg>

        <div className="lg-carte-contenu">
          <div className="lg-badge">
            <span className="lg-badge-icone"><ShieldCheck size={15} /></span>
            ESPACE ADMIN
            <Zap size={16} className="lg-badge-eclair" />
          </div>
          <h2 className="lg-titre">Connectez-vous</h2>
          <div className="lg-trait" />
          <p className="lg-texte">Entrez votre email et votre mot de passe administrateur</p>

          <form onSubmit={submit} className="lg-form">
            <label className="lg-champ">
              <span className="lg-champ-label">Email administrateur</span>
              <span className="lg-champ-boite">
                <Mail size={18} />
                <input type="email" required placeholder="admin@nudemm.com" autoComplete="username"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </span>
            </label>
            <label className="lg-champ">
              <span className="lg-champ-label">Mot de passe</span>
              <span className="lg-champ-boite">
                <Lock size={18} />
                <input type={voir ? 'text' : 'password'} required placeholder="••••••••" autoComplete="current-password"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                <button type="button" className="lg-oeil" onClick={() => setVoir(v => !v)}
                  aria-label={voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                  {voir ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            {err && (
              <div className="nd-alert nd-alert-danger">
                <span>⚠</span> {err}
              </div>
            )}

            <button type="submit" className="lg-bouton" disabled={loading}>
              {loading ? <><div className="nd-spinner-sm" /> Connexion...</> : 'Se connecter'}
            </button>
          </form>

          <div className="lg-atouts">
            <div><span><Activity size={18} /></span>Supervision en direct</div>
            <div><span><MapPinned size={18} /></span>14 régions</div>
            <div><span><Bell size={18} /></span>Notifications</div>
          </div>

          {/* Backend config */}
          <div className="lg-backend">
            <button type="button" onClick={() => setShowBase(v => !v)} className="lg-backend-lien">
              ⚙ {showBase ? 'Masquer' : 'Configurer'} l'URL du backend
            </button>
            {showBase && (
              <div className="lg-backend-boite">
                <input type="text" className="nd-input" placeholder="http://localhost:8080"
                  value={baseUrl} onChange={e => setBaseUrlState(e.target.value)} style={{ flex: 1 }} />
                <button className="nd-btn nd-btn-outline nd-btn-sm" onClick={saveBase}>Sauver</button>
              </div>
            )}
          </div>

          <div className="lg-pied">100% Sénégalais - Ñu Demm by PndTech</div>
        </div>
      </section>
    </div>
  );
}
