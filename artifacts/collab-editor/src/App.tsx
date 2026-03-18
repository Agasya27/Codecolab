import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import EditorPage from "./pages/EditorPage";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/not-found";
import { useEffect, Component, ReactNode } from "react";

const queryClient = new QueryClient();

// Error boundary so a crash shows a message rather than a blank screen
class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null; stack: string | null }> {
  state = { error: null, stack: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  componentDidCatch(_error: Error, info: { componentStack: string }) {
    this.setState({ stack: info.componentStack || null });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#0d1117', color: '#f85149', padding: 40, fontFamily: 'monospace', height: '100vh' }}>
          <h2 style={{ color: '#e6edf3', marginBottom: 12 }}>Something went wrong</h2>
          <pre style={{ fontSize: 13, color: '#f85149', whiteSpace: 'pre-wrap' }}>{this.state.error}</pre>
          {this.state.stack && (
            <pre style={{ marginTop: 12, fontSize: 12, color: '#7d8590', whiteSpace: 'pre-wrap' }}>{this.state.stack}</pre>
          )}
          <button
            style={{ marginTop: 20, padding: '8px 16px', background: '#2f81f7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            onClick={() => { this.setState({ error: null, stack: null }); window.location.reload(); }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/editor" component={EditorPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (!import.meta.env.PROD) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) {
          void reg.unregister();
        }
      });
      return;
    }

    navigator.serviceWorker.getRegistrations().then(regs => {
      // Unregister any stale SWs from old cache names
      for (const reg of regs) {
        if (reg.active?.scriptURL.includes('sw.js')) {
          // Post SKIP_WAITING so new SW activates immediately
          reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
          reg.active?.postMessage({ type: 'SKIP_WAITING' });
        }
      }
    });

    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          newSW?.addEventListener('statechange', () => {
            if (newSW.state === 'installed') {
              newSW.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(err => console.warn('SW registration failed:', err));
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
