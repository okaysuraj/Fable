/** Email/password forms preserve input across verification, recovery and network failures. */
import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  register,
  login,
  resendVerification,
  resetPassword,
  authError,
} from "../services/firebase";
import { api } from "../services/api";
import { User } from "../types/chat";

interface LoginPageProps {
  onAuth: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onAuth }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode =
    searchParams.get("mode") === "register" ? "register" : "login";

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      if (mode === "register") {
        if (!name.trim()) {
          setError("Name is required");
          setLoading(false);
          return;
        }
        await register(email, password, name);
        setNotice(
          "Verification email sent. Open the link in your inbox, then log in.",
        );
        setPassword("");
        setMode("login");
      } else {
        await login(email, password);
        const res = await api.createSession();
        onAuth(res.user);
        navigate("/app");
      }
    } catch (err: unknown) {
      setError(authError(err));
    } finally {
      setLoading(false);
    }
  };

  const emailAction = async (kind: "reset" | "verify") => {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    if (kind === "verify" && !password) {
      setError("Enter your email and password to resend verification.");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      if (kind === "reset") {
        await resetPassword(email);
        setNotice(
          "If an account exists for this email, a password reset link has been sent.",
        );
      } else {
        await resendVerification(email, password);
        setNotice(
          "Verification email sent. Open the link in your inbox, then log in.",
        );
      }
    } catch (err) {
      setError(authError(err));
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
            aria-label="Back to Fable home"
            onClick={() => navigate("/")}
            className="w-14 h-14 flex items-center justify-center font-display text-3xl border-[3px] border-[var(--border)] cursor-pointer hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
            style={{
              background: "var(--accent-yellow)",
              boxShadow: "var(--shadow)",
            }}
          >
            F
          </button>
          <div>
            <h1 className="font-display text-3xl tracking-tight">FABLE</h1>
            <p className="font-mono-code text-xs text-[var(--ink-muted)] uppercase tracking-widest">
              {mode === "login" ? "WELCOME BACK" : "JOIN THE STUDIO"}
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="brutal-card p-8 space-y-6">
          <div className="flex border-[3px] border-[var(--border)]">
            <button
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`flex-1 py-3 font-display text-sm uppercase tracking-wider transition-colors ${
                mode === "login"
                  ? "bg-[var(--ink)] text-white"
                  : "bg-[var(--bg-card)] text-[var(--ink)] hover:bg-[var(--bg-card-alt)]"
              }`}
            >
              LOG IN
            </button>
            <button
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`flex-1 py-3 font-display text-sm uppercase tracking-wider border-l-[3px] border-[var(--border)] transition-colors ${
                mode === "register"
                  ? "bg-[var(--ink)] text-white"
                  : "bg-[var(--bg-card)] text-[var(--ink)] hover:bg-[var(--bg-card-alt)]"
              }`}
            >
              SIGN UP
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-2">
                <label
                  htmlFor="name"
                  className="font-display text-xs uppercase tracking-wider text-[var(--ink-secondary)]"
                >
                  YOUR NAME
                </label>
                <input
                  id="name"
                  autoComplete="name"
                  maxLength={80}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="brutal-input"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="font-display text-xs uppercase tracking-wider text-[var(--ink-secondary)]"
              >
                EMAIL
              </label>
              <input
                id="email"
                autoComplete="email"
                maxLength={254}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
                className="brutal-input"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="font-display text-xs uppercase tracking-wider text-[var(--ink-secondary)]"
              >
                PASSWORD
              </label>
              <input
                id="password"
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                maxLength={128}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="brutal-input"
                required
                minLength={mode === "register" ? 12 : 1}
              />
            </div>

            {notice && (
              <p
                role="status"
                className="p-3 border-[3px] bg-[var(--bg-card-alt)] text-sm"
              >
                {notice}
              </p>
            )}
            {error && (
              <div
                role="alert"
                className="p-3 border-[3px] border-[var(--accent-pink)] text-sm font-bold"
                style={{ background: "#FFE0E9" }}
              >
                ✕ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`brutal-btn w-full text-base py-4 ${loading ? "opacity-60 cursor-wait" : ""}`}
            >
              {loading
                ? "WORKING..."
                : mode === "login"
                  ? "ENTER THE STUDIO →"
                  : "CREATE ACCOUNT →"}
            </button>
          </form>
          {mode === "login" && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                className="brutal-btn brutal-btn-outline"
                disabled={loading}
                onClick={() => emailAction("reset")}
              >
                Forgot password?
              </button>
              <button
                type="button"
                className="brutal-btn brutal-btn-outline"
                disabled={loading}
                onClick={() => emailAction("verify")}
              >
                Resend verification email
              </button>
            </div>
          )}
        </div>

        <p className="text-center font-mono-code text-xs text-[var(--ink-muted)] mt-6 uppercase tracking-wider">
          YOUR WORKSPACE. YOUR CONVERSATIONS.
        </p>
      </div>

      {/* Decorative */}
      <div
        className="absolute top-20 right-20 w-32 h-32 border-[4px] border-[var(--border)] rotate-45 opacity-8 pointer-events-none hidden lg:block"
        style={{ background: "var(--accent-blue)" }}
      />
      <div
        className="absolute bottom-20 left-20 w-24 h-24 border-[4px] border-[var(--border)] -rotate-12 opacity-8 pointer-events-none hidden lg:block"
        style={{ background: "var(--accent-yellow)" }}
      />
    </div>
  );
};
