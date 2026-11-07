import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { ErrorBoundary, Recovery } from "./Recovery";
import { App } from "./App";
import { loadRuntime } from "./config";
import "./fonts.css";
import "./styles.css";
const root = createRoot(document.getElementById("root")!);
const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});
loadRuntime()
  .then((runtime) =>
    root.render(
      <ErrorBoundary>
        <WagmiProvider config={runtime.walletConfig}>
          <QueryClientProvider client={queryClient}>
            <App runtime={runtime} />
          </QueryClientProvider>
        </WagmiProvider>
      </ErrorBoundary>,
    ),
  )
  .catch(() => root.render(<Recovery startup />));
