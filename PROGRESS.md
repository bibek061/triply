# Triply progress

## Google Maps embed preparation — October 8, 2026 (New York)

- Added optional in-page Google Maps Embed search, tied to the selected destination and category. Configured searches bypass Overpass and hide unsupported admission/facility filters.
- Added narrow iframe content-security policy permission and documented API/website restrictions for the public browser key. Other provider secrets remain private.
- All 29 tests and 27 syntax checks pass, including category changes, escaped destination text, embed URL/referrer policy, and public-config secret isolation.
- Activation and real Google result verification require the user's own Google Cloud key. No Google account, key, billing agreement, or subscription was created; this is not yet an active Google map integration on the public site.

## Hosted follow-up — October 8, 2026 (New York)

- Public deployment: https://triply-cvze.onrender.com, with persistent storage on Render. Launch build passed 28 tests and 26 syntax checks.
- Diagnosed hosted nearby discovery failures across three public Overpass endpoints. User chose the free external map fallback; no managed provider account or subscription was created.
- Added category/destination-specific Google Maps recovery links for failed nearby searches, retaining the in-app retry action and explaining external filter limitations.
- Updated deployment and QA documentation to distinguish working hosted services from unavailable nearby discovery and unconfigured hosted live pricing.
- Validation: all 28 tests and 26 JavaScript syntax checks pass. Browser outage preview verified Paris camping and hiking links, retry, and mobile layout without horizontal overflow or JavaScript errors.

## Completed — October 3, 2026 (New York)

- Original prototype created and pushed: `05ebd16`.
- Global catalog and persistent backend checkpoint pushed: `2662215`.
- Replaced the sample marketplace with global discovery, flight/stay/car provider comparison, a real photo community, and private chat.
- Added 250 countries/territories and 153 current currency codes, including USD. GitHub data sources, adapted catalog download, and licenses are included.
- Added optional Amadeus OAuth/Flight Offers Search integration based on the official GitHub SDK and API specification. Secrets stay in ignored environment configuration.
- Added live OpenStreetMap nearby discovery. Replaced slow relation-around queries with indexed bounding boxes plus distance filtering. Geocodes are paced/cached; place queries are serialized/coalesced/cached. Incomplete API responses produce errors instead of misleading empty results.
- Added live daily currency conversion with labeled, bounded stale-cache fallback.
- Added SQLite-backed accounts, sessions, photo posts, comment replies and quick questions, saved places, opt-in traveler search, message requests, acceptance/decline, blocking, and reports.
- Added responsive UI, protected static-file serving, source attribution, configuration/deployment documentation, and GitHub Actions checks.
- Removed unused sample listings, fixed exchange-rate examples, and browser-only comment code.

## Verified

- Seven automated tests pass, covering account/session isolation, chat consent/blocking, uploads, comments, saves, persistence after restart, input validation, static-file restrictions, Amadeus authentication/currency sorting, discovery coalescing/caching, partial responses, and currency cache expiry.
- Syntax checks pass for every shipped JavaScript file and test.
- Live Nominatim and Overpass request returned 35 mapped viewpoints near Pokhara; the same search rendered successfully in the browser.
- Live USD-to-NPR conversion rendered successfully with the provider's update time.
- Isolated browser QA: sign in, photo upload, quick-question comment, message request, acceptance, and reply all passed. Test users/uploads were kept outside the main app's data.
- Mobile deals layout at 390 × 844 has no horizontal overflow. Edited trip details persist through searches/category changes. Provider URLs contain applicable query details.

## Still requires external setup or further product work

- The owner must supply Amadeus credentials and production approval to enable live flight fares. GitHub supplies integration code, not private access credentials.
- Hotel/car comparisons open provider searches. No cross-provider live feed is connected, so Triply cannot claim a globally cheapest offer or route based on verified matching quotes.
- Public deployment has not been performed. Launch needs persistent hosting, HTTPS, suitable discovery capacity, operational moderation, account recovery/deletion, and the other items documented in README.md.

## Combined destination search — October 3, 2026 (New York)

- Combined the country dropdown and city input into one destination field for countries, states, and cities, including stays and cars.
- Worldwide geocoding now resolves the country from the destination instead of applying a stale country filter. Provider searches use the entered destination as-is.
- Kept resolved country context for local currency and saved places; broad region searches explicitly describe results around their mapped center.
- Eight automated tests pass, including country/state/city lookup without a hidden country restriction. Live browser search for Paris, France returned 35 viewpoints and EUR context. Mobile verification found one destination input, no country dropdown, and no horizontal overflow.

