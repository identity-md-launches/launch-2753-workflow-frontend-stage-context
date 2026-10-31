import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { App } from "./App";
import { loadRuntime } from "./config";
import "./styles.css";
const root = createRoot(document.getElementById("root")!);
const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});
loadRuntime()
  .then((runtime) =>
    root.render(
      <WagmiProvider config={runtime.walletConfig}>
        <QueryClientProvider client={queryClient}>
          <App runtime={runtime} />
        </QueryClientProvider>
      </WagmiProvider>,
    ),
  )
  .catch(() =>
    root.render(
      <main className="startup-error">
        <h1>Trip data couldn’t load</h1>
        <p>
          The deployment manifest or attested ABI could not be verified. Check
          your connection and reload.
        </p>
        <button onClick={() => location.reload()}>Reload the trip</button>
      </main>,
    ),
  );
