"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { suggestions, destination } = require("../lib/destinations");
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