## Destination discovery, photos, and map — October 3, 2026 (New York)

- Added local suggestions for 250 countries/territories, 3,865 regions and 34,152 cities. Suggestions include state/country labels and keyboard selection. Selected city coordinates prevent ambiguous same-name city searches. GeoNames attribution and a refresh script are included.
- Added trip dates, traveler count, budget planning, flight-total filtering in the selected currency, and a filter for explicitly free entry. Unknown fees are excluded; outdoor dates/budgets do not imply verified availability or total trip costs.
- Added an interactive Leaflet map with numbered pins matching place cards, pin popups, card-to-map navigation and mobile List/Map switching.
- Added attributed photo coverage for every place and flight/stay/car provider card. Explicit Wikimedia/Wikidata references supply actual place photos where available. Other cards show category photos labeled Travel inspiration. Missing remote images do not remove place results.
- Live browser verification: Paris returned 35 viewpoints and 35 pins; the free-entry filter returned 3 cards and 3 pins. Five of the full results matched actual Wikimedia photo metadata. A separate Eiffel Tower lookup returned an attributed photo successfully.
- Mobile verification at 390 × 844: no horizontal overflow, List/Map toggles work, and booking links preserve applicable trip details. Provider photos loaded successfully. Keyboard destination selection and card-to-pin popups worked. Browser reported no JavaScript errors during these checks.
- All 13 automated tests and 19 JavaScript syntax checks pass. New tests cover destination disambiguation, selected coordinates, budget/currency/date/fee boundaries, photo attribution, caching, host validation and outages, plus API input validation.
- Added a safe Amadeus connection-check script and setup documentation. The saved local credentials remain empty, so no sandbox or production fares are connected. The app explicitly reports this and continues to provide booking-provider search links. Production approval and hotel/car live feeds remain external setup work.

## Worldwide public place photos — October 3, 2026 (New York)

- Removed repeated category photos from named place cards and map popups. Missing/broken images show a clear unavailable state.
- Expanded public photo lookup to tagged Wikipedia articles and Commons geotagged uploads worldwide, in addition to exact Wikimedia/Wikidata references. Name and distance checks reject unrelated nearby files; approximate matches are labeled with distance, source, author and license. Duplicate nearby photos are not assigned to different cards in the server cache.
- Added place-specific Google Images search links without scraping or republishing Google/social-media results.
- Added progressive loading, bounded source concurrency, shared in-flight requests, cache expiry and retries for missing photos.
- Live network checks returned attributed, name-matched photos for Pont des Arts (France), Fewa Lake (Nepal) and Sydney Opera House (Australia). This verifies examples across countries, not complete photo coverage of all locations.
- Sixteen automated tests pass, including Wikipedia redirects, reusable-image requests, name/distance matching, nearby-photo deduplication, attribution and retry/coalescing behavior.
- Browser verification: Paris viewpoints now have 23 exact/nearby photos across 35 cards, up from 5 direct-reference photos. All 35 cards link to the correct place-specific Google search; missing photos use clear placeholders. Loaded photos, map popups, attribution and progressive completion were checked with no browser errors.

## Country and state search correction — October 3, 2026 (New York)

- Fixed country/state searches that previously looked only within 20 km of a geographic center and could misleadingly return no places. Typed catalog names and selected suggestions now open a chooser of up to 12 larger cities within that country/state, using local data without an external map request.
- City selection uses its exact catalog coordinates and preserves dates, travelers, budget and entry-fee filters. The chooser explicitly describes its cities as starting points, not a complete attraction list, and includes photo-search links.
- Corrected error/empty-state wording: map-service failures no longer report zero places, and missing mapped results are distinguished from the free-entry filter excluding places.
- Seventeen automated tests pass, including typed India through the HTTP API, region containment, explicit city behavior and existing map/photo/chat checks. Browser India search shows 12 cities; selecting Mumbai preserved the budget, and its viewpoints search returned 19 places. Mumbai's all-category query encountered an external service failure, which is handled with retry messaging.

## Photos on country and state city cards — October 4, 2026 (New York)

