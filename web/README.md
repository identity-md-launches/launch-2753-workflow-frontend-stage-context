# Squeek’s First Road Trip frontend

A static React/TypeScript community game for the attested `RoadTripVotes` deployment. Visitors can watch without a wallet, choose among 64 permanent destination ids, vote once per UTC day, and finalize the oldest ended voting day. No contract changes or deployments are part of this frontend.

## Install, develop and export

Use Node 22.12+ (this revision tested with Node 22.22.2 and npm 10.9.7).

```sh
npm --prefix web ci
npm --prefix web run typecheck
rm -rf dist/assets
(cd web && npm exec -- vite build --emptyOutDir false)
npm --prefix web run dev
```

The development server serves the **same** `dist/imd-deployment.json` and attested ABI files as the production export, through the middleware in `vite.config.ts`. Rebuild once with the commands above before starting development. React source changes then reload normally.

Preview the production build:

```sh
npm --prefix web run preview
```

For a gateway-style subpath preview instead, run `node web/scripts/serve.mjs` from the repository root and open `http://localhost:4173/preview/`. Stop it with Ctrl+C.

The publisher can host the contents of root `dist/` as ordinary files, including under a gateway subpath. Vite uses `base: './'`; navigation uses page anchors. Nothing needs server rewrites, environment variables, API keys, a relay, a database or a backend. Watching still requires network access to the public data services.

## Deployment configuration and ABI provenance

`web/deployment/handoff.json` and `web/deployment/network.json` preserve the supplied handoff and network table as **build inputs**. They are not an alternative runtime address map. The running app fetches `dist/imd-deployment.json`, then its referenced ABI JSON, and checks the ABI's canonical Keccak hash before creating clients.

The inherited `npm run build` script typechecks, exports to root `dist/`, then performs the following original manifest-generation workflow. **Do not use that script for this copy revision:** it would regenerate the protected `imd-deployment.json`. The Vite command above rebuilds the site while retaining the original config and ABI unchanged.

Original workflow:

1. Reads `docs/abi/RoadTripVotes.json` from the deployed source commit with `git show` and verifies the working copy is byte-identical. Keep that commit in the clone's history.
2. Computes Keccak-256 of compact JSON with recursively sorted object keys, preserving array order, and compares it to the handoff's ABI hash.
3. Copies the ABI as a raw JSON array into `dist/abi/`.
4. Emits the exact handoff identifiers and contract set, and unchanged network / wallet-add-chain blocks. A handoff pool key is copied if present; this application handoff has none.
5. Hashes every other exported file with SHA-256, including HTML, ABI, SVGs, CSS and JavaScript. The manifest excludes itself.
6. Independently checks the schema's allowed keys, handoff equality, paths, ABI binding, complete asset inventory and response-size headroom.

The original `npm --prefix web run verify` requires the manifest inventory and every exported byte to match. This revision must preserve the manifest exactly, so that inventory remains historical and this command reports changed presentation assets. The current presentation inventory is documented separately in `docs/frontend/export-files.json`; it is not runtime configuration. All contract addresses, chain ids, ABIs and public RPC settings used by the app come from that manifest. Only presentation/service settings (SCALE, Miami origin, Squeekchain API and map/routing URLs) live in `src/config.ts`.

Before enabling transactions the app checks RPC chain id, nonempty deployed code, `epochSeconds = 86400`, `destinationCount = 64`, current reads, connected account and wallet chain. It simulates each transaction before review and again before requesting a signature. No ETH value is sent to the contract. Fees use Sepolia test ETH; a configured faucet is linked. No USD price source was supplied, so the app states that USD context is unavailable.

## Wallets

The single header control opens a native dialog with EIP-6963-discovered browser wallets and Coinbase Wallet through wagmi's SDK connector. Named extensions replace the generic row. On a phone without an injected provider it offers MetaMask, Coinbase Wallet, Rabby and Phantom browser links, plus Coinbase Smart Wallet. Inside a wallet's browser it uses the injected connection directly. No WalletConnect project id or relay is configured.

