# Hosting revision: site name `squeeks-first-road-trip`

Checked on 31 October 2026 against the committed export in `dist/` at base commit `a51f170`. These are worker self-checks, not independent certification.

## Scope and outcome

- **Request:** host the site under the new site name `squeeks-first-road-trip`, changing nothing else.
- **Hosting is done by the publisher**, not by this repository: it pins the committed `dist/` to IPFS and names it after the job completes. No publishing command was run here. The previous name was `hamster-road-trip-choose-the-nex.identitymd.eth`.
- **No site file needed a change for the new name.** Nothing in the source or export refers to a site name, ENS name, gateway host or absolute URL. Vite uses `base: './'`. `index.html` loads its script, stylesheet, favicon and share image by relative paths (`./assets/…`, `./favicon.svg`, `./share.svg`). Navigation uses page anchors. The app fetches `imd-deployment.json` and `abi/RoadTripVotes.json` relative to the page. The same files therefore work under the new name, at a gateway subpath, or at the old name.
- **Unchanged:** all content, copy, images, layout, styling, source under `web/`, the `dist/` export, the contract, ABI, deployment configuration, build configuration, dependencies and lockfile. This revision only adds this report and a hosting note to `README.md`, `web/README.md`, `DESIGN.md` and `docs/DESIGN.md`.
- The `web/package.json` package name stays `hamster-road-trip`. It is internal and never shown to visitors, and package manifests are protected in this assignment.

## Actual checks

| Command | Result |
| --- | --- |
| `npm --prefix web ci` | Passed with the committed lockfile (Node 24.22.1, npm 11.19.1). npm reported that install scripts for esbuild, keccak and utf-8-validate were not run; the build and tests below worked without them. |
| `npm --prefix web run typecheck` | Passed, exit 0. |
| `npm --prefix web test` | Passed: 14 of 14 logic tests. |
| `cd web && npm exec -- vite build --outDir ../test/scratch/rebuild --emptyOutDir` | Passed. Every rebuilt file (`index.html`, `favicon.svg`, `share.svg`, six JS/CSS assets) is **byte-identical** to the committed `dist/`, so the committed export matches the source. The existing large-chunk warning remains. `dist/imd-deployment.json` and `dist/abi/` are not produced by Vite and were left as they are. |
| `npm --prefix web run test:browser` | Passed, exit 0: **19 Chromium checks** passed. They cover the 390px first screen, choosing a destination, keyboard sheet, full atlas, wallet connect/add/switch/reject flows, simulated vote and finalize with receipts, error states, ABI tampering, reflow at 320/390/800/1440px, an axe accessibility audit, reduced motion, and postcards. **WebKit not verified:** its runtime is unavailable on this machine. Wallets, RPC responses and transactions are fixtures; nothing was broadcast. |
| `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` (with `IMD_PLAYWRIGHT` pointing to `web/node_modules/playwright`) | Ran. 15 of 16 checks pass: render, layout, targets, contrast, tracking, eyebrows, type-sizes, type-faces, glyphs, slogans, repetition, copy-budget, chrome, motion, share. The one failure is **casing** (six uppercase section headings), discussed below. |

Not run: `node web/tests/visual.mjs` (it rewrites the committed screenshots in `docs/frontend/screenshots/`, which this "change nothing else" revision keeps), `node web/scripts/check-chain.mjs` (contract and chain reads did not change), and `npm --prefix web run verify` (its frozen asset inventory is historical; see `REBRAND-VALIDATION.md`).

## First screen and sharing

I viewed the probe's 390px screenshot. The first screen shows the Squeek’s First Road Trip wordmark, a "Connect wallet" control, the headline "Small wheel. Big world." with one line saying what the site is, and the "Choose the next stop" ballot. The ballot has the destination selector, the vote count and the "Vote for Key West" button, plus the "Connect your wallet above to vote" direction. The probe found no horizontal scroll, text overlap or clipped text at 320, 390 or 1440px. `index.html` has a title, an SVG favicon, a description, `og:title` and `og:image` (`./share.svg`). The probe's share check passed.

## Better Interface review

I reviewed the guide's workflow and all six domains for the surfaces that the new hosting name affects: the static export as a whole, its relative URLs and its metadata. Because the request forbids design or content changes, no finding below was eligible for a source fix.

| Domain | Coverage | Evidence |
| --- | --- | --- |
| Accessibility | Checked | Skip link (`web/src/styles.css:172`), global `:focus-visible` ring (`styles.css:111`), reduced-motion rules (`styles.css:1085`, `:1103`), labelled selector (`web/src/App.tsx:432`), `role="status"` live region (`App.tsx:294`). The browser suite's axe and keyboard checks passed. No screen-reader session or physical device was used. |
| Layout | Checked | The probe found no overflow, overlap or clipping at 320/390/1440px. The browser suite's reflow checked 320/390/800/1440px. |
| Writing | Checked | Copy unchanged. Probe: no repeated lines, 21 words of prose on the 390px first screen, one slogan. |
| Typography | Checked | Six-step scale tokens (`styles.css:28-33`). The probe found 5 sizes at 390px and 3 families. |
| Colors | Checked | The probe measured all text it could against 4.5:1 / 3:1 and all passed. It did not measure 15 text boxes over the map canvas, artwork or gradients, so those pairs remain unverified. |
| UI | Checked | Probe: no border-plus-shadow stacks, nested cards or gradient text, and no endless animation while reduced motion is on. |

Findings (none fixed; all were already present and are kept under "change nothing else"):

1. **LOW: uppercase section headings.** `web/src/styles.css:135`, `:141`, `:207`, `:887`, `:959`. The probe's casing check flags six `text-transform: uppercase` headings. The original brief explicitly asked for uppercase monospace headings, and this request forbids design changes. They are not small tracked kicker labels (the eyebrows check passed).
2. **LOW: four controls are under the 44px comfortable size.** These are mainly the compact map attribution links (`web/src/styles.css:413-420`). All 27 controls meet the 24px-or-spacing minimum at 390px.

## Limitations

- Publication, IPFS pinning and the `squeeks-first-road-trip` name are assigned by the publisher after delivery. They are not verified here.
- The supplied MCP browser tool was not used. Rendered observations come from local Playwright, through the browser suite and the design probe.
- WebKit, native browser zoom, screen readers, physical phones, real wallet signatures and live transactions were not tested in this revision.
