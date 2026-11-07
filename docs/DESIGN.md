# Squeek’s First Road Trip design

## Overview

A spectator can watch a real hamster travel, browse 64 places and inspect the community’s votes before connecting a wallet. The visual idea is a small pixel travel game: the existing amber Squeek sprite, lilac skies, cream paper and square postcard frames. The first screen pairs the current trip state with one purple voting action. Destinations, Trip log, Passport, Up next, Navigators and help use the same system.

The source of truth is `web/src/styles.css`, with the illustrated kit in `Postcards.tsx`, `landmarks.ts` and `art.tsx`. `Map.tsx` retains MapLibre and OpenFreeMap vector tiles; its cartographic colors are separate from interface text tokens. This document describes the completed source, not a proposed redesign.

## Colors

| Token | Value | Use |
| --- | --- | --- |
| `--color-page` | `#faf4e6` | Main cream background |
| `--color-surface` | `#fffaf0` | Ballot, fields, postcards, dialogs |
| `--color-ink` | `#352d42` | Main text |
| `--color-muted` | `#655b70` | Supporting labels and explanations |
| `--color-line` | `#706080` | Chunky structural outlines |
| `--color-primary` | `#72529f` | Primary action and selected-state emphasis |
| `--color-primary-hover` | `#5f408d` | Primary hover |
| `--color-primary-text` | `#fffaf0` | Filled-button text |
| `--color-lilac` | `#e5dbf5` | Scene and selected destination |
| `--color-lilac-strong` | `#a08cf7` | Sprite/postcard accent family |
| `--color-mint` | `#cce8dc` | Recap, current Navigator row |
| `--color-warning` | `#fff0cc` | Network recovery and ended-day prompt |
| `--color-error` | `#8a303f` | Errors |
| `--color-focus` | `#57318c` | Visible 3px keyboard outline |

The existing Squeek drawing retains its amber `#f2b866`, cream `#ffe1a2`, lilac `#a08cf7` wheel and mint `#77ead7` details. Fixed 64×64 SVG dimensions keep it small inside postcard and map stages. No photo or remote image is used in the interface. Provider-supplied wallet icons are accepted only as embedded SVG; other icons use an inline wallet drawing.

Postcard sky colors in `Postcards.tsx` are regional: Americas `#f8bf87` → `#ffe5b6`; Europe `#afa4ec` → `#e7d5f3`; Africa `#eeac77` → `#ffdda0`; Asia `#e4a2b5` → `#f9d6bc`; Oceania `#8fd6cf` → `#d3eee2`. Each illustration uses one landmark silhouette and a ground strip. Locked variants use muted silhouettes, a lock and an explicit HTML status.

Measured solid pairs: ink/page 11.93:1, muted/page 5.83:1, primary text/primary 5.90:1, link `#604187`/surface 7.75:1, ink/scene status `#f3ebfb` 11.27:1. The final probe also measured rendered solid text backgrounds. Canvas and gradient-backed illustration pairs are outside that automated measurement; meaningful postcard labels are repeated as normal HTML.

## Typography

Google Fonts **Pixelify Sans** is the display face; **DM Sans** is the body face. Both are bundled locally as TTFs through `web/src/fonts.css`, with 400/600/700 weights and `font-display: swap`. Fallbacks are Courier New/monospace and Arial/sans-serif. Their SIL Open Font Licenses ship in `web/public/licenses/` and `dist/licenses/`. Runtime font downloads are unnecessary. Loaded fonts were checked in the rendered export, and a blocked-font test verified usable fallbacks.

| Role | Desktop | ≤1000px | ≤680px |
| --- | --- | --- | --- |
| `--size-h1` | 3.5rem | 3rem | 2rem |
| `--size-h2` | 2rem | 2rem | 1.5rem |
| `--size-h3` | 1.5rem | 1.5rem | 1.125rem |
| `--size-label` | 1.125rem | 1.125rem | 1.125rem |
| `--size-body` | 1rem | 1rem | 1rem |
| `--size-small` | .875rem | .875rem | .875rem |

Base line-height is 1.5; headings use 1.15 and natural letter spacing. Display headings usually use 600; body uses 400; emphasis uses 600/700. Prose is limited to 70ch. Inputs remain 16px on phones. Countdown and ranked numbers use tabular figures. Long counts and addresses wrap; they are never hidden to fit. The phone headline breaks into “Small wheel.” and “Big world.”

## Layout

