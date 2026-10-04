"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  suggestions,
  destination,
  browseDestination,
} = require("../lib/destinations");

test("country and state browsing returns contained cities, while explicit cities stay local", () => {
  const india = browseDestination("India");
  assert.equal(india.scope, "area");
  assert.equal(india.country, "IN");
  assert.equal(india.center, null);
  assert.equal(india.destinations.length, 12);
  assert.ok(india.destinations.every((c) => c.country === "IN"));
  assert.ok(india.destinations.some((c) => c.name === "Mumbai"));
  const state = browseDestination("California");
  assert.ok(state.destinations.every((c) => c.label.includes("California")));
  const city = destination(india.destinations[0].id);
  assert.equal(browseDestination(city.name, "IN", city), null);
  assert.equal(browseDestination("Paris, France"), null);
  assert.equal(browseDestination("Atlantis"), null);
  assert.equal(
    browseDestination("India", "", destination("country-IN")).country,
    "IN",
  );
});
const filters = require("../travel-filters");
const { createPhotos } = require("../lib/photos");

test("suggestions distinguish same-name cities, regions, countries and accents", () => {
  const paris = suggestions("Paris");
  assert.equal(paris[0].country, "FR");
  const texas = paris.find((p) => p.label.includes("Texas"));
  assert.equal(texas.country, "US");
  assert.notEqual(destination(texas.id).lat, paris[0].lat);
  assert.equal(suggestions("California")[0].kind, "State / region");
  assert.equal(suggestions("Nepal")[0].kind, "Country");
  assert.equal(suggestions("Sao Paulo")[0].name, "São Paulo");
  assert.deepEqual(suggestions("p"), []);
  assert.equal(destination("city-invalid"), null);
});

test("filters exclude unknown fees and mixed currency fares and validate real dates", () => {
  assert.deepEqual(
    filters.places(
      [{ feeStatus: "free" }, { feeStatus: "unknown" }, { feeStatus: "paid" }],
      "free",
    ),
    [{ feeStatus: "free" }],
  );
  const offers = [
    { total: 100, currency: "USD" },
    { total: 101, currency: "USD" },
    { total: 50, currency: "EUR" },
    { total: NaN, currency: "USD" },
  ];
  assert.deepEqual(filters.offers(offers, "100", "USD"), [offers[0]]);
  assert.equal(filters.offers(offers, "", "USD").length, 2);
  assert.equal(filters.dates("2028-02-29", "2028-03-01"), true);
  assert.equal(filters.dates("2027-02-29", "2027-03-01"), false);
  assert.equal(filters.dates("2028-03-01", "2028-03-01"), false);
  assert.equal(filters.dates("bad", "2028-03-01"), false);
});

test("photos follow exact place references, retain attribution and cache results", async () => {
  let calls = 0;
  const photos = createPhotos({
    fetchImpl: async (url) => {
      calls++;
      return {
        ok: true,
        json: async () =>
          url.includes("wikidata.org")
            ? {
                entities: {
                  Q243: {
                    claims: {
                      P18: [
                        { mainsnak: { datavalue: { value: "Tower.jpg" } } },
                      ],
                    },
                  },
                },
              }
            : {
                query: {
                  pages: {
                    1: {
                      title: "File:Tower.jpg",
                      imageinfo: [
                        {
                          thumburl: "https://thumb.wikimedia.org/tower.jpg",
                          descriptionurl:
                            "https://commons.wikimedia.org/wiki/File:Tower.jpg",
                          extmetadata: {
                            Artist: { value: "<a>Photographer</a>" },
                            LicenseShortName: { value: "CC BY-SA 4.0" },
                          },
                        },
                      ],
                    },
                  },
                },
              },
      };
    },
  });
  const items = [
    { id: "osm-node-1", wikidata: "Q243" },
    { id: "osm-node-2", name: "Tower" },
  ];
  const result = await photos.enrich(items);
  assert.equal(result["osm-node-1"].kind, "place");
  assert.equal(result["osm-node-1"].credit, "Photographer");
  assert.equal(result["osm-node-2"], undefined);
  assert.deepEqual(await photos.enrich(items), result);
  assert.equal(calls, 2);
});

