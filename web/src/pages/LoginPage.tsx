import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/client';
import { useAppStore } from '../stores/app';

export default function LoginPage() {
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
        setError(res.error || '登录失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-aether-950 via-aether-900 to-blue-950">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-500/20">
            A
          </div>
          <h1 className="text-2xl font-bold">Aether</h1>
          <p className="text-aether-400 mt-1 text-sm">Multi-AI 编排平台</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-sm text-aether-300 mb-1">用户名</label>
            <input
              className="input w-full"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-aether-300 mb-1">密码</label>
            <input
              className="input w-full"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
          )}
          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="text-center text-aether-500 text-xs mt-6">
          默认: admin / aether-admin
        </p>
      </div>
    </div>
  );
}
