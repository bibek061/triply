# Triply regression check — October 4, 2026

## Google embed preparation — October 8, 2026

- 29 tests and 27 syntax checks pass. New checks cover Google search URLs across categories, destination escaping, required referrer policy, hidden admission control, and exposing only the dedicated browser key in public configuration.
- No real Google key is configured. Actual map rendering, key restrictions and Google authorization remain unverified. The feature is disabled by default; the existing public fallback remains available.

## Hosted follow-up — October 8, 2026

- Render's HTTPS site, database health endpoint and destination suggestions respond. The initial hosted build passed 28 tests and 26 syntax checks.
- Nearby discovery is currently blocked by upstream map service failures from Render. Earlier successful local Overpass checks below do not establish hosted availability.
- Hosted live pricing credentials remain unconfigured. External booking-site comparison links are independent of those credentials.
- Added an outage recovery link to Google Maps that retains the selected category and destination, alongside retry. It explicitly explains that trip dates, budget and facility filters do not carry over.
- All 28 tests and 26 JavaScript syntax checks pass. An isolated outage preview verified Paris camping and hiking links, retry, and a 390 × 844 viewport with no horizontal document overflow or JavaScript console errors.

## Final regression pass — October 4, 2026

- All **26 automated tests** and **24 JavaScript syntax checks** passed. Whitespace checks passed. No new functional regression was found during this pass.
- Public Nominatim and Overpass checks returned HTTP 200 and 35 places. The main app rendered all 12 displayed India city photographs, with Camping retained as the selected category and city guidance.
- An actual Duffel account check returned 30 sandbox flight offers. The browser displayed JFK–LHR test fares with total prices, expiry times and TEST DATA labels. Editing the destination removed old fare cards and updated the Google Flights URL.
- Hotel and car searches with a selected Paris destination correctly reported that Booking.com pricing is not connected. Each retained five comparison websites. Copied rental details included dates, local times, driver age, travelers, currency and residence. An end date before the start date was rejected.
- In an isolated local database, saved-place removal and re-saving worked. A traveler photo's story link scrolled to its gallery. The quick-question dialog prefilled the question and successfully posted a synthetic comment to that place's story.
- Camping's Showers filter reduced three fixtures to one card and one pin. Switching to Hiking displayed two trails. A 2 km maximum produced an honest empty state with no pins; Clear filters restored both results. Trail details displayed 4 km length and 900 m elevation above sea level.
- Discovery, place details and car comparison had no horizontal document overflow at 390 × 844. No browser JavaScript errors were observed in the two QA tabs.

Automated coverage includes authentication/session isolation, consent and blocking for chat, posts/comments, saved-place persistence, destination scope, map/photo matching, facility/trail filters, canonical place linkage, currency caching, provider adapters and HTTP validation. Write checks used synthetic accounts and an isolated database on port 4174; real-provider/read-only checks used the main app on port 4173. No booking, payment, or message to a real traveler was created.

### Outstanding external limits

- Duffel is connected in **test mode**, not verified production flight pricing. Checkout/ticketing is not implemented.
- Booking.com hotel/car credentials and product access remain unconfigured. Its adapters pass fixture tests, but account responses and production offers are not verified. The pricing-check command intentionally exits nonzero while these providers are unconfigured.
- The extra booking websites are comparison links, not additional live quote feeds or a verified cheapest-price ranking. This final pass checked link generation and fallback behavior; it did not retest every external landing page or checkout.
- Photo/map/rate coverage and availability depend on external services. Some places have no suitable photo. This pass does not establish cross-browser coverage, load capacity, or deployment security readiness.

See PRICING-SETUP.md for provider setup. The sections below are historical records of the earlier regression pass; their test counts and Amadeus status do not describe the current build.

## Earlier regression record

### Earlier result

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
