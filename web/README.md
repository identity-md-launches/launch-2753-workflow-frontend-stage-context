# Squeek’s First Road Trip frontend

React 19, TypeScript, Vite, wagmi 2, viem, TanStack Query and the existing MapLibre/OpenFreeMap map. Existing package manifests, lockfiles, dependencies and Vite configuration are preserved.

## Build and preview

From the repository root, run `npm --prefix web ci`, `npm --prefix web run build`, then `npm --prefix web run preview`. `npm --prefix web run typecheck` and `npm --prefix web test` run separately. The build exports to repo-root `dist/` with Vite base `./`, copies the unchanged ABI, checks its pinned hash and verifies all asset hashes. `node web/scripts/serve.mjs` serves the export at `/preview/` for gateway testing.

The browser regression suite is `npm --prefix web run test:browser`. A normal developer installation can use the existing Playwright dependency and its browser runtime. On the contributor runtime, set the supplied `IMD_PLAYWRIGHT` module path and `PLAYWRIGHT_BROWSERS_PATH` when invoking it. Evidence goes to `test/scratch/browser-tests/` and is not required by the build. No dependency archives, caches or browser binaries are shipped.

## Wallet restoration and spectators

`config.ts` uses `createStorage` with the versioned prefix `wagmi.squeek-v3`. Older `wagmi.store` connections are ignored. Wagmi’s `isConnected` can be true while `status` is `reconnecting`; the UI requires `status === "connected"` for wallet-dependent actions. Components never invoke `connector.getProvider()`. Network switching gets a wallet client through wagmi only after checking a fully connected, functional connector, and handles unknown-chain addition followed by an explicit switch.

The public client has only the three public RPC transports in `imd-deployment.json`, with fallback and retry. No wallet transport is part of a read path. `readSnapshot` reads the public ballot and route at one block. The connected account’s ballot and balance are a separate query: a broken wallet cannot remove the trip. History uses confirmed `Voted` and `Finalized` events, adaptive block chunks and an incremental in-memory cache starting at the pinned deployment block. Unknown history remains unavailable, never a zero ranking.

`Recovery.tsx` wraps the whole provider/app tree. Its reset removes only keys beginning `wagmi.`, `hrt-` or `cbwsdk.` from local and session storage, then reloads. Storage failures are caught, including in private contexts.

EIP-6963 lists named extensions individually; the generic injected row is hidden when named extensions exist. The same sheet offers Coinbase Smart Wallet. Mobile browsers without injection get MetaMask, Coinbase Wallet, Rabby and Phantom links to open this page inside their wallet browser. No WalletConnect project id, relay or backend is required. Wallet connection, simulation, review, wallet approval, pending receipt, confirmation and failure are separate states. No wallet is needed to view any page or select a destination. One vote per wallet per UTC day is enforced by the unchanged contract; votes cannot be changed.

## Journey, passport and history

The existing wheel parser is preserved: only a snapshot whose work is fully covered by settled work moves the marker. Distance is multiplied by 100; unused distance waits for a route. OSRM road geometry is cached. NoRoute/NoSegment uses a great-circle air crossing and a plane icon; an unavailable routing service pauses progress. A consecutive stay in the same place consumes no distance. A pause control and reduced-motion preference stop travel and wheel animations.

`landmarks.ts` defines 64 distinct silhouettes in permanent destination-id order. `Postcards.tsx` applies one shared kit: regional gradient, ground, existing Squeek sprite and postcard frame. Passport labels are real HTML at readable sizes, alongside the SVG illustration. Visited stops unlock; unvisited stops show locked silhouettes. Selecting any locked postcard offers that destination on the ballot.

Postcards show the leg distance, winning votes, finalizing transaction and the date this browser first observed the arrival. The contract has no arrival event, so this is explicitly labeled **Arrival observed**, with its limitation explained in the UI. It is not an invented historical arrival time. Optional `hrt-arrivals-v3` records these observations; `hrt-last-seen-v3-<chain>-<contract>` stores a confirmed block for returning-visitor recaps. Storage is optional and never treated as vote evidence. Exact historical arrival dates cannot be recovered from the supplied data.

Consecutive same-city wins are grouped as “Day 2 in [City]” while preserving every underlying epoch. Navigator names/avatars derive from addresses; points and best consecutive UTC-day winning streaks derive from events. A completed 64-stop passport has a completion state, and all queued stops reached is distinguished from all 64 visited. The live contract has no terminal flag, so voting remains available after a full passport.

Downloads render the self-contained postcard SVG to an 800×650 PNG in the browser; share text is prefilled and copyable. No external images are needed. Google Fonts (DM Sans and Pixelify Sans) are bundled with their SIL Open Font Licenses. `public/share.png` is rendered from the local SVG social card; it is a preview asset, never a remote image in the interface.

See [delivery](../docs/frontend/REVISION-DELIVERY.md), [validation](../docs/frontend/REVISION-VALIDATION.md) and [design](../DESIGN.md) for this revision. No contract, address, ABI, deployment identity or prior vote changed. Only the manifest’s presentation asset inventory is regenerated.
