# Triply

Find places to go, compare travel providers, and meet other travelers. Triply is a working local MVP with a Node.js backend and persistent SQLite data. The interface uses plain HTML, CSS, and JavaScript; there are no runtime package dependencies.

## Run

Requires Node.js 24 or newer.

```sh
node server.js
```

Open http://127.0.0.1:4173. The app needs its server; opening index.html directly will not work. Accounts, uploads, messages, and saved places live in `private-data/`, which is excluded from Git. No sample accounts or fictional prices are seeded into the main app.

## What works

- 250 countries and territories, with 153 active currency codes (including USD). Country records come from mledoze/countries; current tender periods come from Unicode CLDR. Refresh with `node scripts/sync-countries.js`.
- One destination field accepts a country, state, or city, without requiring a separate country dropdown. The resolved country supplies the local currency and saved-place context. Country/state searches show nearby results around their mapped center; specify a city for a more focused search.
- Keyboard-accessible destination suggestions cover 250 countries/territories, 3,865 regions and 34,152 cities from a local GeoNames snapshot. Typing does not call Nominatim. Selecting a city uses its coordinates to distinguish cities with the same name. Refresh with `node scripts/sync-destinations.js`.
- Trip dates, traveler count, and a budget field carry into provider comparisons. Flight budgets filter returned totals in the selected currency; outdoor budgets are planning targets. The entry-fee filter includes only explicit `fee=no` map tags, excluding unknown costs. Dates do not verify outdoor opening hours or availability.
- An interactive Leaflet map links numbered pins to place cards, with List/Map views on mobile. Every place card starts with an attributed category photo. Exact OSM-linked Wikimedia/Wikidata images replace it when available; fallback images remain clearly labeled “Travel inspiration.” Hotel, flight, and car comparison cards also include illustrative photos.
- Worldwide nearby discovery for camping, hiking, viewpoints, beaches, and cultural attractions using OpenStreetMap's Nominatim and Overpass services. Results depend on local map coverage. A submitted location is geocoded, then up to 35 mapped places within approximately 20 km are shown. Trail relation centers are approximate, not trailheads or safety assessments.
- Provider comparisons for flights, stays, and rental cars. Buttons open Google Flights/Hotels, Booking.com, Expedia, KAYAK, Rentalcars.com, or DiscoverCars. Destination/date/currency information is included where supported; other links open the provider's search form. These are not affiliate integrations or rankings of current prices.
- USD default, country currency lookup, and daily currency conversion. Unsupported rate codes are explicitly reported. Cached rates can be used for up to seven days during an outage and are labeled stale.
- Real local accounts with salted scrypt password hashes, server sessions, and HTTP-only cookies.
- Photo posts, comments, threaded replies, and quick questions such as “Where did you stay?” and “How much was it?” Photos are resized and re-encoded in the browser before upload.
- Opt-in traveler discovery, private message requests, acceptance/decline, chat with five-second polling, blocking, and stored reports. Chat shows the latest 500 messages; older messages remain in the database.
- Account-based saved places and responsive desktop/mobile layouts.

## Travel API integration from GitHub

`lib/providers.js` implements the OAuth and Flight Offers Search flow documented by the official [Amadeus Node SDK](https://github.com/amadeus4dev/amadeus-node) and [OpenAPI specification](https://github.com/amadeus4dev/amadeus-open-api-specification). It uses native server-side fetch instead of adding an SDK dependency.

Copy `.env.example` to `.env` and supply credentials from your own Amadeus developer account:

```dotenv
AMADEUS_CLIENT_ID=your_client_id
AMADEUS_CLIENT_SECRET=your_client_secret
AMADEUS_ENV=test
```

Restart the server after configuration changes. Use three-letter IATA airport codes for API searches. `test` returns clearly labeled sandbox fares; approved production credentials plus `AMADEUS_ENV=production` are required for live results. Credentials are never sent to the browser or committed to Git.

Run `node scripts/check-pricing.js` to verify configuration safely. It makes one JFK–LHR search 30 days ahead when credentials are present and prints only status and offer count, never keys or tokens. An unconfigured result means the saved environment fields are still empty.

The adapter sorts returned Amadeus totals in the selected currency. It does not establish the lowest price across every provider, create bookings, or guarantee the same fare on separate provider links. Hotel/car live inventory integrations and automatic cross-provider price matching remain future work. The app never substitutes fabricated prices when credentials or services are unavailable.

## Configuration and hosting

`.env.example` documents `PORT`, `HOST`, `DATA_DIR`, `PUBLIC_ORIGIN`, and discovery endpoints. The default server is local-only. For a hosted instance:

1. Use a persistent Node.js 24 server and a persistent disk for `DATA_DIR`. SQLite and uploads must survive restarts and deploys. Back up both together.
2. Put HTTPS in front of the server and set `PUBLIC_ORIGIN` to the exact public origin. This validates mutating requests and enables Secure cookies. Set `HOST` for the deployment network; do not expose the local development server as-is.
3. Run one application instance. Current rate limiting, API token caching, and geocoder pacing are per process; multi-instance hosting needs shared coordination and storage.
4. Configure managed or self-hosted discovery endpoints before public scale. The public Nominatim service is paced below one request per second and geocodes are cached for a day. Place queries are serialized, coalesced, and cached for an hour. Public Overpass has no uptime guarantee and can reject or time out queries. The browser loads standard OpenStreetMap tiles on demand with visible attribution; no bulk downloads or offline prefetching are implemented. Follow the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) and arrange a suitable tile provider for public traffic.
5. Add operational account recovery/deletion, server-side image decoding, moderation tools/staffing, backups, monitoring, and abuse controls appropriate for public launch. Reports are stored but do not notify a staffed team. Password reset, email verification, notification delivery, and end-to-end chat encryption are not implemented.

No public deployment, payment processing, flight ticketing, or external booking synchronization has been performed.

## Verification

```sh
node scripts/check.js
node --test tests/*.test.js
```

Tests exercise real temporary SQLite instances: account/session isolation, chat consent and blocking, uploads, comments, saved places, restart persistence, request validation, and static-file restrictions. Additional tests cover destination disambiguation, selected coordinates, date/budget/fee boundaries, attributed photo matching and failure handling, Amadeus authentication/currency sorting, discovery caching and incomplete results, and exchange-rate expiry. They do not claim live flight-provider certification.

Optional manual network smoke check: `node scripts/check-services.js`. GitHub Actions runs syntax and automated checks on push and pull requests.

## Data and licenses

See [THIRD_PARTY.md](THIRD_PARTY.md). Country data is available from `/data/countries.json`; its ODbL and Unicode notices are linked in the app footer. Remote inspiration photos are illustrative. User photos belong to their authors.
