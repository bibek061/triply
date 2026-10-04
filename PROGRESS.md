# Triply progress

## Foundation

- Original responsive prototype pushed to `bibek061/triply` on `main`.
- Global catalog: 250 countries and territories from mledoze/countries on GitHub.
- Currency mapping refreshed from Unicode CLDR active tender periods: 153 distinct codes, plus USD.
- Added SQLite-backed accounts, sessions, photo posts, comments, saved places, message requests, acceptance, blocking, and reports.
- Added server-side Nominatim/Overpass discovery with caching and geocoder pacing.
- Added currency conversion with cached daily ExchangeRate-API rates and attribution.
- Added an optional Amadeus flight search adapter based on its official GitHub API examples. Credentials remain in an ignored local `.env`.

## In progress

- Connect the global discovery and community interface to the new APIs.
- Test account isolation, chat consent, persistence, input validation, and provider integrations.
- Document deployment configuration and remaining production requirements.

## External dependencies

- Live airfares require the owner's Amadeus credentials and production approval. Repository code does not include access credentials.
- Hotel and car comparison currently routes to provider searches; there is no cross-provider live inventory feed.
- Public use requires hosted persistent storage, HTTPS, and operational account recovery/moderation workflows.
