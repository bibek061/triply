# Connect Triply pricing

The adapters and UI are implemented. Production pricing is enabled only by working, approved provider credentials. Creating an account alone does not grant every product permission.

## Flights: Duffel

1. Sign in to your [Duffel dashboard](https://app.duffel.com/).
2. In Access tokens, create a test token permitted to create offer requests. Follow the [authentication guide](https://duffel.com/docs/api/overview/making-requests).
3. Add it after `DUFFEL_ACCESS_TOKEN=` in the local `.env` file and save.
4. Run the connection check below. A `sandbox` response proves test access, not live fares.
5. Complete Duffel's live onboarding and use an approved live token when ready. Triply reads `live_mode` from the provider response before labeling a fare live.

Amadeus check-in-link examples retrieve an airline's check-in page. They do not supply search prices. This project has replaced the old self-service flight adapter; Amadeus Enterprise access would require a separate, contract-specific integration.

## Stays and cars: Booking.com Demand

1. Use your managed affiliate Partner Centre account to obtain a Demand API token and numeric affiliate ID. A normal Booking.com traveler or property-owner account is insufficient. See [authentication](https://developers.booking.com/demand/docs/development-guide/authentication).
2. Save `BOOKING_API_TOKEN=` and `BOOKING_AFFILIATE_ID=` in `.env`.
3. Leave `BOOKING_ENV=test` for sandbox calls. Confirm accommodations and cars permissions with your partner account contact.
4. Use `BOOKING_ENV=production` only after production access is approved. Review the provider's integration/certification and branding requirements before public launch.

## Verify

Use Node.js 24 or later:

```sh
node scripts/check-pricing.js
```

The check requests one flight search, one stay search and one car search when configured. It prints safe status/count summaries. It never creates a booking, order, or payment.

| Status | Meaning |
| --- | --- |
| not_configured | One or more required values are empty, or the affiliate ID is not numeric |
| access_required | Provider rejected authentication or product permissions; check token, account, and environment |
| sandbox | Provider returned test data; not bookable live prices |
| live | Production search succeeded; zero offers can still mean no inventory for the criteria |
| rate_limited | Wait before retrying; review your account quota |
| unavailable | Provider request, network, or response could not be completed |

Restart `node server.js` after saving `.env`, then search from Travel deals. Select a city suggestion for hotels. Enter country of residence for hotels/cars, plus driver age and local pickup/return times for cars. Do not paste tokens into chat, upload `.env`, or commit it.

The local connection check on October 4, 2026 returned `sandbox` with 30 Duffel flight offers for JFK–LHR. The approved test token is saved only in ignored local configuration. Production flight access is not enabled. Booking.com stays and cars still return `not_configured`; their provider credentials are absent. Automated hotel/car checks use isolated fixtures and do not establish access to those products.