- Added real city photos to the country/state chooser cards, replacing the pin-only presentation. Photos load progressively with author/license credits and clear unavailable states; the existing Explore and Google Images actions remain.
- Added a rate-limited endpoint accepting only catalog city IDs. City-name variants, regional qualifiers, and Wikipedia/Wikidata coordinates check destination matches before displaying Commons images. Distant namesakes and mismatched supplied country codes are rejected.
- Live source checks returned photos for all 12 displayed India cities, all 12 Nepal cities, and 11 of 12 France cities. This is tested sample coverage, not a guarantee that every destination has an image.
- Nineteen automated tests pass, including wrong-country article rejection, regional-title matching, Wikidata coordinate fallback, and endpoint input/batch limits.
- Browser verification: India and Nepal each render 12 city-photo cards with the first visible images loaded; Nepal has 12 distinct image URLs. Mobile at 390 × 844 has no horizontal overflow. Photo credits and city actions remain visible, with no browser errors during these checks.

## Functional regression testing — October 4, 2026 (New York)

- Tested discovery, maps, filters, accounts, uploads, comments/replies, traveler search, chat acceptance/delivery/blocking, saves, currency conversion, and booking links. Write tests used an isolated local database and synthetic accounts.
- Fixed a reproduced bug where saved places lost their verified photo attribution and fee details after reload. These details now persist on new saves; arbitrary submitted image metadata is ignored.
- All 20 automated tests and 20 JavaScript syntax checks pass. Added a saved-place restart/persistence regression test.
- Live Paris search returned 35 places/pins and 20 matching photos. India and California each showed 12 city choices. Booking.com retained destination, dates, guests and USD on its actual search page. Mobile pages had no horizontal overflow in the checked views, and no browser JavaScript errors were observed.
- Live currency conversion passed. Amadeus credentials are still absent; hotel/car live-price feeds are not integrated. Full scope and limitations are recorded in QA-REPORT.md.

## Flight, stay, and car pricing integrations — October 4, 2026 (New York)

- Replaced the old Amadeus self-service flight adapter after finding its official SDK/specification repositories archived. Added the current Duffel v2 offer-request integration; mode comes from the API response, expired/partial offers are excluded, and operating carriers are displayed.
- Added Booking.com Demand v3.2 hotel search/details and rental-car search/supplier integrations. Requests preserve full travel dates, adults, currency and residence; cars additionally include driver age, local pickup/return times, and minimum seats. Hotel queries use selected city coordinates and one room. Provider photos and direct live offer links are validated before rendering.
- Added sorted total-price cards above the existing booking-site links, explicit test/live/error states, offer timestamps, flight expiry text, and maximum-total filters for each category. Editing search criteria immediately removes stale prices. Unsupported quote currencies are reported without invented conversion.
- Added safe configuration checks and PRICING-SETUP.md. Created the owner-approved Duffel test token and saved it in ignored local .env. The actual account connection check returned 30 sandbox flight offers for JFK–LHR. Booking.com stays/cars remain unconfigured; sandbox success does not establish production access.
- All 24 automated tests and 21 JavaScript syntax checks pass. New tests cover provider request contracts, totals, currencies, mode labeling, malformed/expired data, sanitized errors, coalescing, safe URLs, partial detail failure, and HTTP validation. Browser tests with isolated synthetic providers verified flight/hotel/car results, sorting, budget filtering, stale-result clearing, mobile layout, and no JavaScript errors.
- Verified the actual Duffel sandbox connection end to end in the main app: JFK–LHR on November 3 for two adults displayed sorted USD totals, operating airlines, expiry times, and explicit TEST DATA labels with no browser JavaScript errors. No order or payment was created.
- Remaining: configure Booking.com credentials and product permissions, verify its sandbox responses, obtain approved production access, and complete provider launch requirements. Flight checkout/ticketing, a full rental vehicle/model catalog, and identical-offer comparison across different booking websites remain outside this implementation.

## More booking comparison websites — October 4, 2026 (New York)

- Added Skyscanner and Trip.com flight links, Agoda and Hotels.com stay links, and Skyscanner Cars and Auto Europe rental links. Each category now has five comparison websites. These open official provider search pages; additional live-price feeds are not connected.
- Added Copy trip details with a selectable-text fallback when clipboard access fails. Flight summaries include route and economy cabin; stays include both dates and one room; cars include local times, same-location return, driver age, and residence. Existing parameterized links now refresh as trip fields change.
- Verified all three provider lists, copied flight/stay/car details, updated Google Flights/KAYAK/Booking.com URLs, and the mobile car layout at 390 × 844 with no horizontal overflow. Browser logs showed no JavaScript errors; all 21 JavaScript syntax checks pass. Provider home/search pages were checked using official sources; checkout and purchases were not tested.

