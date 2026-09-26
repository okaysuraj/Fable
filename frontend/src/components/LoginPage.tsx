import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { User } from '../types/chat';

interface LoginPageProps {
  onAuth: (user: User, token: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onAuth }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!name.trim()) {
          setError('Name is required');
          setLoading(false);
          return;
        }
        const res = await api.register(email, password, name);
        localStorage.setItem('fable_token', res.token);
        onAuth(res.user, res.token);
        navigate('/app');
      } else {
        const res = await api.login(email, password);
        localStorage.setItem('fable_token', res.token);
        onAuth(res.user, res.token);
        navigate('/app');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-paper)] flex items-center justify-center p-6 relative paper-texture">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <button
            onClick={() => navigate('/')}
            className="w-14 h-14 flex items-center justify-center font-display text-3xl border-[3px] border-[var(--border)] cursor-pointer hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
            style={{ background: 'var(--accent-yellow)', boxShadow: 'var(--shadow)' }}
          >
            F
          </button>
          <div>
            <h1 className="font-display text-3xl tracking-tight">FABLE</h1>
            <p className="font-mono-code text-xs text-[var(--ink-muted)] uppercase tracking-widest">
              {mode === 'login' ? 'WELCOME BACK' : 'JOIN THE STUDIO'}
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="brutal-card p-8 space-y-6">
          <div className="flex border-[3px] border-[var(--border)]">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-3 font-display text-sm uppercase tracking-wider transition-colors ${
                mode === 'login'
                  ? 'bg-[var(--ink)] text-white'
                  : 'bg-white text-[var(--ink)] hover:bg-[var(--bg-card-alt)]'
              }`}
            >
              LOG IN
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-3 font-display text-sm uppercase tracking-wider border-l-[3px] border-[var(--border)] transition-colors ${
                mode === 'register'
                  ? 'bg-[var(--ink)] text-white'
                  : 'bg-white text-[var(--ink)] hover:bg-[var(--bg-card-alt)]'
              }`}
            >
              SIGN UP
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-2">
                <label className="font-display text-xs uppercase tracking-wider text-[var(--ink-secondary)]">
                  YOUR NAME
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Suraj"
                  className="brutal-input"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="font-display text-xs uppercase tracking-wider text-[var(--ink-secondary)]">
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
                className="brutal-input"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="font-display text-xs uppercase tracking-wider text-[var(--ink-secondary)]">
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="brutal-input"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div
                className="p-3 border-[3px] border-[var(--accent-pink)] text-sm font-bold"
                style={{ background: '#FFE0E9' }}
              >
                ✕ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`brutal-btn w-full text-base py-4 ${loading ? 'opacity-60 cursor-wait' : ''}`}
            >
              {loading
                ? 'WORKING...'
                : mode === 'login'
                ? 'ENTER THE STUDIO →'
                : 'CREATE ACCOUNT →'
              }
            </button>
          </form>

          {mode === 'login' && (
            <div className="pt-2 border-t-[2px] border-dashed border-[var(--ink-faint)]">
              <p className="font-mono-code text-xs text-[var(--ink-muted)] text-center">
                DEMO: suraj@fable.studio / password123
              </p>
            </div>
          )}
        </div>

        <p className="text-center font-mono-code text-xs text-[var(--ink-muted)] mt-6 uppercase tracking-wider">
          ENCRYPTED · END-TO-END · BUILT DIFFERENT
        </p>
      </div>

      {/* Decorative */}
      <div
        className="absolute top-20 right-20 w-32 h-32 border-[4px] border-[var(--border)] rotate-45 opacity-8 pointer-events-none hidden lg:block"
        style={{ background: 'var(--accent-blue)' }}
      />
      <div
        className="absolute bottom-20 left-20 w-24 h-24 border-[4px] border-[var(--border)] -rotate-12 opacity-8 pointer-events-none hidden lg:block"
        style={{ background: 'var(--accent-yellow)' }}
      />
    </div>
  );
};
