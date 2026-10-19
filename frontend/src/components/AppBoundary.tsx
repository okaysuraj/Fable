/** A render failure offers recovery without inventing a successful application state. */
import { Component, type ReactNode } from "react";

export class AppBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="min-h-dvh flex items-center justify-center p-6">
        <div className="brutal-card max-w-md p-6 space-y-4">
          <h1 className="font-display text-xl">Fable needs to reload</h1>
          <p role="alert">
            This screen could not be opened. Check your connection and reload to
            continue.
          </p>
          <button
            className="brutal-btn"
            onClick={() => window.location.reload()}
          >
            Reload application
          </button>
        </div>
      </main>
    );
  }
}
