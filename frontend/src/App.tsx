import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User } from './types/chat';
import { api } from './services/api';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('fable_token');
    if (token) {
      api
        .fetchMe()
        .then((res) => {
          setCurrentUser(res.user);
        })
        .catch(() => {
          localStorage.removeItem('fable_token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleAuth = (user: User, token: string) => {
    localStorage.setItem('fable_token', token);
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('fable_token');
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-paper)] flex items-center justify-center">
        <div className="brutal-card p-10 text-center">
          <div
            className="w-16 h-16 mx-auto flex items-center justify-center font-display text-3xl border-[3px] border-[var(--border)] mb-4"
            style={{ background: 'var(--accent-yellow)', boxShadow: 'var(--shadow)' }}
          >
            F
          </div>
          <p className="font-display text-xl tracking-tight">LOADING...</p>
          <p className="font-mono-code text-xs text-[var(--ink-muted)] mt-2 uppercase tracking-wider">
            Checking session
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={currentUser ? <Navigate to="/app" replace /> : <LandingPage />}
        />
        <Route
          path="/login"
          element={
            currentUser ? (
              <Navigate to="/app" replace />
            ) : (
              <LoginPage onAuth={handleAuth} />
            )
          }
        />
        <Route
          path="/app"
          element={
            currentUser ? (
              <Dashboard currentUser={currentUser} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
