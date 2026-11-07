# Single full revision: delivery notes

## Critical wallet bug

The old `Wallet.tsx` effect used `isConnected` to call `connector.getProvider()` without checking that it was a function. In the installed wagmi implementation, `getAccount` deliberately reports `isConnected: !!address` during **reconnecting**. Wagmi persistence restores a serialized connector descriptor before the live connector is ready; that descriptor has no provider methods. The synchronous TypeError escaped the effect and, without an outer boundary, React removed the interface, leaving its background. Deleting `wagmi.store` prevented this restore path and therefore hid the bug.

The revised UI requires `status === "connected"`, never calls `connector.getProvider()` from a component, and obtains a wallet client through wagmi only behind status/function checks for an explicit network action. The public client contains public RPCs only. `readSnapshot` and history queries are independent of the connected account; ballot/balance reads have their own query. Storage uses the versioned `wagmi.squeek-v3` prefix. The entire provider/app tree is inside a recovery boundary whose **Reset and reload** button clears only `wagmi.*`, `hrt-*` and `cbwsdk.*` keys, in local/session storage. No full-storage clear is used.

Both legacy and current-version saved connector stubs were exercised, as well as a real mock connection followed by reload, a locked provider, storage-disabled browsing, and a forced render exception. All recovered without a blank page.

## What shipped

All Priority 1 work is implemented: spectator access; ordered RPC fallback/retry; explicit unknown/error states; one-tap Sepolia switching including add-then-switch; gasless-wallet faucet guidance; transaction review/wallet/pending/confirmed/failed states; the existing voting, countdown, destinations, Trip log, help, links, Up next, Navigators and postcard flows; a complete pixel visual revision; motion preference/pause; keyboard paths; phone layouts; a full 64-stop shared-kit passport; unique landmark icons; plane crossings; plural counts; local/UTC reset time; “Voted [date]” labels; and grouped consecutive city wins.

Priority 2 also ships: vote-sorted contender cards with share bars, all-stop search and map selection; arrival reveal and a versioned last-seen-block recap; deterministic Navigator identities/avatars, rank titles, real best winning streaks and a highlighted visitor row; an ended-day explanation with permissionless finalization; client-side PNG downloads and prefilled share text; coordinate-derived distance comparisons; contract/explorer/testnet footer; title, description, favicon and local SVG/PNG social preview.

**64 of 64 landmark illustrations are complete**, using distinct paths and the same regional sky/ground/Squeek/frame kit. A completed-passport fixture renders all 64 unlocked for inspection. Unvisited cards retain the silhouette and explicit locked status. The existing map library, tile source, logo drawing, destination ids and all live voting rules are preserved.

## Deliberate limits and omissions

- Exact historical physical-arrival dates are not in the contract or the supplied historical wheel data. The displayed **Arrival observed** date is the first time this browser saw settled distance reach the stop. The UI explains this, and dates remain unknown if storage is unavailable. No finalization date is passed off as an arrival date.
- `Finalized` includes epoch, destination, vote counts and route index, but no finalizer address. The finalizing transaction is linked; a “closed by” identity is not invented.
- A complete passport means all 64 distinct destinations have been reached. The contract has no terminal flag, so voting stays available after that state. All queued stops reached is a separate rest state.
- Sound, new fun facts and time-of-day map skies (Priority 3) are omitted.
- Physical phone app handoffs, actual browser extensions, passkey enrollment, funded signatures and Safari/WebKit were not certified. Protocol interactions were exercised with deterministic mocks in Chromium. The supplied WebKit executable was unavailable. No transaction was broadcast; no site was published by this task.

## Contract integrity

`src/RoadTripVotes.sol`, the contract ABI in `docs/abi/` and `dist/abi/`, the destination id mapping, the deployment handoff and network source are byte-for-byte unchanged. The address remains **0xb44d0f71fcba544fd800e38088d470d279067a20** on Sepolia (11155111). ABI hash remains `11eb81fe5960de8efe603e3e0d88a1bb24a813bdf757100988026196a9990184`. The runtime manifest preserves its deployment, contract and network fields; only its asset inventory is regenerated for the new export. Existing votes were only read.

A live read on 7 November 2026 verified chain 11155111, nonempty deployed code, the original successful deployment receipt/block, 86,400-second epochs and 64 destinations. Details are in `chain-check.json`. The recorded one vote and six queued stops are a point-in-time observation, not static values in the interface.

