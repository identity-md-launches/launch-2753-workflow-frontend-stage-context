# Hamster Road Trip design

## Overview

The community watches a real wheel move a shared itinerary and votes for the next stop. The implemented direction is the brief's dark retro LED map: near-black surfaces, dotted routes, original pixel art and restrained teal, purple and amber accents. The ballot is the first product surface on a phone; the map and ballot sit beside each other on desktop. There is no separate marketing landing page.

The implementation is in `web/src/styles.css`, `App.tsx`, `Map.tsx`, `Wallet.tsx` and `art.tsx`. This document lives in `docs/` to honor the explicit write scope; no root file was added.

## Colors

Primitives and semantic aliases are defined at the start of `web/src/styles.css`. Use aliases in interface components.

| Token | Value | Job |
| --- | --- | --- |
| `--bg` / `--ink-950` | `#0b1013` | Page, opaque map labels |
| `--surface` / `--ink-900` | `#11191f` | Ballot, controls, dialog |
| `--hover` / `--ink-800` | `#18232b` | Hover and pressed surfaces |
| `--line` / `--ink-700` | `#26353e` | Structural separators |
| `--ink-600` | `#40535d` | Control boundaries |
| `--text` / `--paper-100` | `#f0f3ed` | Main text and focus |
| `--muted` / `--paper-300` | `#afbdc4` | Supporting text |
| `--accent`, `--route` / `--mint-300` | `#77ead7` | Primary action and journey route |
| `--art` / `--violet-300` | `#b6a0ff` | Pixel landmarks, selected destination |
| `--warning` / `--amber-300` | `#f2bd74` | Countdown and crossing art |
| `--error` / `--red-300` | `#ffa4ae` | Persistent, recoverable errors |

Map geography uses a separate literal style in `Map.tsx`: land background `#223933`, water `#0e1924`, vegetation and land-use layers, muted borders and roads. This is cartographic artwork, not a parallel set of UI tokens. Pixel art has its own cream/amber hamster palette in `art.tsx`.

The theme is deliberately dark only. Status always includes text, not color alone. The filled primary control is the vote action or the review confirmation inside the modal. Other actions are outlined. Text contrast measurements and limitations are recorded in the validation report, including unmeasured canvas-backed pairs.

## Typography

`--font-body` is Arial / Helvetica / sans-serif; `--font-display` is Courier New / Courier / monospace. There are no downloaded fonts. MapLibre's own attribution styles can use Helvetica Neue. Exact system font files vary by platform.

| Role | Token | Size |
| --- | --- | --- |
| Fine metadata | `--text-caption` | 12px |
| Supporting text | `--text-small` | 14px |
| Body, controls, place headings | `--text-body` | 16px |
| Section headings | `--text-heading` | 20px |
| Vote count / compact headline | `--text-stat` | 28px |
| Wide headline | `--text-display` | 44px |

Requested weights are 400, 600 and 700. The headline and uppercase section headings use 700; body prose remains normal case and sans serif. Uppercase monospace headings are explicitly requested by the brief. The wide headline uses -0.05em tracking, compact headline -0.03em, section headings -0.02em. Body tracking is natural. Body line-height is 1.5, headings 1.1–1.25, wrapping place headings 1.4. Countdown and changing values use tabular digits.

There are at most six sizes per viewport (five on the measured phone view). Text uses balance/pretty wrapping where appropriate; ids, addresses and large counts wrap without clipping. Native selects remain at least 16px to avoid phone input zoom.

## Layout

The spacing tokens are 4, 8, 12, 16, 24, 32, 48 and 64px. Compact panels also use 20px, on the same four-pixel rhythm. Shared edges come from `.site-header`, `main` and `footer`, capped at 1280px. Outer margins are 40px on wide screens, 24px below 1100px and 16px below 800px.

At more than 800px, `.dashboard` is a map / ballot grid. Below 800px it becomes a column with the ballot first. The 390px first screen contains the brand, wallet control, product description, current vote state, selection and vote action. The map follows directly.

Destination choices use four columns on wide screens and two below 1100px. Their compact 520px layout wraps names, country and vote count into readable rows. Statistics collapse from four columns to two at 800px. Queue and leaderboard become one column at 520px. Postcards progress from three to two to one column. The contract disclosure becomes a single column at 800px.