Unknown chains trigger `wallet_addEthereumChain` only after an unknown-chain switch failure, with the exact supplied parameters, followed by another switch. Wrong-chain writes remain disabled. Public RPC transports fall back in their configured order, then to the connected wallet only after verifying its chain. Disconnection removes that fallback.

## Wheel distance and trip rules

The endpoints were confirmed from the [Squeekchain API reference](https://docs.squeekchain.com/developers/api/), not guessed. `src/wheel.ts` reads `/v1/core`, `/v1/status` and `/v1/measurement/stats?range=30d`. It checks supported response versions, required counters, chain and matching installation identities. Unavailable or malformed data stays unknown.

The API exposes settled work and observed distance separately, without a documented fixed work-to-distance conversion. **A distance snapshot moves the solid marker only when all work behind it is settled.** Otherwise the last accepted distance is held, or an initial waiting state is shown. No provisional ghost is used. The API's reported distance is an estimate; the app invents no wheel calibration.

The off-chain journey uses that installation's lifetime distance, multiplied by the single `GAME.scale` value (100). The route always starts at Miami Beach. Unused distance waits for a queued stop. This deterministic distance-budget choice avoids giving each visitor a different starting baseline. It means a newly finalized stop can immediately consume previously settled work. The budget, cards and completion states are display calculations, not contract storage. No actual arrival timestamp is invented: postcards identify the voting date and stop order.

Road geometry comes from the free [OSRM route service](https://project-osrm.org/docs/v5.5.1/api/), cached in localStorage when available. `NoRoute` / `NoSegment` results use a great-circle crossing with an original ship icon. Service failures pause route loading; they do not invent crossings. OpenFreeMap vector tiles provide the dark map with visible OpenFreeMap, OpenMapTiles and OpenStreetMap attribution. All game artwork is original SVG/CSS; no remote images, fonts, sprites or logos are needed for the scene. Wallet-discovered icons belong to the visitor's provider.

## Live state and observability

Contract reads refresh every 15 seconds and after successful receipts. The ballot uses a consistent block for its 64 tallies, totals, leader, queue, wallet ballot and balance. Old or failed reads disable voting. The countdown follows chain time, and warns near midnight that inclusion in the next day counts for that day.

Navigator points are reconstructed from `Voted` events matching finalized winners, using a route and event range at least 12 blocks behind the tip. Creation is located by binary-searching deployed code, with a browser cache for that block; logs are paginated with smaller ranges on provider failures. A failed index is shown as unavailable, never an empty or fabricated ranking. No seeded players are shipped. The “Trip data & contract” disclosure shows sources, block numbers, refresh times, full checksummed contract address, explorer/copy controls and manifest link.

## Validation

```sh
npm --prefix web run typecheck
npm --prefix web test
rm -rf dist/assets
(cd web && npm exec -- vite build --emptyOutDir false)
npm --prefix web exec -- playwright install chromium webkit
npm --prefix web run test:browser
node web/tests/visual.mjs
node web/scripts/check-chain.mjs
```

The browser scripts manage their own temporary preview server and close it. On Linux, install Playwright's required system libraries on a machine where that is allowed. Tests write scratch output under `test/scratch/`; the live visual check writes its deliverable evidence under `docs/frontend/`. `check-chain.mjs` and `visual.mjs` accept an optional RPC transport argument for worker-side verification; it is never bundled or saved as public configuration.

See [revision validation](../docs/frontend/REBRAND-VALIDATION.md), [design system](../DESIGN.md), and the JSON reports and screenshots beside them. The prior implementation review remains in [VALIDATION.md](../docs/frontend/VALIDATION.md) as historical evidence; its earlier build and environment claims are not results of this revision.

Real wallet signatures, funded transactions, physical phone app handoffs, passkey enrollment and publication are not certified by the tests. No real transactions were broadcast. GitHub publication, IPFS pinning and site naming belong to the publisher after source delivery.

No ignore file is changed in this revision. The existing `web/.gitignore` has an explicit frontend path budget. It excludes dependency, build-cache and browser-report folders at every nesting level under `web/`. No node_modules, npm cache, browser binaries, vendored registry, tarball archives or submodules are deliverables.
