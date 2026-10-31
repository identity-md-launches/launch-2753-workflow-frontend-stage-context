# Squeek’s First Road Trip revision validation

Checked on 31 October 2026 against the production export in `dist/`, served under `/preview/`. These are worker self-checks, not independent certification. This revision changes presentation copy, accessibility text, metadata, SVG labels and documentation. No transaction was broadcast and no contract was deployed.

## Scope and outcome

- The page title, loading fallback, header and footer, hero description, help dialog, map section/control, completed-route message, wallet application name and documentation use **Squeek’s First Road Trip** or **Squeek**, with the typographic apostrophe `’`.
- The tagline remains **Small wheel. Big world.** The share SVG retains its original artwork and layout, with the revised name and “Squeek powers the trip.” Explicit Open Graph/Twitter titles, descriptions and image alternatives match; the favicon has the new accessible title.
- Contract source/address/ABI, deployment handoff, network settings, `imd-deployment.json`, endpoints, data reads, code identifiers, CSS, layout, build configuration and dependencies are unchanged. A TypeScript syntax-tree comparison confirms that the three changed runtime source files differ only in string/JSX text, with identical identifiers and logic structure.
- The static export contains 11 files totaling **2,552,648 bytes**. `index.html` uses relative JavaScript/CSS/favicon/share paths and existing anchor navigation. The committed frontend manifest and lockfile are retained unchanged. No dependency tree, package archive, cache or browser binary is included.

## Actual checks