## Category buttons search the chosen destination — October 4, 2026 (New York)

- Removed the requirement to complete an earlier search before category buttons load places. Camping, Hiking, Viewpoints, Beaches, Culture & sights, and All places now immediately search the current destination. Form validation prevents a blank destination from launching a search.
- Verified a fresh-page Camping click returned nine mapped campsites near Pokhara, replacing the inspiration cards. Changing the destination to India and clicking Camping opened its 12-city chooser; Hiking updated its category guidance. Selecting Paris, France from suggestions and clicking Viewpoints returned 35 matching places. The entered budget stayed at USD 600 through destination/category changes, and blank-destination validation passed. JavaScript syntax and whitespace checks passed.

## Place pages, category filters, and linked traveler photos — October 4, 2026 (New York)

- Added persistent place detail pages with sourced facts, directions, optional listed websites, save actions, and traveler stories. SQLite gains an additive place catalog and nullable post-to-place relationship; existing posts remain available.
- Added category-specific facility filters, hiking SAC difficulty and known trail-length filters, and matching map pins/counts. Unknown facilities and measurements are excluded only when the corresponding filter is selected. Elevation is labeled as altitude, never elevation gain. Named mapped hiking ways with SAC tags are now included alongside routes and peaks.
- Photo uploads from place pages attach to a validated place ID; the server supplies known location/country/category instead of trusting submitted replacements. Stories and comments persist and appear in Community. Traveler photo fallbacks retain author labels and link to the place stories.
- All 26 automated tests and 24 JavaScript syntax checks pass. New coverage checks unknown values, unit conversion, unsafe website rejection, canonical place linkage, authentication, cross-place story isolation, comments, unlinked legacy posts, and persistence across restart.
- Isolated browser QA verified campsite facilities filtering (three results to one plus one pin), hiking length/difficulty filtering, linked photo upload, comments, saving, reload, and a 390 × 844 detail layout without horizontal overflow. Tests used synthetic accounts/photos on port 4174, separate from the main app database.
- Main-app verification returned 35 real Paris viewpoints and opened the Pont des Arts detail page with its attributed nearby Commons photograph and coordinate-based directions. No browser JavaScript errors were observed.

## Final regression pass — October 4, 2026 (New York)

- Re-ran all 26 automated tests, 24 JavaScript syntax checks and whitespace validation; all passed. No new functional regression was found.
- Rechecked live Nominatim/Overpass (HTTP 200; 35 places), all 12 displayed India city photos, and actual Duffel sandbox pricing (30 offers plus browser TEST DATA/expiry labels). Editing the flight route cleared stale fare cards.
- Verified invalid-date rejection, hotel/car not-connected messaging, five comparison links per category, and complete copied car-trip details. Booking.com remains unconfigured; Duffel production access remains unverified.
- Isolated browser checks covered saved-place removal/re-saving, traveler-photo story navigation, quick-question commenting, category changes, facility filters, empty-filter recovery and matching map pins. Mobile discovery/detail/car views had no horizontal overflow at 390 × 844; no browser JavaScript errors were observed.
- Updated QA-REPORT.md with current evidence and explicit provider/deployment limits, keeping earlier findings labeled as historical. Test accounts/posts stayed in the separate local QA database; no reservations or payments were created.

## Deployment preparation — October 4, 2026 (New York)

- Added production startup validation for an HTTPS public origin and persistent data path, automatic Render origin detection, graceful shutdown, and a database-backed /healthz endpoint.
- Added an optional Render Blueprint with a single Node 24 instance, 1 GB persistent disk, health checks, and deployment after CI passes. DEPLOYMENT.md also documents settings for an existing Node hosting account, costs, secrets, persistence verification and rollback limits.
- All 28 automated tests and 26 JavaScript syntax checks pass. New integration coverage verifies Secure/HttpOnly cookies, cross-origin write rejection, health GET/HEAD, and private-file isolation.
- The owner chose an existing hosting account; its provider name/dashboard URL is still needed. No paid service was created, no local user database or credentials were transferred, and no public launch is claimed.