The map keeps explicit visual height (420px desktop, 330px below 800px, 300px below 520px); all text panels grow with content. `.map-info` stacks status, crossing key and origin legend to prevent loading/error text overlap. The map canvas is clipped to its shape; critical interface text is not clipped. Large vote counts and full addresses were checked at 320, 390, 800 and 1440px. 200% text enlargement was checked separately from native browser zoom.

## Elevation & Depth

This is a flat interface. Structural borders, surface color and whitespace carry groups. Panels do not combine decorative borders and shadows. A small glow belongs only to the hamster map artwork. The native dialog uses an opaque surface over a dark translucent backdrop, with browser-managed focus and top-layer placement. The map tools and opaque legends sit above the canvas; nothing is sticky over page text.

## Shapes

Controls use 4px corners, the map 6px, the ballot 3px and the desktop dialog 8px. Under 640px the dialog becomes a bottom sheet with 12px top corners and safe-area padding. Pixel icons use crisp SVG edges. These modest radii preserve the LED panel character; avoid introducing pill-shaped content cards.

## Components

| Pattern / component | Source | Behavior |
| --- | --- | --- |
| `Wallet` | `Wallet.tsx` | Single connect/address/switch control; named wallet rows, pending/error state, disconnect and phone app links |
| `Modal` | `Wallet.tsx` | Native dialog; Escape/backdrop/close, trapped focus and return to trigger; desktop dialog / phone sheet |
| `Address` | `Wallet.tsx` | Checksummed value, explorer link and clipboard button; compact variant for Navigator rows |
| Primary action / `TxStatus` | `App.tsx` | Simulation, review, signature, confirmation, success/error and unknown-receipt recovery; duplicates locked through receipt |
| Ballot | `App.tsx` | Native destination select, live vote tally, daily countdown, eligibility and gas explanation |
| `TripMap` | `Map.tsx` | OpenFreeMap vector geography, selected stop, dotted route, pixel hamster, ship crossings, center/world/zoom controls |
| `Hamster`, `PixelIcon`, `Icon` | `art.tsx` | Original reusable SVG art and a consistent 1.5px outline utility icon set |
| Destination card | `.destination-card` | Large button, pressed state and selected border; moves selection and keyboard focus back to ballot |
| Postcard | `.postcard` | Reached place, original fact, pixel icon and stop order; no fictional arrival timestamp |
| Data disclosure | `.observability` | Native details with provenance, full contract address and configuration link |

Controls have hover, focus, pressed and disabled states. Focus uses a visible 2px foreground outline with 3px offset. Buttons are at least 44px high, with the primary vote at 52px and wallet rows at 52px. Attribution links are compact map credits rather than large action controls.

Motion opts in under `prefers-reduced-motion: no-preference`: 120ms button transitions, 0.96 press scale, 0.35s stepped run bounce, 1s rotating wheel spokes, 0.2s feet and a 4s idle breath. The page's pause button stops all hamster animation; reduced motion stops animations and transitions. Map recentering uses 400ms normally and zero duration for reduced motion. Marker movement is derived from settled snapshots, not a synthetic timer.

## Do's and Don'ts

- Reuse the shared width, semantic tokens, native control and status patterns for another section.
- Keep the ballot and wallet reachable before explanatory content on phones.
- Keep destination ids permanent; extend facts or art without changing ballot meanings.
- Keep errors beside their action, with a recovery control. Unknown data stays unknown.
- Use SVG/CSS/canvas for original artwork and retain map attribution.
- Keep blockchain configuration in the runtime manifest. Styling must not change transaction arguments or add contract roles.
- Avoid extra type sizes, marketing banners, clipped addresses, fictitious players, provisional movement or a light-theme switch that does not exist.

Design guidance is adapted from Jakub Krehel's Better Interface (MIT, pinned `267330e1adfc66a718fb65fa6918c1f06d0a689e`); documentation method from Paul Bakaus's Impeccable (Apache-2.0, pinned `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`). Preserved licenses are in `docs/frontend/licenses/`.