| Check | Actual result |
| --- | --- |
| `npm --prefix web ci` | Passed using the existing lockfile; legacy peer/deprecation warnings, no dependency changes. |
| `npm --prefix web run typecheck` | Passed, exit 0. |
| `npm --prefix web test` | Passed, 14 existing logic tests. |
| `cd web && npm exec -- vite build --emptyOutDir false` | Passed, exit 0; 5,341 modules; 23.04 seconds. Existing annotation and large-chunk warnings remain. Old generated chunks were removed first. |
| `npm --prefix web run test:browser` | Passed, exit 0: **20 existing checks**, including Chromium and WebKit. Fixture wallets/RPCs; no funded account or signing key used. See `interaction-results.json`. |
| `node web/tests/visual.mjs` | Passed, exit 0; live public chain/wheel/tile reads, four viewport widths, dialog focus, pause/resume, reduced motion and 200% text enlargement. |
| `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | Ran using the frontend Playwright module. **15/16** checks pass; sole raw failure is existing uppercase headings, retained under “Keep all current behaviour, layout, styling and data reads unchanged.” |
| Additional scratch copy/invariant check | Passed: rendered text, aria/alt/title attributes, metadata, loading without JavaScript, both SVG titles, help dialog and expanded 64-place atlas at 320/390/800/1440px; no obsolete rendered references or article before Squeek. Runtime syntax and protected-file comparisons passed. |
| `npm --prefix web run verify` | Exit 1 at the original asset-inventory equality assertion. See the explicit configuration limitation below. Handoff/network/ABI checks preceding that assertion passed. |

The browser scripts manage and close their own preview servers. Browser binaries and additional WebKit libraries were kept in temporary storage. The supplied browser tool could not initialize because its cache was read-only (`EROFS`); local Playwright was used instead. The browser installation needed temporary system-library equivalents and software EGL; these are test setup only and are not runtime assets. Host dependency-cache validation was bypassed only after supplying those libraries, and actual browser launch/interactions were then tested.

## Responsive and interaction evidence

| Width | Document width | Vote button bottom |
| --- | --- | --- |
| 320px | 320px | 533.17px |
| 390px | 390px | 533.17px |
| 800px | 800px | 529.80px |
| 1440px | 1440px | 588.39px |

The wordmark and primary action are visible in the first 844px-high phone viewport. The probe additionally reports no text overlap, hidden-text clipping or controls over text at 320, 390 and 1440px. The longer wordmark required no CSS or markup-structure changes.

The existing suite covers destination selection/filtering, the full atlas, keyboard Escape/focus restoration, wallet discovery and mobile links, direct injected-wallet connection, unknown-chain add/switch, rejected switches/connections/signatures, vote and permissionless finalization simulations/reviews/receipts, duplicate locks, reverted receipt retry, unavailable wheel/contract states, ABI tampering, large-value reflow, accessibility/reduced motion, postcards, crossings and Navigator points. Transaction responses and arrival scenarios are fixtures, not live transactions or invented production data.

Reviewed screenshots of the final export:

- `screenshots/390-live.webp` and `screenshots/1440-live.webp`: actual public read-only state and loaded map tiles.
- `screenshots/390-wallet.webp`: real wallet-selection sheet and keyboard focus.
- `screenshots/390-help.webp`: updated help copy in the existing responsive dialog.
- `screenshots/390-simulated-journey.webp`: explicitly simulated journey/postcard/leaderboard state.
- `screenshots/share.webp`: rendered share SVG, inspected for name fit and retained artwork.

The probe’s first-screen 390px screenshot was also inspected. Its PNGs remain disposable scratch evidence to avoid duplicate packaging.

## Better Interface: six-domain review

The preserved visual idea is a shared LED atlas: Squeek’s pixel wheel beside a dark map, with the community ballot beside it on desktop and before it on phones. The pinned guide’s workflow and all six core domains were read and applied during this bounded revision. Existing Better Interface/Impeccable attribution and licenses remain in `licenses/Better-Interface-Impeccable.txt`.

| Domain | Coverage, findings and final result |
| --- | --- |
| Accessibility — checked | Updated the home/map-section/map-action names and SVG/social alternatives. Existing native controls/dialog semantics, keyboard close/focus return and reduced motion pass existing checks. The existing automated read-only axe scan reports zero violations. No screen-reader or physical-device session was performed. |
| Layout — checked | Screenshots and geometry at 320/390/800/1440px, including the longer name, full addresses/large-count fixtures and open sheets. No horizontal overflow; main action remains above the fold. CSS and structural layout are byte-identical to the prior revision. Native browser zoom and RTL were not tested. |
| Writing — checked | Natural Squeek references without an article, project name and smart apostrophe consistency, action/help/status text, all destination/postcard text, loading and metadata. The unchanged slogan and Squeekchain brand are retained. Source/dist/docs search and rendered-copy checks found no obsolete user-facing references. |
| Typography — checked | Existing six declared type sizes, three measured weights and system-font fallbacks retained; probe finds five sizes at 390px and six including one-offs at 1440px. Name and share text wrap/fit without clipping. Existing uppercase heading styling remains an explicit scope exception. Exact font files vary by platform. |
| Colors — checked | Token values and CSS are unchanged. All solid text/background pairs measured by the probe pass its thresholds; its lowest reported ratio at 390px is 6.63:1 on the disabled vote label. Fifteen canvas/gradient/image-backed text boxes remain unmeasured; no claim of universal contrast compliance. |
| UI — checked | Existing surfaces, icons, control states and motion preserved. Current interaction suite covers loading, read-only, empty, pending, success, rejected, reverted and retry states. Probe finds no `transition: all` or motion continuing under reduced motion. No 10%-speed animation-panel review was performed. |

## Findings and fixes

| Finding | Source and correction | Recheck |
| --- | --- | --- |
| Inconsistent product identity | `web/src/App.tsx:339`, `web/src/config.ts:48`, `web/index.html:7`, `web/public/share.svg:1`, README/design docs: replaced the former project name with the new name. | Rendered header/footer, wallet-app source, title/loading, share/favicons and docs audited. |
| Generic character references | `web/src/App.tsx:364`, `:372`, `:686`, `:915`, `:920`; `web/src/Map.tsx:300`: natural Squeek wording in hero, map accessibility, completed route and help. | Source/dist/docs audit plus rendered help/map labels and full atlas at four widths pass. |
| Social/accessibility identity gaps | `web/index.html:19`, `web/public/favicon.svg:1`, `web/public/share.svg:1`: explicit Twitter metadata, image alternatives and SVG accessible titles. | DOM metadata and SVG title checks pass; share screenshot inspected. |
| Probe uppercase flag | `web/src/styles.css:135` and heading rules below: existing `text-transform: uppercase`. | Retained because this task explicitly freezes styling; other 15 probe checks pass. |
| Historical manifest inventory | `dist/imd-deployment.json` lists the preceding export’s asset hashes. | Kept byte-for-byte as required; legacy verifier failure disclosed, current export inventoried separately. |

## Source, export and documentation search

Case-insensitive searches covered `web/src/`, `web/index.html`, `web/public/`, the complete `dist/`, root/front-end README files, `DESIGN.md` and `docs/`, plus test messages. All remaining matches in those source/export/docs paths are technical references: the unchanged `Hamster` component, `hamsterSVG` identifier, marker variable, and `hamster-art` / `hamster-marker` / `hamster-feet` CSS classes. The design docs name the component as a code symbol. No remaining match refers to Squeek in visible prose, metadata, accessibility text or SVG text.

A wider repository search also finds the immutable package name/lockfile entries and old contract/launch/handoff notes. Those are preserved technical identifiers or deployment/contract metadata, not website copy; this task prohibits editing them. `docs/frontend/copy-audit.json` records the occurrence counts and classifications. The loading fallback and runtime DOM were checked separately to catch strings that raw bundle searches cannot classify.

## Frozen deployment-manifest limitation

The inherited `npm run build` runs an exporter that regenerates `imd-deployment.json` with SHA-256 hashes for every website file. Any copy change makes that historical inventory stale. This task explicitly prohibits modifying that file and existing build configuration, so the production build uses the same TypeScript/Vite toolchain directly with `--emptyOutDir false`, retaining the deployed manifest and raw ABI bytes. The original build/export/verify scripts themselves are untouched.

The runtime uses this manifest for chain, addresses and ABI provenance; it does not load chunks through the historical asset list. Runtime behavior and ABI verification still pass. `export-files.json` records the complete current export hashes for review and is documentation only. It does not replace the runtime config. The legacy inventory verification failure is a known consequence of the requested config freeze, not a passing check. Both READMEs document the exact safe rebuild procedure.

## Remaining limits and completion

No real signing, gas expenditure, Coinbase/passkey enrollment, native mobile app launch, screen-reader session, native 200% zoom, forced-colors/RTL variant, publication or redeployment was performed. Social-platform SVG preview support and future availability of public APIs, routing, tiles and RPCs are external limits. Browser fixtures establish interaction behavior, not on-chain transaction success.

Complete for the requested copy revision, with the preserved historical manifest-inventory limitation above. `DESIGN.md` at the repository root documents the final preserved tokens, typography, components and responsive behavior; `docs/DESIGN.md` matches it exactly. No ignore file, build configuration, dependency manifest/lockfile, contract, ABI, deployment configuration or URL was modified.
