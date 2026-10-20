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
      <main className="fable-landing fl-recovery">
        <h1>Fable needs to reload</h1>
        <p role="alert">This page could not be opened. Reload to try again.</p>
        <button className="fl-button" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </main>
    );
  }
}