## Landmark choices

The ids below are the unchanged on-chain ballot ids. Regional/natural stops use a named formation or feature rather than an invented city building.

| Id | Stop | Landmark |
| --- | --- | --- |
| 0 | Key West | Southernmost Point buoy |
| 1 | Everglades | Shark Valley observation tower |
| 2 | Kennedy Space Center | Saturn V rocket |
| 3 | Savannah | Forsyth Park fountain |
| 4 | New Orleans | Saint Louis Cathedral |
| 5 | Washington, DC | Washington Monument |
| 6 | New York City | Statue of Liberty |
| 7 | Niagara Falls | Horseshoe Falls |
| 8 | Chicago | Cloud Gate |
| 9 | Grand Canyon | Grand Canyon South Rim |
| 10 | San Francisco | Golden Gate Bridge |
| 11 | Vancouver | Canada Place sails |
| 12 | Banff | Banff Springs hotel |
| 13 | Mexico City | Palacio de Bellas Artes |
| 14 | Chichén Itzá | El Castillo pyramid |
| 15 | San José | National Theatre of Costa Rica |
| 16 | Panama City | Bridge of the Americas |
| 17 | Cartagena | Cartagena clock tower |
| 18 | Galápagos | Bartolomé Pinnacle Rock |
| 19 | Cusco | Cusco Cathedral |
| 20 | Rio de Janeiro | Christ the Redeemer |
| 21 | Buenos Aires | Obelisco |
| 22 | Patagonia | Perito Moreno Glacier |
| 23 | Reykjavík | Hallgrímskirkja |
| 24 | Dublin | Ha’penny Bridge |
| 25 | London | Elizabeth Tower (Big Ben) |
| 26 | Paris | Eiffel Tower |
| 27 | Amsterdam | Amsterdam canal houses |
| 28 | Barcelona | Sagrada Família |
| 29 | Lisbon | Belém Tower |
| 30 | Rome | Colosseum |
| 31 | Venice | Saint Mark’s Campanile |
| 32 | Swiss Alps | Matterhorn |
| 33 | Berlin | Brandenburg Gate |
| 34 | Copenhagen | The Little Mermaid |
| 35 | Stockholm | Stockholm City Hall |
| 36 | Athens | Parthenon |
| 37 | Istanbul | Hagia Sophia |
| 38 | Marrakesh | Koutoubia minaret |
| 39 | Cairo | Great Pyramid of Giza |
| 40 | Nairobi | Kenyatta International Convention Centre |
| 41 | Serengeti | Moru Kopjes |
| 42 | Victoria Falls | Victoria Falls gorge |
| 43 | Cape Town | Table Mountain |
| 44 | Madagascar | Avenue of the Baobabs |
| 45 | Petra | Al-Khazneh (the Treasury) |
| 46 | Dubai | Burj Khalifa |
| 47 | Jaipur | Hawa Mahal |
| 48 | Kathmandu | Swayambhunath stupa |
| 49 | Bangkok | Wat Arun |
| 50 | Singapore | Merlion |
| 51 | Angkor | Angkor Wat |
| 52 | Hanoi | Turtle Tower |
| 53 | Bali | Ulun Danu Beratan temple |
| 54 | Hong Kong | Bank of China Tower |
| 55 | Taipei | Taipei 101 |
| 56 | Seoul | Gyeongbokgung Gwanghwamun gate |
| 57 | Kyoto | Fushimi Inari torii |
| 58 | Tokyo | Tokyo Tower |
| 59 | Great Barrier Reef | Heart Reef |
| 60 | Sydney | Sydney Opera House |
| 61 | Uluru | Uluru |
| 62 | Queenstown | Bob’s Peak gondola |
| 63 | Honolulu | Diamond Head |

Reference checks for less familiar regional features used the [National Park Service’s Shark Valley description](https://www.nps.gov/ever/planyourvisit/shark-valley-tamiami.htm), [Galápagos Conservancy’s Bartolomé description](https://www.galapagos.org/about_galapagos/the-islands/bartolome-island/), [Skyline’s Queenstown description](https://skylineenterprises.co.nz/what-we-do/tourism-operations/skyline-queenstown/) and [TANAPA’s Serengeti information](https://tanzaniaparks.go.tz/serengeti). These are simplified original geometric drawings, not photographs or detailed architectural models.
