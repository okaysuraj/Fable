/** Own session restoration and routing; user-scoped dashboard state disappears on logout. */
import React, { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { User } from "./types/chat";
import { observeAuth, logout } from "./services/firebase";
import { api, ApiError } from "./services/api";
import { LandingPage } from "./components/LandingPage";
import { AppBoundary } from "./components/AppBoundary";

const LoginPage = lazy(() =>
  import("./components/LoginPage").then((module) => ({
    default: module.LoginPage,
  })),
);
const Dashboard = lazy(() =>
  import("./components/Dashboard").then((module) => ({
    default: module.Dashboard,
  })),
);

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [retry, setRetry] = useState(0);

  // Check for existing session on mount
  useEffect(() => {
    let active = true;
    let generation = 0;
    setSessionError("");
    setLoading(true);
    localStorage.removeItem("fable_token");
    const unsubscribe = observeAuth(
      async (firebaseUser) => {
        const currentGeneration = ++generation;
        if (!active) return;
        if (!firebaseUser?.emailVerified) {
          setCurrentUser(null);
          setLoading(false);
          return;
        }
        try {
          await firebaseUser.reload();
          if (!firebaseUser.emailVerified) {
            await logout();
            return;
          }
          let result;
          try {
            result = await api.fetchMe();
          } catch (error) {
            if (
              error instanceof ApiError &&
              error.status === 403 &&
              error.message.includes("Create your verified Fable session")
            )
              result = await api.createSession();
            else if (
              error instanceof ApiError &&
              error.status === 403 &&
              error.message.includes("Workspace access required")
            ) {
              localStorage.removeItem("fable_workspace");
              result = await api.fetchMe();
            } else throw error;
          }
          if (active && currentGeneration === generation)
            setCurrentUser(result.user);
        } catch (error) {
          if (!active || currentGeneration !== generation) return;
          if (error instanceof ApiError && [401, 403].includes(error.status))
            await logout();
          else
            setSessionError(
              error instanceof Error
                ? error.message
                : "Cannot verify your session.",
            );
        } finally {
          if (active && currentGeneration === generation) setLoading(false);
        }
      },
      (error) => {
        if (!active) return;
        // Keep public pages available while displaying configuration errors in auth forms.
        if (error instanceof Error && error.message.includes("not configured"))
          setLoading(false);
        else {
          setSessionError(
            error instanceof Error
              ? error.message
              : "Authentication unavailable.",
          );
          setLoading(false);
        }
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [retry]);

  const handleAuth = (user: User) => {
    setCurrentUser(user);
  };
  const handleLogout = useCallback(() => {
    void logout()
      .then(() => setCurrentUser(null))
      .catch((error) =>
        setSessionError(
          error instanceof Error ? error.message : "Unable to log out.",
        ),
      );
  }, []);

  if (sessionError)
    return (
      <main className="min-h-dvh flex items-center justify-center p-6">
        <div className="brutal-card p-6 space-y-4">
          <p role="alert">{sessionError}</p>
          <button
            className="brutal-btn"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry connection
          </button>
          <button
            className="brutal-btn brutal-btn-outline"
            onClick={() => {
              handleLogout();
              setSessionError("");
            }}
          >
            Log out
          </button>
        </div>
      </main>
    );

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-paper)] flex items-center justify-center">
        <div className="brutal-card p-10 text-center">
          <div
            className="w-16 h-16 mx-auto flex items-center justify-center font-display text-3xl border-[3px] border-[var(--border)] mb-4"
            style={{
              background: "var(--accent-yellow)",
              boxShadow: "var(--shadow)",
            }}
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
      <AppBoundary>
        <Suspense
          fallback={
            <main
              role="status"
              className="min-h-dvh flex items-center justify-center p-6"
            >
              Opening Fable…
            </main>
          }
        >
          <Routes>
            <Route
              path="/"
              element={
                currentUser ? <Navigate to="/app" replace /> : <LandingPage />
              }
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
                  <Dashboard
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    onProfileUpdated={handleAuth}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppBoundary>
    </BrowserRouter>
  );
};

export default App;
