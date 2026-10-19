/** Public introduction and entry into the real authentication flow. */
import React from "react";
import { useNavigate } from "react-router-dom";

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--bg-paper)] relative paper-texture overflow-hidden">
      {/* ═══ NAV BAR ═══ */}
      <nav className="flex items-center justify-between px-8 py-5 relative z-10">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 flex items-center justify-center font-display text-2xl border-[3px] border-[var(--border)]"
            style={{
              background: "var(--accent-yellow)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            F
          </div>
          <span className="font-display text-2xl tracking-tight">FABLE</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="brutal-btn brutal-btn-outline brutal-btn-sm"
          >
            LOG IN
          </button>
          <button
            onClick={() => navigate("/login?mode=register")}
            className="brutal-btn brutal-btn-sm"
          >
            SIGN UP
          </button>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <main className="max-w-6xl mx-auto px-8 pt-16 pb-24 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — Copy */}
          <div className="space-y-8">
            <div
              className="inline-flex items-center gap-2 brutal-tag"
              style={{ background: "var(--accent-yellow)" }}
            >
              <span className="w-2 h-2 bg-[var(--accent-green)] rounded-full" />
              NOW IN BETA
            </div>

            <h1 className="font-display text-6xl md:text-7xl lg:text-8xl leading-[0.9] tracking-tight">
              TALK
              <br />
              <span className="text-[var(--accent-pink)]">BOLD.</span>
              <br />
              BUILD
              <br />
              <span className="text-[var(--accent-blue)]">LOUD.</span>
            </h1>

            <p className="text-lg text-[var(--ink-secondary)] max-w-md leading-relaxed font-medium">
              A shared workspace for creative studios. Keep conversations
              organized and build together.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={() => navigate("/login?mode=register")}
                className="brutal-btn text-base px-8 py-4"
              >
                GET STARTED →
              </button>
              <button
                onClick={() => navigate("/login")}
                className="brutal-btn brutal-btn-outline text-base px-8 py-4"
              >
                I HAVE AN ACCOUNT
              </button>
            </div>
          </div>

          {/* Right — Feature Cards Stack */}
          <div className="space-y-5">
            <h2 className="font-display text-lg">STUDIO ARSENAL</h2>
            {[
              {
                title: "TEXT CHANNELS",
                desc: "Organized rooms for every topic. Share messages and reactions with your team.",
                accent: "var(--accent-yellow)",
                icon: "#",
              },
              {
                title: "PRIVATE ROOMS",
                desc: "Choose who can join the conversation, and manage membership in one place.",
                accent: "var(--accent-pink)",
                icon: "◉",
              },
              {
                title: "MESSAGE HISTORY",
                desc: "Find earlier conversations with full-history search, and pin messages you need again.",
                accent: "var(--accent-blue)",
                icon: "▶",
              },
              {
                title: "SHARED WORKSPACES",
                desc: "Invite your team, manage roles, and keep separate projects in their own spaces.",
                accent: "var(--accent-green)",
                icon: "~",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="brutal-card p-6 flex items-start gap-5 hover:translate-x-0 hover:-translate-y-0.5 transition-transform"
              >
                <div
                  className="w-14 h-14 flex items-center justify-center font-display text-2xl border-[3px] border-[var(--border)] shrink-0"
                  style={{
                    background: feature.accent,
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-display text-lg tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-[var(--ink-secondary)] mt-1 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ═══ BOTTOM STRIP ═══ */}
      <footer className="border-t-[3px] border-[var(--border)] bg-[var(--ink)] text-white py-6 px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 flex items-center justify-center font-display text-sm border-[2px] border-white"
              style={{
                background: "var(--accent-yellow)",
                color: "var(--ink)",
              }}
            >
              F
            </div>
            <span className="font-mono-code text-sm text-white/60">
              FABLE STUDIO © 2026
            </span>
          </div>
          <p className="font-mono-code text-xs text-white/70 uppercase tracking-wider">
            CONVERSATIONS FOR CREATIVE TEAMS
          </p>
        </div>
      </footer>

      {/* ═══ DECORATIVE ELEMENTS ═══ */}
      <div
        className="absolute top-32 -right-16 w-64 h-64 border-[4px] border-[var(--border)] rotate-12 opacity-10 pointer-events-none"
        style={{ background: "var(--accent-yellow)" }}
      />
      <div
        className="absolute -bottom-20 -left-20 w-80 h-80 border-[4px] border-[var(--border)] -rotate-6 opacity-8 pointer-events-none"
        style={{ background: "var(--accent-pink)" }}
      />
    </div>
  );
};
