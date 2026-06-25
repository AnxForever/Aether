import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/client';
import { useAppStore } from '../stores/app';
import { useI18n } from '../stores/i18n';
import { Hash } from 'lucide-react';

export default function LoginPage() {
  const t = useI18n((s) => s.t);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const appLogin = useAppStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(username, password);
      if (res.success) {
        appLogin();
        navigate('/');
      } else {
        setError(res.error || t.errors.networkError);
      }
    } catch {
      setError(t.errors.networkError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-void">
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-sm bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Hash size={24} className="text-accent" />
          </div>
          <h1 className="font-display text-display text-ink">Aether</h1>
          <p className="font-body text-sm text-ink-muted mt-1.5">
            {t.common.tagline}
          </p>
          {/* Provider dots */}
          <div className="flex justify-center gap-1.5 mt-3">
            {['#f59e0b', '#10b981', '#4285f4', '#ec4899', '#06b6d4', '#6366f1'].map((c, i) => (
              <span key={i} className="w-[4px] h-[4px] rounded-full opacity-30" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label htmlFor="username" className="block font-ui text-sm text-ink-secondary mb-1.5">{t.common.username}</label>
            <input
              id="username"
              className="field w-full"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="password" className="block font-ui text-sm text-ink-secondary mb-1.5">{t.common.password}</label>
            <input
              id="password"
              className="field w-full"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
            />
          </div>
          {error && (
            <p className="font-body text-sm text-danger bg-danger/5 px-3 py-2 rounded-sm border border-danger/15">
              {error}
            </p>
          )}
          <button className="btn btn-primary w-full justify-center" type="submit" disabled={loading}>
            {loading ? `${t.common.login}...` : t.common.enterConsole}
          </button>
        </form>

        <p className="text-center font-body text-[11px] text-ink-ghost mt-4">
          Protected system
        </p>
      </div>
    </div>
  );
}
