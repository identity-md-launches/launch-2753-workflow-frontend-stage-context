# Frontend validation

Validated on 31 October 2026. These are worker observations and reproducible self-checks, not independent certification. No real transaction was broadcast. The published GitHub URL, IPFS CID, named entrypoint and control-plane publication checks belong to the next stage.

## Result

| Area | Result |
| --- | --- |
| Approved frontend requirements below | 19 met; 0 missing; 0 faked |
| Broken features observed in final checks | 0 |
| Product, wallet and main action on first screen at 390px | Yes; vote button bottom 533.17 CSS px |
| Typecheck and production build | Passed |
| Logic tests | 14 passed |
| Browser checks | 20 passed, including Chromium and WebKit |
| Automated accessibility scan | 0 violations in the tested read-only state |
| taste@1 | 15/16 raw passes; uppercase-heading flag is required by the brief |
| Remaining copy findings | 0 observed |
| Share metadata | Title, favicon, description, og:title and local original SVG og:image present |
| Runtime configuration / ABI / asset hashes | Passed; 10 inventoried assets, 2,551,791 exported bytes including manifest |
| Scope exception | Design documentation is `docs/DESIGN.md`; root `DESIGN.md` is prohibited by the overriding path rules |

## Requirements traced to the implementation

| Approved requirement | Status and evidence |
| --- | --- |
| “static, no backend” and “read-only without a wallet” | Met. Runtime public reads and map work disconnected; production export tested under `/preview/`. |
| “Reads the deployed contract address and ABI from the deployment config” | Met. `config.ts` loads the exported manifest and referenced ABI, verifies canonical Keccak, then constructs clients. Modified ABI browser test fails closed. |
| “24-hour epochs” and “each wallet votes once” among ids 0–63 | Met. Live immutable checks, native 64-choice ballot, wallet ballot guard and simulation; successful mocked receipt locks repeat voting. |
| “When an epoch ends” the winner joins the queue; ties lowest id | Met. The contract determines winners. `pendingEpoch()` supplies the oldest eligible day to the permissionless finalization control. Mocked call arguments and receipt refresh checked. |
| “starting at Miami Beach” and “real wheel km x SCALE” | Met. Miami origin and one SCALE=100 setting; settled snapshot distance drives route replay. Lifetime-budget interpretation is explicit in the README and data disclosure. |
| “If the queue is empty or the wheel is idle” the hamster rests | Met. Closed-eye / sleeping SVG, idle story, running wheel spokes and feet when active with a next leg. Pause/resume and reduced motion checked. |
| “Arriving at a stop shows a postcard” and “trip log” | Met. Settled-arrival test generates the place, original fact, pixel icon and ordered log. Unknown distance does not invent zero arrivals. |
| “Navigator leaderboard” ranks matching winning votes | Met. Confirmed `Voted` logs are matched to a route read at the safe block. The browser arrival test verifies one real-fixture event becomes one point; no seeded users. |
| “Confirm exact endpoints” and “solid marker uses settled work only” | Met. Documented Squeekchain endpoints, schema/identity/counter checks, complete-snapshot settlement gate. Unit tests cover provisional hold, mismatch, unavailability, backwards counters and stale telemetry. |
| “Leaflet or MapLibre” with an open provider and attribution | Met. MapLibre with OpenFreeMap vector tiles; visible OpenFreeMap, OpenMapTiles and OpenStreetMap credits. No openstreetmap.org tile requests. |
| Free routing service, cached roads, great-circle ocean crossings and icon | Met. OSRM, optional localStorage cache, great-circle `NoRoute` / `NoSegment` paths with ship markers. Outages pause instead of pretending there is no road. Logic and rendered fixture checks cover the paths. |
| “64 family-friendly places worldwide” with data and facts | Met. Permanent ids in `destinations.ts`; coordinates, regions, countries and original geographic captions. Unit test checks count, ids, uniqueness and coordinate bounds. |
| “wallet connect” | Met. EIP-6963 extensions, phone wallet-browser links and Coinbase SDK connector. Missing-wallet, rejection, phone in-app injection and unknown-chain add/switch flows checked. |
| Countdown, “live vote counts” and “route queue” | Met. Block-consistent tallies and queue, UTC countdown, 15-second refresh and post-receipt invalidation. Read failures disable writes and expose retry. |
| “Sepolia test ETH”, faucet and “No free-text player input” | Met. Review shows zero contract value, estimated gas and gas balance; configured faucet linked. Game controls are selects/buttons only. No token, swap or approval flow was invented. |
| Dark retro LED, neon accents, original pixel art, SVG/CSS/canvas | Met. Original wheel/hamster/landmarks/ship, dot grid, dotted route, dark vector map and LED postcard panels. No external scene images or fonts. |
| “Mobile-first”, large buttons and readable first screen | Met. Ballot precedes map on phones. 320/390/800/1440px, large counters, full address and wallet sheet checked without sideways overflow. Main action at 390 is visible before scrolling. |
| Metadata: title, favicon, description, og:title, og:image | Met. Probe checks all five. Image path is relative pending publisher hostname; social platform SVG-unfurl behavior is not certified. |
| Source, lockfile, static export and validation evidence | Met. Vite/React/TypeScript under `web/`, export under `dist/`, reproducible checks and documentation under `docs/` and `web/`. Exact manifest, network and ABI binding checked. |

