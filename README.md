# Triply

A responsive travel marketplace prototype for Nepal and India. Built with plain HTML, CSS, and JavaScript; no build step or dependencies.

## Run

Run `node server.js`, then open http://127.0.0.1:4173. You can also open `index.html` directly for a quick preview.

## Try it

- Search hotels, one-way flights, rental cars, and three-night bundles.
- Filter by budget, free cancellation, or Express Deals, and sort by savings, price, or rating.
- Save deals and Local Picks, explore place details, and find nearby hotels.
- Open a post’s comments, use “Where did you stay?” or “How much was it?” as a draft, and post your own questions or threaded replies. Comments persist in this browser; sample travelers do not receive messages or automatically respond. Comments are limited to 500 characters and rendered as plain text.
- Open a deal and continue to Booking.com for hotels, Expedia for flights and packages, or Rentalcars.com for cars. Hotel searches carry dates, guest count, and currency; other categories open the provider search page, where travelers enter their trip details.
- Switch between USD (the default for new visitors), NPR, and INR, or use desktop dark mode.

Saved items, comments, earlier demo bookings, display currency, and theme are stored locally in the browser. Search dates validate ranges but do not query availability. Currency conversions are fixed examples: USD 1 = NPR 135; INR 1 = NPR 1.60. These are not live exchange rates. Hotel prices cover one room for the selected guests. Flights and bundles are priced per person. Check current prices, taxes, availability, and cancellation conditions directly with the provider.

## Prototype boundaries

Triply’s listings, prices, ratings, stories, and verification badges are sample data. Deal buttons open real external booking websites; they do not establish a partnership or guarantee the sample offer. Fictional hotels and mystery stays link to area searches. No live inventory API, authentication, payment processing, email, or reservation sync is connected. External bookings do not appear in My Trips or unlock verified posting. Photography from Unsplash is illustrative rather than verified imagery of named properties. Google Fonts and remote photography need an internet connection; system fonts and background colors provide fallbacks.

## Checks

Run `node --test travel-utils.test.js` to verify currency formatting and booking-link routing. Run `npm run check` for JavaScript syntax checks.

The development server listens only on the local computer and serves only the frontend HTML, CSS, and JavaScript files. It is not a production hosting, social, or booking backend.