test("photo service rejects unrelated image hosts and fails gracefully", async () => {
  const unsafe = createPhotos({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        query: {
          pages: {
            1: {
              title: "File:Place.jpg",
              imageinfo: [
                {
                  thumburl: "https://evil.example/photo.jpg",
                  descriptionurl:
                    "https://commons.wikimedia.org/wiki/File:Place.jpg",
                  extmetadata: {
                    Artist: { value: "Person" },
                    LicenseShortName: { value: "CC0" },
                  },
                },
              ],
            },
          },
        },
      }),
    }),
  });
  assert.deepEqual(
    await unsafe.enrich([{ id: "osm-node-1", commons: "File:Place.jpg" }]),
    {},
  );
  const offline = createPhotos({
    fetchImpl: async () => {
      throw Error("offline");
    },
  });
  assert.deepEqual(
    await offline.enrich([{ id: "osm-node-1", wikidata: "Q243" }]),
    {},
  );
});

test("Wikipedia article references resolve redirects and request reusable Commons attribution", async () => {
  const calls = [];
  const service = createPhotos({
    fetchImpl: async (url) => {
      calls.push(url);
      const u = new URL(url);
      if (u.hostname === "fr.wikipedia.org")
        return {
          ok: true,
          json: async () => ({
            query: {
              redirects: [{ from: "Tour", to: "Tour Eiffel" }],
              pages: { 1: { title: "Tour Eiffel", pageimage: "Tower.jpg" } },
            },
          }),
        };
      assert.equal(u.hostname, "commons.wikimedia.org");
      assert.equal(u.searchParams.get("titles"), "File:Tower.jpg");
      return {
        ok: true,
        json: async () => ({
          query: {
            pages: {
              1: {
                title: "File:Tower.jpg",
                imageinfo: [
                  {
                    thumburl: "https://thumb.wikimedia.org/tower.jpg",
                    descriptionurl:
                      "https://commons.wikimedia.org/wiki/File:Tower.jpg",
                    mime: "image/jpeg",
                    extmetadata: {
                      Artist: { value: "Photographer" },
                      LicenseShortName: { value: "CC BY 4.0" },
                    },
                  },
                ],
              },
            },
          },
        }),
      };
    },
  });
  const result = await service.enrich([
    { id: "osm-node-1", wikipedia: "fr:Tour" },
  ]);
  assert.equal(result["osm-node-1"].kind, "place");
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes("pilicense=free"));
});

test("nearby photos require name and distance, keep unique pictures, and label approximate matches", async () => {
  const service = createPhotos({
    fetchImpl: async (url) => {
      const q = new URL(url).searchParams;
      if (q.get("list") === "geosearch")
        return {
          ok: true,
          json: async () => ({
            query: {
              geosearch: [
                { title: "File:Unrelated temple.jpg", dist: 1 },
                { title: "File:Alpha hill far.jpg", dist: 151 },
                { title: "File:Alpha hill.jpg", dist: 5 },
                { title: "File:Alpha hill other.jpg", dist: 15 },
              ],
            },
          }),
        };
      assert.ok(!q.get("titles").includes("temple"));
      assert.ok(!q.get("titles").includes("far"));
      return {
        ok: true,
        json: async () => ({
          query: {
            pages: Object.fromEntries(
              q
                .get("titles")
                .split("|")
                .map((title, i) => [
                  i,
                  {
                    title,
                    imageinfo: [
                      {
                        thumburl:
                          "https://thumb.wikimedia.org/" +
                          encodeURIComponent(title),
                        descriptionurl:
                          "https://commons.wikimedia.org/wiki/" +
                          encodeURIComponent(title),
                        mime: "image/jpeg",
                        extmetadata: {
                          Artist: { value: "Author" },
                          LicenseShortName: { value: "CC BY-SA 4.0" },
                        },
                      },
                    ],
                  },
                ]),
            ),
          },
        }),
      };
    },
  });
  const result = await service.enrich([
    { id: "osm-node-1", name: "Alpha hill", lat: 10, lon: 20 },
    { id: "osm-node-2", name: "Alpha hill", lat: 10, lon: 20 },
  ]);
  assert.equal(result["osm-node-1"].kind, "nearby");
  assert.ok(result["osm-node-1"].distanceMeters <= 150);
  assert.notEqual(result["osm-node-1"].url, result["osm-node-2"].url);
});

test("photo misses retry after expiry and concurrent callers share source requests", async () => {
  let clock = 0,
    calls = 0;
  const service = createPhotos({
    now: () => clock,
    fetchImpl: async () => {
      calls++;
      return { ok: true, json: async () => ({ query: { geosearch: [] } }) };
    },
  });
  const items = [{ id: "osm-node-1", name: "Alpha hill", lat: 10, lon: 20 }];
  await Promise.all([service.enrich(items), service.enrich(items)]);
  assert.equal(calls, 1);
  await service.enrich(items);
  assert.equal(calls, 1);
  clock = 600001;
  await service.enrich(items);
  assert.equal(calls, 2);
});