Contract deployment, its Foundry tests, its independent review and subsequent GitHub/IPFS publication are not this frontend worker's deliverables. The deployed Solidity, ABI source and root configuration remain unchanged.

## Commands and test coverage

Final commands included `npm --prefix web run build`, standalone `typecheck`, `test`, `test:browser`, `node web/tests/visual.mjs`, `node web/scripts/check-chain.mjs` and `node web/scripts/verify-export.mjs`. The required probe was run from the repository root:

```sh
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

Playwright was installed as a frontend dev dependency; browser binaries and missing WebKit libraries were installed/unpacked only in temporary storage. WebKit needed a temporary software-EGL setup because the worker had no default EGL platform. No system configuration, browsers, dependency trees or package caches are submitted. The development server's manifest and ABI endpoints were also compared byte-for-byte with the export, then the server was stopped.

The 14 logic tests cover atlas invariants, complete settlement gating, held provisional progress, invalid/backwards data, stale telemetry, road cache, legitimate no-road fallback, routing outages, dateline interpolation, path-length positioning, ordered arrival replay, chain-add parameters, rejected switches and readable ABI/wallet errors.

The 20 browser checks cover first-screen read-only behavior, destination selection and all-place filtering, native-dialog keyboard escape/focus restoration, EIP-6963, exact unknown-chain add/switch, phone app links, phone in-app connection, missing wallets, rejected connection/switch/signature, simulated vote and finalization arguments, review and gas information, pending lock through a delayed receipt, reverted receipt recovery, custom errors, wheel outage with and without a route, missing contract code, modified ABI, large-value reflow, accessibility/reduced motion, settled postcards/crossings/points and the WebKit review flow. Wallet and RPC responses for transactions were mocked; no funds or private keys were used.

The live visual script inspected the production export at 320, 390, 800 and 1440px. All four had `scrollWidth == viewport width`, live epoch reads, loaded map tiles and no script/local-resource errors. It additionally checked modal focus, visible focused sheet screenshot, global pause/resume, reduced motion and 200% text enlargement. Text enlargement is not a native browser zoom test.

## Better Interface review across six domains

The visual idea is one shared LED atlas: a small pixel wheel on a dark map, with the community ballot directly beside it or above it on phones.

| Domain | Coverage and result |
| --- | --- |
| Accessibility | Native buttons/selects/dialog/details, landmark and heading structure, names, focus, Escape/return, large targets, persistent errors and reduced motion reviewed. Chromium axe scan has zero violations in the tested read-only state. This is not a screen-reader session or a full compliance claim. |
| Layout | Real screenshots and DOM geometry at 320, 390, 800 and 1440px; stress fixture with large counts, full contract address and open sheet. No horizontal overflow. Loading labels were changed to a vertical stack. 200% text enlargement passed. |
| Writing | Action labels, wallet prerequisites, gas explanation, refusal/error recovery, empty and unavailable states reviewed against handlers. No fake players, prices, balances, arrival timestamps or sample live counters. |
| Typography | Six declared sizes, at most six at a measured viewport, three weights and three computed families including map credits. Headline is largest/heaviest; sans body, mono headings/data, stable countdown digits and wrapping numeric values. Exact installed font files vary by platform. |
| Colors | Probe-measured solid pairs all pass WCAG 4.5:1 / 3:1 large. At 390px, smallest measured ratio is 6.63:1; ballot heading 15.85:1, supporting ballot text 9.22:1, amber countdown 10.41:1. Fifteen canvas/gradient-backed text boxes are excluded by the probe and remain unmeasured. |
| UI | Hover/focus/pressed/disabled/loading/review/pending/success/reverted/rejected/unknown states reviewed; border/surface hierarchy, original icons, restrained motion and global animation pause checked. No `transition: all`, border+shadow panels or nested content cards. |

The probe reports four controls below the 44px comfort recommendation, primarily compact map attribution links. They meet its 24px-or-spacing check. Its only raw failure is casing. The brief explicitly requests “uppercase monospace or condensed headings”, so the six uppercase heading boxes are intentional; this exception does not excuse small tracked kicker labels (none were found). First-phone-screen prose was 29 words, under the 60-word bar.

## Findings and corrections

| Finding | Final source / correction | Evidence |
| --- | --- | --- |
| Layout risk: very large tallies could squeeze a place name or escape its row | `web/src/styles.css:545`, `.chosen-votes` and its value wrap within a bounded share; summary/card values also wrap | Final stress test passes at all four widths with full address and open sheet. This was a preventive source finding, not a claimed prior measured overflow. |
| Bug: map loading message covered part of the origin label | `web/src/styles.css:368`, `.map-info` stacks messages and legend with an 8px gap | Observed on the initial desktop loading screenshot; corrected structure reviewed and final rendered/probe layout passes. |
| Accessibility: pause did not cover every sleeping illustration | `web/src/styles.css:1436`, global `data-motion="paused"` descendant guard | Live pause test finds zero running CSS animations; resume restores them, reduced motion stops them again. |
| Bug: a phone with a generic injected provider could be sent back to app links | `web/src/Wallet.tsx:97`, app-link mode now also requires `!window.ethereum` | Phone-in-wallet browser test connects directly; phone without provider gets four deep links and Smart Wallet. |
| Truthfulness: an unavailable distance could imply zero arrivals | `web/src/App.tsx:115`, `hasDistance` gates completion counters, progress text and postcard history | Nonempty-route outage test shows unknown completion/history and no fabricated postcard. Last known distance is retained on later feed failure. |
| Probe casing flag | `web/src/styles.css`, uppercase heading policy retained | Explicit brief exception, documented above; no unresolved requirement failure. |

The corrections were followed by a final production build, integrity verification and browser/probe reruns. `docs/DESIGN.md` describes the final source rather than proposed changes.

## Chain and artifact evidence

`chain-check.json` records chain 11155111, 2,714 runtime-code bytes, successful deployment at block 12029967, the exact handoff address and immutable settings. Reads were performed using the contributor-provided worker transport; the report names the configured public RPC source as required. No worker-only transport is in the export.

`build-report.json` binds the final manifest hash, build result, ABI hash, byte count and asset count. `taste-checks.json`, `interaction-results.json`, `axe-violations.json` and `visual-checks.json` preserve machine-readable observations. Screenshots in `screenshots/` show real public read-only state, the responsive wallet sheet, and a separately named **simulated** journey with arrivals and points. The simulated screenshot uses blank fixture map tiles and is not presented as live data.

## Limits and unperformed checks

- No real wallet signature, gas expenditure, transaction replacement on a real chain or real vote/finalization was tested. Simulations and receipts in interaction tests are fixtures.
- Coinbase/passkey account enrollment, phone application installation/opening and physical iOS/Android hardware handoffs were not performed. Their rows and URL encodings were checked; WebKit is an engine test, not a physical iPhone.
- No screen-reader, native 200% browser zoom, RTL localization, forced-colors mode or 10%-speed animation-panel review was performed. The app ships one English dark theme.
- A cold browser waits for a fully settled distance snapshot if the observed snapshot includes pending work. This conservative gate can delay progress. No undocumented wheel circumference is assumed.
- Arrival replay uses the reporting installation's lifetime distance budget and browser-cached routing geometry. There is no on-chain arrival register or immutable routing oracle; fresh route-service data or clearing the cache can change geometric leg distances. This is a display game, and the data disclosure explains its basis.
- Historical leaderboard reads depend on archive/log-capable public RPCs. Failures show unavailable rankings; the app does not substitute locally fabricated global history.
- API availability, future schema changes, external routing/tile availability, publication/hosting and social-platform support for SVG previews remain external limits. The manifest's relative metadata is ready for static hosting; absolute domain metadata can only be finalized by the publisher.
- npm emits a legacy transitive React peer warning and Rollup emits removable upstream annotation / large-chunk warnings. Build, typecheck, interactions and the byte budget pass; no offline npm registry is required or vendored.

## Attribution and scope

Pinned Better Interface and Impeccable guidance was applied during construction and this six-domain review. Their original MIT / Apache-2.0 notices are preserved in `licenses/Better-Interface-Impeccable.txt`. Ethereum UX guidance is adapted from Austin Griffith's ethskills at `06ea4efa08076ff04f6ca4945ef4a2ca881115b0` under the MIT notice in `licenses/eth-frontend-ux.txt`.

Map setup was checked against [OpenFreeMap's guide](https://openfreemap.org/quick_start/). Routing parameters follow [OSRM's API](https://project-osrm.org/docs/v5.5.1/api/). Wheel endpoint and unit definitions come from [Squeekchain's API documentation](https://docs.squeekchain.com/developers/api/). Rabby's mobile URL was checked against its [release link configuration](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/constant/universalLink.ts) and [open-dapp handler](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/hooks/universalLink.ts).

Only `web/**`, root `dist/**` and `docs/**` are submitted. `web/.gitignore` has the explicit supplied path budget; it excludes generated dependency/cache folders at every frontend nesting level. Tool-generated browser artifacts outside scope were moved to disposable `test/scratch/`. No contract source, root build configuration, root lockfile, library, submodule or CI file changed.
