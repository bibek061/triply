const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { createApp } = require("../lib/app-server");
test("pricing HTTP routes validate dates, destination, driver inputs and protect credentials", async (t) => {
  const base = path.resolve(__dirname, "../test-results");
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, "pricing-"));
  let providerCalls = 0;
  const app = createApp({
    dataDir: dir,
    env: {
      BOOKING_API_TOKEN: "secret-token",
      BOOKING_AFFILIATE_ID: "1234",
      DUFFEL_ACCESS_TOKEN: "duffel_test_secret",
    },
    fetchImpl: async () => {
      providerCalls++;
      return { ok: true, json: async () => ({ data: [] }) };
    },
  });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${app.address().port}`;
  t.after(async () => {
    await new Promise((r) => app.close(r));
    assert.equal(path.dirname(dir), base);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const config = await (await fetch(origin + "/api/config")).json();
  assert.equal(config.pricing.flightProvider, "Duffel");
  assert.equal(config.pricing.bookingConfigured, true);
  assert.ok(!JSON.stringify(config).includes("secret"));
  const choices = await (
    await fetch(origin + "/api/destinations?q=Paris")
  ).json();
  const city = choices.destinations.find(
    (d) => d.kind === "City" && d.country === "FR",
  );
  const query = {
    start: "2099-11-01",
    end: "2099-11-04",
    adults: 2,
    currency: "USD",
    residence: "US",
    location: "Paris",
    destinationId: city.id,
    driverAge: 30,
    pickupTime: "10:00",
    dropoffTime: "10:00",
  };
  for (const override of [
    { end: "2099-10-31" },
    { start: "2099-02-31" },
    { residence: "INVALID" },
    { driverAge: 17 },
    { pickupTime: "25:00" },
    { destinationId: "not-a-city" },
  ]) {
    const r = await fetch(
      origin + "/api/cars?" + new URLSearchParams({ ...query, ...override }),
    );
    assert.equal(r.status, 400);
  }
  assert.equal(providerCalls, 0);
  const stay = await (
    await fetch(origin + "/api/stays?" + new URLSearchParams(query))
  ).json();
  assert.equal(stay.status, "sandbox");
  const car = await (
    await fetch(origin + "/api/cars?" + new URLSearchParams(query))
  ).json();
  assert.equal(car.status, "sandbox");
  assert.equal(providerCalls, 2);
  const country = await (
    await fetch(
      origin +
        "/api/stays?" +
        new URLSearchParams({
          ...query,
          destinationId: "country-IN",
          location: "India",
        }),
    )
  ).json();
  assert.equal(country.status, "needs_city");
  assert.equal(providerCalls, 2);
  const same = await fetch(
    origin +
      "/api/flights?" +
      new URLSearchParams({
        origin: "JFK",
        destination: "JFK",
        start: query.start,
        adults: 1,
        currency: "USD",
      }),
  );
  assert.equal(same.status, 400);
});
