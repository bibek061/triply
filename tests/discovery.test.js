"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createDiscovery } = require("../lib/discovery");

function dataDir(t) {
  const base = path.resolve(__dirname, "../test-results");
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, "discovery-"));
  t.after(() => {
    if (!dir.startsWith(base + path.sep)) throw Error("Unsafe cleanup");
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}
const reply = (value) => ({ ok: true, json: async () => value });

test("selected city coordinates bypass ambiguous geocoding and reach map/photo results", async (t) => {
  const service = createDiscovery({
    dataDir: dataDir(t),
    env: {},
    fetchImpl: async (url) => {
      assert.ok(!url.includes("nominatim"));
      assert.match(new URL(url).searchParams.get("data"), /33\./);
      return reply({
        elements: [
          {
            type: "node",
            id: 7,
            lat: 33.66,
            lon: -95.55,
            tags: { name: "Texas viewpoint", tourism: "viewpoint", fee: "no" },
          },
        ],
      });
    },
  });
  const result = await service.places({
    location: "Paris",
    category: "views",
    destination: {
      id: "test-texas",
      label: "Paris, Texas, United States",
      country: "US",
      lat: 33.66,
      lon: -95.55,
    },
  });
  assert.equal(result.country, "US");
  assert.equal(result.places[0].lat, 33.66);
  assert.equal(result.places[0].feeStatus, "free");
  assert.deepEqual(await service.photos(["osm-node-unknown"]), {});
});

test("place search coalesces requests, reuses geocodes, and preserves source links", async (t) => {
  const calls = [];
  const discovery = createDiscovery({
    dataDir: dataDir(t),
    env: {},
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.includes("nominatim"))
        return reply([
          { lat: "28.2", lon: "83.9", display_name: "Pokhara, Nepal" },
        ]);
      assert.match(options.headers["User-Agent"], /Triply/);
      assert.match(new URL(url).searchParams.get("data"), /out center 100/);
      return reply({
        elements: [
          {
            type: "node",
            id: 12,
            lat: 28.2,
            lon: 83.9,
            tags: { name: "Lake viewpoint", tourism: "viewpoint", fee: "no" },
          },
          {
            type: "node",
            id: 13,
            lat: 29,
            lon: 84,
            tags: { name: "Outside radius" },
          },
        ],
      });
    },
  });
  const query = { country: "NP", location: "Pokhara", category: "views" };
  const [a, b] = await Promise.all([
    discovery.places(query),
    discovery.places(query),
  ]);
  assert.deepEqual(a, b);
  assert.equal(calls.length, 2);
  assert.equal(a.places[0].url, "https://www.openstreetmap.org/node/12");
  assert.equal(a.places[0].category, "views");
  assert.equal(a.places.length, 1);
  await discovery.places({ ...query, category: "camping" });
  assert.equal(calls.length, 3); // Category changes do not geocode again.
  await discovery.places(query);
  assert.equal(calls.length, 3);
});

test("place search distinguishes no location and rejects partial Overpass results", async (t) => {
  const dir = dataDir(t);
  const missing = createDiscovery({
    dataDir: dir,
    fetchImpl: async () => reply([]),
  });
  assert.equal(
    (
      await missing.places({
        country: "NP",
        location: "Unknown",
        category: "all",
      })
    ).center,
    null,
  );
  const partial = createDiscovery({
    dataDir: dir,
    fetchImpl: async (url) =>
      reply(
        url.includes("nominatim")
          ? [{ lat: "28", lon: "84" }]
          : { elements: [], remark: "runtime error: timeout" },
      ),
  });
  await assert.rejects(
    partial.places({ country: "NP", location: "Pokhara", category: "all" }),
    /did not complete/,
  );
});

test("currency conversion caches rates on disk without exposing the raw feed", async (t) => {
  const dir = dataDir(t);
  let requests = 0;
  const fetchImpl = async () => {
    requests++;
    return reply({
      result: "success",
      rates: { USD: 1, NPR: 150, EUR: 0.9 },
      time_last_update_utc: "test date",
    });
  };
  const service = createDiscovery({ dataDir: dir, fetchImpl });
  const result = await service.convert(10, "EUR", "NPR");
  assert.ok(Math.abs(result.converted - 1666.6666667) < 0.01);
  assert.equal(result.rates, undefined);
  const restarted = createDiscovery({ dataDir: dir, fetchImpl });
  assert.equal((await restarted.convert(100, "USD", "NPR")).converted, 15000);
  assert.equal(requests, 1);
  assert.match(
    (await restarted.convert(10, "USD", "XXX")).error,
    /not covered/,
  );
});

test("currency fallback is labeled stale and expires after seven days", async (t) => {
  const dir = dataDir(t),
    file = path.join(dir, "exchange-cache.json");
  const value = {
    rates: { USD: 1, NPR: 150 },
    fetchedAt: Date.now() - 2 * 86400000,
  };
  fs.writeFileSync(file, JSON.stringify(value));
  const service = createDiscovery({
    dataDir: dir,
    fetchImpl: async () => {
      throw Error("offline");
    },
  });
  const result = await service.convert(1, "USD", "NPR");
  assert.equal(result.converted, 150);
  assert.equal(result.stale, true);
  fs.writeFileSync(
    file,
    JSON.stringify({ ...value, fetchedAt: Date.now() - 8 * 86400000 }),
  );
  await assert.rejects(service.convert(1, "USD", "NPR"), /offline/);
});

test("one destination accepts countries, states, and cities without a hidden country filter", async (t) => {
  for (const [location, country] of [
    ["Japan", "jp"],
    ["California", "us"],
    ["Paris, France", "fr"],
  ]) {
    const service = createDiscovery({
      dataDir: dataDir(t),
      env: {},
      fetchImpl: async (url) => {
        const query = new URL(url).searchParams;
        if (url.includes("nominatim")) {
          assert.equal(query.get("q"), location);
          assert.equal(query.has("countrycodes"), false);
          assert.equal(query.get("addressdetails"), "1");
          return reply([
            {
              lat: "35",
              lon: "139",
              display_name: location,
              address: { country_code: country },
            },
          ]);
        }
        return reply({ elements: [] });
      },
    });
    const result = await service.places({ location, category: "all" });
    assert.equal(result.country, country.toUpperCase());
    assert.equal(result.center.name, location);
  }
});
