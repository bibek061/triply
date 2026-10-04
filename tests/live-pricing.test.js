"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { createProviders, safeURL } = require("../lib/providers");
const reply = (data) => ({ ok: true, json: async () => data });
const q = {
  start: "2099-11-01",
  end: "2099-11-04",
  adults: 2,
  currency: "USD",
  residence: "US",
  lat: 48.85,
  lon: 2.35,
  origin: "JFK",
  destination: "LHR",
  driverAge: 31,
  pickupTime: "09:30",
  dropoffTime: "17:00",
};
const bookingEnv = {
  BOOKING_API_TOKEN: "private-token",
  BOOKING_AFFILIATE_ID: "12345",
  BOOKING_ENV: "production",
};
test("new pricing adapters never invent offers or call providers without configuration", async () => {
  const p = createProviders({
    env: {},
    fetchImpl: () => {
      throw Error("No request expected");
    },
  });
  for (const kind of ["flights", "stays", "cars"]) {
    const r = await p[kind](q);
    assert.equal(r.status, "not_configured");
    assert.deepEqual(r.offers, []);
  }
});
test("Duffel search verifies response mode, full adult totals, carrier names, currency and expiry", async () => {
  let payload;
  const p = createProviders({
    env: { DUFFEL_ACCESS_TOKEN: "duffel_live_private" },
    fetchImpl: async (url, options) => {
      assert.match(url, /api\.duffel\.com\/air\/offer_requests/);
      assert.equal(options.headers["Duffel-Version"], "v2");
      payload = JSON.parse(options.body).data;
      return reply({
        data: {
          live_mode: false,
          offers: [400, 200, 0, -3]
            .map((total, i) => ({
              id: String(i),
              live_mode: false,
              total_amount: String(total),
              total_currency: "USD",
              expires_at: "2099-12-01T00:00:00Z",
              owner: { name: "Test Air" },
              slices: [
                {
                  segments: [
                    {
                      origin: { iata_code: "JFK" },
                      destination: { iata_code: "LHR" },
                      departing_at: "2099-11-01T10:00",
                      operating_carrier: { name: "Actual Operator" },
                    },
                  ],
                },
              ],
            }))
            .concat([
              {
                total_amount: "1",
                total_currency: "USD",
                live_mode: false,
                expires_at: "2000-01-01",
              },
              {
                total_amount: "10",
                total_currency: "EUR",
                live_mode: false,
                expires_at: "2099-12-01",
              },
            ]),
        },
      });
    },
  });
  const r = await p.flights(q);
  assert.equal(r.status, "sandbox");
  assert.deepEqual(
    r.offers.map((o) => o.total),
    [200, 400],
  );
  assert.equal(payload.passengers.length, 2);
  assert.equal(payload.slices[0].departure_date, q.start);
  assert.match(r.offers[0].details[0], /Actual Operator/);
  assert.match(r.message, /EUR/);
  assert.ok(!JSON.stringify(r).includes("private"));
});
test("Booking hotel prices use full-stay total, requested currency and matching property details", async () => {
  const p = createProviders({
    env: bookingEnv,
    fetchImpl: async (url, options) => {
      const b = JSON.parse(options.body);
      assert.equal(options.headers["X-Affiliate-Id"], "12345");
      if (url.endsWith("/accommodations/search")) {
        assert.equal(b.checkin, q.start);
        assert.equal(b.checkout, q.end);
        assert.equal(b.booker.country, "us");
        assert.equal(b.guests.number_of_adults, 2);
        assert.equal(b.guests.number_of_rooms, 1);
        assert.equal(b.coordinates.latitude, q.lat);
        return reply({
          data: [
            {
              id: 42,
              currency: { booker: "USD" },
              price: {
                base: { booker_currency: 100 },
                total: { booker_currency: 350 },
              },
              url: "https://www.booking.com/hotel/fr/test.html",
              products: [
                {
                  room: "42-room",
                  policies: {
                    cancellation: { type: "non_refundable" },
                    meal_plan: { plan: "no_plan" },
                  },
                },
              ],
            },
          ],
        });
      }
      assert.deepEqual(b.accommodations, [42]);
      return reply({
        data: [
          {
            id: 42,
            name: { "en-us": "Test Hotel" },
            rooms: [{ id: "42-room", name: { "en-us": "Double room" } }],
            photos: [
              {
                main_photo: true,
                url: { standard: "https://q-xx.bstatic.com/test.jpg" },
              },
            ],
          },
        ],
      });
    },
  });
  const r = await p.stays(q);
  assert.equal(r.status, "live");
  assert.equal(r.offers[0].total, 350);
  assert.equal(r.offers[0].name, "Test Hotel");
  assert.match(r.offers[0].terms, /non refundable/);
  assert.match(r.offers[0].image, /bstatic/);
});
test("Booking cars preserve local times, driver/residence context, totals, supplier and safe links", async () => {
  const p = createProviders({
    env: { ...bookingEnv, BOOKING_ENV: "test" },
    fetchImpl: async (url, options) => {
      assert.match(url, /demandapi-sandbox/);
      const b = JSON.parse(options.body);
      if (url.endsWith("/cars/search")) {
        assert.equal(b.driver.age, 31);
        assert.equal(b.filters.number_of_seats, q.adults);
        assert.equal(b.route.pickup.datetime, "2099-11-01T09:30:00");
        assert.equal(b.route.dropoff.datetime, "2099-11-04T17:00:00");
        assert.deepEqual(b.route.pickup.location, { airport: "AMS" });
        return reply({
          data: [
            {
              car: 1,
              offer: 9,
              supplier: 5,
              categories: ["compact"],
              price: {
                total: 140,
                currency: "USD",
                extra_charges: [{ total_amount: 20 }],
              },
              policies: { deposit: { amount: 300, currency: "USD" } },
              url: { web: "https://cars.booking.com/offer/9" },
            },
            {
              car: 2,
              supplier: 5,
              price: { total: 100, currency: "EUR" },
              url: { web: "https://booking.com.evil.example/" },
            },
          ],
        });
      }
      return reply({ data: [{ id: 5, name: "Test Supplier" }] });
    },
  });
  const r = await p.cars({ ...q, airport: "AMS" });
  assert.equal(r.status, "sandbox");
  assert.equal(r.offers.length, 1);
  assert.equal(r.offers[0].total, 140);
  assert.equal(r.offers[0].details[0], "Test Supplier");
  assert.match(r.offers[0].terms, /300 USD/);
  for (const u of [
    "javascript:alert(1)",
    "http://booking.com",
    "https://booking.com.evil.example",
    "https://user:pass@booking.com",
  ])
    assert.equal(safeURL(u, ["booking.com"]), "");
});
test("provider failures are sanitized, concurrent searches coalesce, and failed details retain prices", async () => {
  let calls = 0;
  const p = createProviders({
    env: bookingEnv,
    fetchImpl: async () => {
      calls++;
      return {
        ok: false,
        status: 403,
        json: async () => ({ secret: "must-not-leak" }),
      };
    },
  });
  const [a, b] = await Promise.all([p.cars(q), p.cars(q)]);
  assert.equal(calls, 1);
  assert.equal(a.status, "access_required");
  assert.deepEqual(a, b);
  assert.ok(!JSON.stringify(a).includes("must-not-leak"));
  const p2 = createProviders({
    env: bookingEnv,
    fetchImpl: async (url) => {
      if (url.endsWith("/accommodations/details"))
        throw Error("internal details");
      return reply({
        data: [
          {
            id: 1,
            currency: { booker: "USD" },
            price: { total: { booker_currency: 200 } },
            url: "https://www.booking.com/hotel/test",
          },
        ],
      });
    },
  });
  const r = await p2.stays(q);
  assert.equal(r.offers[0].total, 200);
  assert.equal(r.offers[0].name, "Property 1");
});
