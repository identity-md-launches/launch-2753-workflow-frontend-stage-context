# Revision validation — 7 November 2026

## Results

| Check | Actual result |
| --- | --- |
| Production build | Passed `npm run build --prefix web`, including TypeScript, Vite, pinned ABI verification, manifest export and asset verification |
| Logic tests | 20/20 passed with `npm test --prefix web` |
| Chromium interactions | 29/29 passed against the production export at `/preview/`; deterministic wallet/RPC fixtures, no broadcasts |
| Required design probe | 16/16 passed on the final export |
| Automated accessibility | axe WCAG 2/2.1/2.2 A/AA rules: zero reported violations in the exercised spectator view |
| Live chain verification | Passed on Sepolia at block 12085238; original deployment receipt, 2,714-byte code, 86,400-second epochs, 64 destinations |
| Live rendered interface | Real public reads, wheel data, routing and OpenFreeMap tiles inspected at 390×844 and 1440×844; zero script errors and no document overflow |
| First phone screen | Squeek’s rest state, next stop and primary action visible; final live CTA bottom ≈725px at 390×844 |
| Contract/config integrity | Contract, source/exported ABI, address, handoff, network, destination ids and protected build/package/ignore files unchanged |
| Export and budget | 19 declared assets, approximately 2.95 MB total export; complete submission candidate below 8 MiB; dist/index.html is not ignored |

The production build emits a non-blocking chunk-size warning for the existing map/wallet dependency graph. It succeeds, and the complete source/export bundle remains within the requested limit. No root or frontend package manifest, lockfile, dependency, Foundry configuration or existing Vite/TypeScript configuration was edited. No ignore rule was changed. No dependency cache, browser binary, archive or submodule is included.

Structured evidence is in [revision/browser-results.json](revision/browser-results.json), [revision/taste-checks.json](revision/taste-checks.json), [revision/axe-violations.json](revision/axe-violations.json), [revision/integrity.json](revision/integrity.json), [revision/live-visual.json](revision/live-visual.json) and [chain-check.json](chain-check.json). Screenshots inspected: [390 live](revision/390-live.webp), [1440 live](revision/1440-live.webp), [all 64 landmarks](revision/64-landmarks.png), and the [downloaded postcard](revision/postcard-download.png). The all-64 sheet and downloaded postcard use explicitly simulated data; the live screenshots use public reads.

## Commands and scope

From the repository root:

```sh
npm ci --prefix web --ignore-scripts --cache /tmp/squeek-npm-cache --no-audit --no-fund
npm run build --prefix web
npm test --prefix web
IMD_PLAYWRIGHT=/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright node web/tests/browser.mjs
IMD_PLAYWRIGHT=/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
node web/scripts/check-chain.mjs
```

The supplied browser MCP connection returned `Transport closed`; it produced no browser observations. The provided Chromium runtime was used directly through Playwright, with bounded foreground scripts managing and closing their own static preview servers. The probe also used that runtime. It measured the export at 320, 390 and 1440px, including reduced motion. Production UI checks additionally covered 360 and 800px, very large counts and 200% text enlargement. Text enlargement is not a claim of native browser zoom testing.

The browser network was isolated for the live visual check, so a scratch Playwright route forwarded **public service requests only** through Node. Its evidence explicitly records this. The separate live chain script used the configured public Sepolia endpoint directly, and an HTTP origin probe confirmed the primary RPC’s `Access-Control-Allow-Origin: *`. Browser interaction tests use intercepted deterministic RPC/API/tile responses to exercise every state, rather than asserting that live wallets or third-party services are always available. No real signature or transaction was requested.

`test/scratch/` contains disposable runners, logs, screenshots and fixtures; it is not needed by the site or production build. The delivered evidence above is copied into docs independently. There is no Foundry work in this frontend-only revision; Solidity tests were not rerun and no contract source was changed.

## Required scenario coverage