Main content is at most 1256px wide; header/footer at most 1320px. Desktop margins/padding use 32px, phones 16px, and 320px layouts 12px. Common spacing steps are 4, 8, 12, 16, 20, 24, 32, 36, 48 and 56px.

Desktop uses a 1.7fr/1fr scene-and-ballot grid, with the map beneath the scene. The ballot follows selection immediately with the primary action; secondary counts follow it. At 680px and below, the order is scene/current state, ballot, then map. The scene sky is compact on phones. Navigation stays visible as a wrapping row, with help and wallet utilities beside the brand. Nothing is fixed over content.

Destination cards use four columns at wide widths, three below 1320px, two below 1000px. The passport uses four, three and two columns respectively, with the two-column change at 680px. Trip columns collapse to one at 680px. Postcards use three, two and one columns. Filters wrap with a full-width search on phones. Dialogs become bottom-aligned under 680px and stay within 90dvh.

The implemented breakpoints are 1320, 1000, 680 and 360px. Browser checks covered 320, 360, 390, 800 and 1440px, large counts and 200% text enlargement. Native zoom, physical devices and RTL localization were not verified; no localization feature is offered. At 390×844 the final live primary action ends around y=725px, with the product, rest state and next destination above it.

## Elevation & Depth

Surfaces are flat: 2–3px structural borders, tonal fills and dashed dividers. There are no interface box shadows or gradient text. The sprite has a small hard-edged outline in the scene. Native dialog top-layer behavior and a translucent plum backdrop distinguish modal content. Gradients belong only to illustrated skies.

## Shapes

Controls use a 2px radius and square outlines. Pixel rectangles define clouds and Squeek; landmarks use simple geometric paths. A shared striped frame makes every postcard part of one collection. Selected destination cards have a stronger purple border, a check and `aria-pressed`; color is not the sole cue.

## Components

- `Wallet.tsx`: one header wallet control, EIP-6963 names, mobile wallet-browser links, Coinbase Smart Wallet, disconnect and chain switching. Restoration has an explicit disabled state. Wallet failures stay in the dialog or beside the control.
- `Modal` in `Wallet.tsx`: native dialog with a labeled title, close button, Escape, background inertness and native focus return. All buttons/fields have a visible focus outline.
- `TripMap` in `Map.tsx`: unchanged map library/tile source, selectable pins, equivalent native destination selector, wheel marker, plane crossings, zoom/world/find controls and visible attribution. A tile failure leaves the ballot usable.
- `Hamster` / `hamsterSVG` in `art.tsx`: reused Squeek drawing. Spokes animate in 12 steps when running; feet use a small two-step motion. Pause and reduced motion stop animations.
- `LandmarkIcon` / `PostcardPicture` / `Postcard` in `Postcards.tsx`: 64 entries in `landmarks.ts`, shared regional stage, readable HTML names, observation date, leg distance, confirmed winning votes, transaction link, PNG export and share text.
- Destination cards in `App.tsx`: vote ordering, share bars, region/search filters and native selection. Empty searches offer Clear filters; unknown tallies never become placeholder zeroes.
- `TripMemory.tsx`: arrival reveal and returning-visitor recap, using versioned optional storage. On-chain facts never come from these storage values.
- `Recovery.tsx`: the outer error boundary and Reset and reload action. Only the app’s `wagmi.*`, `hrt-*` and `cbwsdk.*` storage keys are removed.

Primary buttons are filled purple; ordinary actions are outlined; disabled states are neutral and accompanied by a reason. Most touch controls are at least 44px; smaller well-spaced utilities meet the measured 24px target/spacing threshold. Dynamic transaction messages use polite status regions; network errors offer retry. Empty, loading, unavailable, resting, queued-route-complete and all-64-visited states are distinct.

## Do’s and Don’ts

- Reuse the semantic colors and six type roles. Keep one filled action per active surface.
- Keep trip state and the ballot before the map on phones. Put instructions next to their control.
- Use `PostcardPicture` and the permanent destination id for new postcard views. Never reorder ballot ids or use one generic landmark for many stops.
- Use the public client for reads, and require a fully connected wallet only for a transaction. Never access a rehydrated connector directly.
- Label arrival observation dates honestly. Keep loading/unavailable values separate from confirmed zeroes.
- Add an anchored section with the shared heading, spacing, fields and state patterns for another view. Preserve natural wrapping and test 320/390/1440px before exporting.

Design guidance is adapted from Jakub Krehel’s Better Interface (MIT) and the documentation method from Paul Bakaus’s Impeccable (Apache-2.0). Existing license records remain under `docs/frontend/licenses/`.
