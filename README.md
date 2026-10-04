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
- One destination field accepts a country, state, or city, without requiring a separate country dropdown. The resolved country supplies the local currency and saved-place context. Country/state searches open a city chooser instead of searching a 20 km circle around the area’s geographic center. Choose a city to load its nearby places; dates, budget and entry-fee filters carry over.
- Keyboard-accessible destination suggestions cover 250 countries/territories, 3,865 regions and 34,152 cities from a local GeoNames snapshot. Typing does not call Nominatim. Selecting a city uses its coordinates to distinguish cities with the same name. Refresh with `node scripts/sync-destinations.js`.
- Trip dates, traveler count, and budget carry into price searches. Flight, stay, and car budgets filter returned totals in the selected currency; outdoor budgets remain planning targets. The entry-fee filter includes only explicit `fee=no` map tags, excluding unknown costs. Dates do not verify outdoor opening hours or availability.
- An interactive Leaflet map links numbered pins to place cards, with List/Map views on mobile. Worldwide place photos use explicit Wikimedia/Wikidata references and Wikipedia article images, then public Commons uploads matching the place name and geotagged within 150 m. Approximate matches are labeled “Nearby photo” with distance; exact references are labeled “Place photo.” Missing images show “Photo unavailable,” never a repeated category photo. Each card also links to a destination-specific Google Images search. Photo coverage depends on public contributions, not the country selector.
- Photos load progressively in batches with at most three source requests in flight, coalesced lookups, one-day successful caches and ten-minute retry windows for missing photos. Credits, license names and source links accompany embedded photos. Hotel, flight, and car comparison cards retain clearly labeled illustrative photography.
- Country/state city choosers also show destination photos. City articles are matched by local/ASCII names and region/country, then checked against catalog coordinates (within 50 km) before their Commons photos are used. Wikidata coordinates fill gaps in Wikipedia article metadata. Coverage varies; unavailable photos keep their clear placeholder and Google Images link.
- Worldwide nearby discovery for camping, hiking, viewpoints, beaches, and cultural attractions using OpenStreetMap's Nominatim and Overpass services. Results depend on local map coverage. A submitted location is geocoded, then up to 35 mapped places within approximately 20 km are shown. Trail relation centers are approximate, not trailheads or safety assessments.
- Server-side flight price searches through Duffel and stay/car price searches through Booking.com Demand API, once approved account credentials are configured. Returned offers are sorted by total, with test/live labels and budget filters. Booking.com supplies offer links and hotel photos when available. Separate comparison links still open Google Flights/Hotels, Booking.com, Expedia, KAYAK, Rentalcars.com, and DiscoverCars.
- USD default, country currency lookup, and daily currency conversion. Unsupported rate codes are explicitly reported. Cached rates can be used for up to seven days during an outage and are labeled stale.
- Real local accounts with salted scrypt password hashes, server sessions, and HTTP-only cookies.
- Photo posts, comments, threaded replies, and quick questions such as “Where did you stay?” and “How much was it?” Photos are resized and re-encoded in the browser before upload.
- Opt-in traveler discovery, private message requests, acceptance/decline, chat with five-second polling, blocking, and stored reports. Chat shows the latest 500 messages; older messages remain in the database.
- Account-based saved places and responsive desktop/mobile layouts.

## Travel pricing connections

`lib/providers.js` implements native server-side adapters from the official [Duffel v2 documentation](https://duffel.com/docs/api/v2/offer-requests) and [Booking.com Demand v3.2 specification](https://developers.booking.com/demand/docs/open-api/3.2/demand-api). The earlier Amadeus self-service integration has been replaced; its official SDK and specification repositories are archived. Existing Amadeus variables are ignored.

For a new installation, copy `.env.example` to `.env`. For an existing installation, edit only the relevant values in `.env` (do not overwrite other settings):

```dotenv
DUFFEL_ACCESS_TOKEN=your_duffel_token
BOOKING_API_TOKEN=your_booking_demand_token
BOOKING_AFFILIATE_ID=your_numeric_affiliate_id
BOOKING_ENV=test
```

Restart the server after changes. Duffel's response determines whether its offers are test or live; use a test token until your account is approved for live use. Booking.com uses its sandbox unless `BOOKING_ENV=production` is explicitly set with approved product access. Tokens remain server-side and ignored by Git. See [PRICING-SETUP.md](PRICING-SETUP.md) for account setup and verification.

Run `node scripts/check-pricing.js` to safely check all three products. Configured adapters perform searches 30 days ahead (JFK–LHR, Amsterdam stays, AMS rentals), printing status/counts without credentials or raw payloads. These are API calls against your account; normal provider usage limits apply. Unconfigured adapters do not make external requests.

Scope: flights are one-way economy for 1–9 adults; stays are one room for all selected adults within 10 km of the selected city; rentals use the same pickup/return location with explicit local times, driver age, and country of residence. Cars accept a city choice or an IATA airport code. Choose a city suggestion for hotel searches to disambiguate names. Hotel and car results use full-stay/full-rental totals, not nightly or daily teaser prices. Only returned offers in the selected currency are compared; unsupported returned currencies are listed in the message. Duffel determines its quote currency; it is not forced or silently converted.

This compares options within a connected provider's returned inventory, not identical products across every booking website. Booking.com live offers link to provider-supplied URLs, with host validation. Car results currently show category/supplier and a vehicle reference; the provider page gives model/depot details. Flight quote checkout/ticketing is not implemented; separate airline/booking-site searches can have different prices. Expired flight offers are excluded at fetch/render. Conditional charges, optional extras, and cancellation deadlines must be reviewed on the provider. No credentials, bookings, or live availability are claimed from fixture tests.

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

Tests exercise real temporary SQLite instances: account/session isolation, chat consent and blocking, uploads, comments, saved places, restart persistence, request validation, and static-file restrictions. Provider fixtures cover Duffel response modes, carrier display, expiry/currency filtering, Booking.com full totals, residence/driver/date mapping, URL validation, missing credentials, coalescing, sanitized failures, and partial metadata failure. They do not establish live provider access or certification.

Optional manual network smoke check: `node scripts/check-services.js`. GitHub Actions runs syntax and automated checks on push and pull requests.

## Data and licenses

See [THIRD_PARTY.md](THIRD_PARTY.md). Country data is available from `/data/countries.json`; its ODbL and Unicode notices are linked in the app footer. Remote inspiration photos are illustrative. User photos belong to their authors.