| Scenario | Exercised behavior |
| --- | --- |
| Connect wallet then reload | A real mock EIP-6963 connector restores through the versioned key; full UI and voting availability return; no provider-method TypeError |
| Old saved wagmi.store | Serialized methodless connector is ignored, public reads render, unrelated storage survives |
| Current-version broken saved connector | No installed wallet; reconnect resolves safely and spectator reads remain visible |
| Two extensions | Both EIP-6963 names listed individually, generic duplicate hidden |
| Wallet locked | Unlock instruction; trip stays visible after closing the sheet |
| Wrong network | Switch, unknown-chain add and explicit second switch; rejected switch remains recoverable |
| No wallet | Complete spectator UI, destination selection and passport; only action prompts connection |
| Private browsing | Fresh isolated context plus throwing storage methods; public view works |
| No test ETH | Explicit message and configured faucet, transaction prevented |
| RPC failure | Failed primary endpoint falls back; all endpoints failing produces unknown values and a retry state beside the ballot |
| 360px phone | Visible product/action, all four wallet-browser deep links plus Smart Wallet, direct connection inside an injected browser |
| Transactions | Simulation/review, waiting-for-wallet code path, pending lock, confirmed receipt, duplicate lock, rejection reason, reverted receipt, correct destination contract/calldata and zero ETH value |
| Day finalization | Oldest pending epoch is preserved and confirmed; readiness explains why closing a day moves the route |
| Selection and navigation | Native selector, actual map pin click, vote ordering, region/search, empty-search recovery, all 64 cards, help/Escape/focus and ballot return links |
| Route states | No votes, no queue, a multi-day rest, all queued stops reached, all 64 destinations reached, repeated-city grouping and plane crossing labels |
| Postcards | Confirmed winner count/transaction link, observation date, valid 800×650 PNG, prefilled share text, 64 distinct silhouettes and locked/visited variants |
| Returning visitors | Versioned last-seen block recap and arrival reveal |
| Recovery boundary | Forced render exception, visible reset action, targeted local/session storage removal, unrelated keys preserved and successful reload |

The normal wallet mock returns promptly, so the waiting-for-wallet transition is primarily established by the implemented transaction stage and rejection/pending tests, rather than a human leaving a real prompt open. Real browser extensions, hardware devices, phone app launch success, passkey enrollment and funded transactions remain unperformed.

## Better Interface consolidated review

The pinned workflow and all six core domains were read and applied during construction. The product is one pixel travel game; the primary hierarchy is current state, vote, then route/collection. The user’s pixel-art direction takes precedence over generic rounded-card or minimalist styling preferences.

| Domain | Coverage, findings and disposition |
| --- | --- |
| Accessibility | Native labeled inputs/dialogs, skip link, focus trapping/return, keyboard actions and recovery were exercised. The passport’s SVG lettering was too small at card size: readable HTML city/landmark/status labels now accompany it (`web/src/App.tsx:1186`). axe reports zero violations for the tested view. Reduced motion stops all running animations. Physical screen-reader and forced-colors sessions were not performed. |
| Layout | Real 390/1440 screenshots inspected, fixture widths 320/360/390/800/1440 checked. Large numeric counts originally widened the 320px ballot; wrapping is now explicit in `web/src/styles.css:1804`. The primary action precedes secondary details (`web/src/App.tsx:567`), keeping it above the fold even with long values. Text at 200% reflows. |
| Writing | Unknown reads say unavailable/loading, confirmed zeroes say no votes, and errors offer retry near the ballot (`web/src/App.tsx:604`). Partial travel originally said “Resting in Miami Beach” despite being along the route; it now says “Resting on the way” (`web/src/App.tsx:403`). Arrival dates are explicitly observations. Plurals, UTC/local reset, Voted dates and grouped stays were checked. Saint names are expanded for readable labels. |
| Typography | Bundled Google Fonts replace dependency on runtime font requests; the blocked-font test verifies fallbacks. Six sizes at most, two families and three weights are used. HTML labels carry essential small-card names. Real loaded-font checks passed in both live screenshots. No font-loading or fixed-height clipping issue remains in exercised views. |
| Colors | The final probe passes solid-background text contrast. Source/rendered solid pair calculations are documented in DESIGN.md (11.93:1 ink/page, 5.83:1 muted/page, 5.90:1 primary button). Status has text as well as color. Canvas/gradient illustration pairs are outside automated contrast coverage; their essential information is available in normal HTML. |
| UI | Existing Squeek art, restrained square borders and one shared postcard kit carry the visual identity. Download inspection found a nested SVG with no explicit dimensions, which enlarged Squeek over the greeting. `web/src/art.tsx:2` now declares its 64×64 viewport size, and marker children fit their containers. The corrected PNG and full 64-card sheet were inspected. Hover, focus, disabled, loading, failure and success states have source/interaction coverage; 10% animation-panel playback was not performed. |

Final taste@1: **16/16 checks passed**, including render/resources, layout, target spacing, measured contrast, casing/tracking, type scale/families/weights, copy budget, repetition, chrome, motion and sharing metadata. Earlier runs found the mobile first-action placement and fallback-font layout issues; both were repaired and rechecked. This passing probe does not establish native screen-reader, device or transaction behavior.

## Limits carried into delivery

No exact historical arrival timestamps are available; postcards identify first observed arrivals. Browser-local recap/arrival storage is optional and never used as chain evidence. The Finalized event has no closer identity. All 64 landmark paths are authored and inspected as simplified silhouettes, not detailed architectural drawings. Priority 3 sound/facts/time-of-day skies are omitted.

WebKit could not launch because its executable was unavailable in the supplied runtime. No WebKit/Safari result is claimed. These are local implementation checks and recorded observations, not independent certification. Publication is handled after delivery by the network.
