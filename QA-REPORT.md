# Triply regression check — October 4, 2026

> Latest place-page update: 26 automated tests and 24 syntax checks pass. Place pages, category filters, canonical photo linkage, story/comment persistence, and mobile detail layout have been verified; see the latest PROGRESS.md entry. Uploads and comments were tested with synthetic data in an isolated database.

> Later pricing update: the Duffel and Booking.com adapters are now implemented. The current suite has 24 passing tests and 21 syntax checks. An actual Duffel account check returned 30 sandbox flight offers for JFK–LHR. Booking.com credentials remain absent; hotel/car provider tests use isolated fixtures. Production pricing access has not been verified. See PRICING-SETUP.md and the latest PROGRESS.md entry. The original regression findings below describe the earlier version.

## Result

20 automated tests passed; syntax checks passed for 20 JavaScript files. Browser checks below passed in the Codex browser. One reproducible saved-place bug was fixed. This is a functional regression pass, not a production certification or a guarantee of every external provider's availability.

## Fixed

Saving a place previously discarded its entry-fee details and photo metadata. After refreshing Saved places, the photo disappeared and the fee became “Check access & fees.” New saves now persist server-verified photo URLs, author/license/source attribution, and fee details. The saved card renders these after reload. Submitted photo URLs and fees are not trusted. Existing saves made before the fix can be refreshed by finding the place, removing the old save, and saving it again.

The new regression test verifies persistence across server restart, attribution, rejection of client-supplied photo metadata, and removing a save.

## Browser checks

| Area | Verification |
| --- | --- |
| Accounts | Sign-up, sign-in, sign-out, and switching between two isolated QA accounts |
| Discovery | India and California each show 12 appropriate city choices; live Paris viewpoints returned 35 places |
| Map | 35 live pins; card-to-pin popup; mobile Map toggle |
| Photos | 20 matching photos across the 35 live Paris results, with explicit unavailable states for the remainder; an uploaded community image loaded successfully |
| Filters | Free-entry filter excluded the unknown-fee fixture; end date earlier than start date was rejected |
| Saved places | Reproduced missing photo/fee before the fix; verified attributed photo markup and “No fee listed” after saving and reloading |
| Community | Photo upload, literal rendering of HTML-like caption text, quick question, comment, and threaded reply |
| Chat | Traveler lookup, introduction request, recipient acceptance, message delivery to the other account, and blocking |
| Currency | Live USD-to-NPR conversion returned a result and source update timestamp |
| Stays | Booking.com landing page retained Paris, October 18–21, 2026, two adults, one room, and USD |
| Flights / cars | Provider links render; missing flight credentials produce an explicit “not connected” message |
| Mobile | No horizontal document overflow in tested discovery, deals, community, messages, and saved views at 390 × 844 |
| Console | No browser JavaScript errors observed during these checks |

Community/account/chat writes used a separate local database on port 4174 with synthetic accounts and place fixtures. Public Wikimedia photos and currency rates were fetched live there. The main app on port 4173 was used for live destination/place/photo checks. No real traveler received a test message or post.

## Automated coverage

Run `npm run check` and `npm test` with Node.js 24 or later. Coverage includes account/session isolation, chat consent and blocking, post/comment persistence, saved-place privacy and persistence, request validation, static file restrictions, country/state/city selection, fee/date/budget filtering, currency caching and expiry, photo matching/license/host validation, photo retries/coalescing, and mocked Amadeus authentication/results sorting.

## Remaining external dependencies and limits

- The local Amadeus credential fields remain empty. Live flight fares cannot be verified until credentials are configured; production fares require the provider's approved access.
- Hotel and car cards are provider search links, not integrated live quotes or a verified cheapest-price ranking. Car links require entering the location and dates on the provider's site. Only the Booking.com landing page was checked end to end during this pass; no booking or payment was made.
- Photo coverage depends on reusable, matching public images. Not every place has one. Overpass, Wikimedia, map tiles, and currency services can fail or rate-limit independently of Triply.
- Cross-browser/device coverage, load testing, and a deployment security audit were not performed in this pass.
