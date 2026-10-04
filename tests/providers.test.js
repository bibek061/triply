const test = require("node:test"),
  assert = require("node:assert/strict");
const { createProviders } = require("../lib/providers");
const query = {
  origin: "KTM",
  destination: "DEL",
  start: "2026-11-01",
  adults: 2,
  currency: "USD",
};
test("unconfigured adapter never fabricates fares", async () => {
  const p = createProviders({
    env: {},
    fetchImpl: () => {
      throw Error("Should not fetch");
    },
  });
  assert.equal((await p.flights(query)).status, "not_configured");
});
test("official Amadeus flow uses server credentials, requested currency, and sorts matching totals", async () => {
  const calls = [];
  const mock = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () =>
        url.includes("token")
          ? { access_token: "test-token", expires_in: 1800 }
          : {
              data: [120, 80].map((price, i) => ({
                id: String(i),
                price: { total: String(price), currency: "USD" },
                validatingAirlineCodes: ["ZZ"],
                itineraries: [
                  {
                    segments: [
                      {
                        departure: { iataCode: "KTM", at: "2026-11-01T10:00" },
                        arrival: { iataCode: "DEL", at: "2026-11-01T11:30" },
                        carrierCode: "ZZ",
                      },
                    ],
                  },
                ],
              })),
            },
    };
  };
  const p = createProviders({
    env: { AMADEUS_CLIENT_ID: "test-id", AMADEUS_CLIENT_SECRET: "test-secret" },
    fetchImpl: mock,
  });
  const result = await p.flights(query);
  assert.equal(result.status, "sandbox");
  assert.deepEqual(
    result.offers.map((o) => o.total),
    [80, 120],
  );
  assert.ok(calls[0].url.startsWith("https://test.api.amadeus.com/"));
  assert.equal(calls[1].options.headers.Authorization, "Bearer test-token");
  assert.equal(new URL(calls[1].url).searchParams.get("currencyCode"), "USD");
  assert.ok(!JSON.stringify(result).includes("test-secret"));
  await p.flights(query);
  assert.equal(calls.filter((c) => c.url.includes("token")).length, 1);
});
