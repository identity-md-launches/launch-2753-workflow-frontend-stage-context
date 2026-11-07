import { Component, type ErrorInfo, type ReactNode } from "react";
import { Hamster } from "./art";
export function clearAppStorage() {
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[name];
      const keys = Array.from({ length: storage.length }, (_, i) =>
        storage.key(i),
      );
      for (const key of keys)
        if (key && /^(wagmi\.|hrt-|cbwsdk\.)/.test(key))
          storage.removeItem(key);
    } catch {
      /* Storage can be disabled in a private browser. */
    }
  }
}
export function Recovery({ startup = false }: { startup?: boolean }) {
  return (
    <main className="startup-error">
      <Hamster />
      <h1>{startup ? "Trip data couldn’t load" : "Squeek hit a bump"}</h1>
      <p>
        {startup
          ? "The deployment or voting interface could not be verified. Check your connection and reload."
          : "The trip is safe. Reset this site’s saved connection and reload to watch again."}
      </p>
      <button
        className="primary"
        onClick={() => {
          clearAppStorage();
          location.reload();
        }}
      >
        Reset and reload
      </button>
      <p className="small muted">
        Only this app’s wallet and trip cache is cleared.
      </p>
    </main>
  );
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* Recovery stays independent of wallet state. */
  }
  render() {
    return this.state.failed ? <Recovery /> : this.props.children;
  }
}
