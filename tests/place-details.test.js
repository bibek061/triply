"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { placeFacts } = require("../lib/place-facts");
const filters = require("../travel-filters");
const { createApp } = require("../lib/app-server");

test("place facts preserve unknowns, reject unsafe links, and distinguish trail length from elevation", () => {
  const unknown = placeFacts({ natural: "peak", distance: "4" });
  assert.equal(unknown.toilets, "unknown");
  assert.equal(unknown.trailLengthKm, null);
  assert.equal(unknown.elevationMeters, null);
  assert.equal(placeFacts({ website: "javascript:alert(1)" }).website, "");
  assert.equal(
    placeFacts({ website: "https://user:secret@example.com/" }).website,
    "",
  );
  const trail = placeFacts({
    route: "hiking",
    distance: "2500 m",
    ele: "1800",
    sac_scale: "mountain_hiking",
    toilets: "yes",
    shower: "no",
    wheelchair: "limited",
  });
  assert.equal(trail.trailLengthKm, 2.5);
  assert.equal(trail.elevationMeters, 1800);
  assert.equal(trail.difficulty, "mountain_hiking");
  assert.equal(trail.showers, "no");
  assert.equal(
    placeFacts({ route: "hiking", distance: "3 MI" }).trailLengthKm,
    4.828032,
  );
  assert.equal(
    placeFacts({ route: "hiking", distance: "around five" }).trailLengthKm,
    null,
  );
  const places = [
    { id: "known", facts: trail, feeStatus: "free" },
    { id: "unknown", facts: unknown },
    { id: "missing" },
  ];
  assert.equal(filters.places(places, "any").length, 3);
  assert.deepEqual(
    filters
      .places(places, "free", {
        facilities: ["toilets"],
        maxLength: "5",
        difficulty: "mountain_hiking",
      })
      .map((p) => p.id),
    ["known"],
  );
  assert.equal(
    filters.places(places, "any", { facilities: ["wheelchair"] }).length,
    0,
  );
  assert.equal(filters.places(places, "any", { maxLength: "2" }).length, 0);
});

test("place pages and linked photos persist, use canonical places, and isolate stories and comments", async (t) => {
  const base = path.resolve(__dirname, "../test-results");
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, "place-details-"));
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++;
    if (url.includes("nominatim"))
      return {
        ok: true,
        json: async () => [
          {
            lat: "28.2",
            lon: "83.9",
            display_name: "Pokhara, Nepal",
            address: { country_code: "np" },
          },
        ],
      };
    if (url.includes("overpass"))
      return {
        ok: true,
        json: async () => ({
          elements: [
            {
              type: "node",
              id: 801,
              lat: 28.2,
              lon: 83.9,
              tags: {
                name: "Lake Camp",
                tourism: "camp_site",
                toilets: "yes",
                shower: "no",
                tents: "yes",
                fee: "no",
              },
            },
            {
              type: "node",
              id: 802,
              lat: 28.21,
              lon: 83.91,
              tags: { name: "Other Camp", tourism: "camp_site" },
            },
          ],
        }),
      };
    return {
      ok: true,
      json: async () => ({ query: { pages: [] }, entities: {} }),
    };
  };
  let server;
  let origin;
  const start = async () => {
    server = createApp({ dataDir: dir, env: {}, fetchImpl });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  };
  await start();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (path.dirname(path.resolve(dir)) !== base)
      throw Error("Unsafe test cleanup");
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const request = async (route, body, cookie) => {
    const response = await fetch(origin + route, {
      method: body ? "POST" : "GET",
      headers: {
        Origin: origin,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  };
  assert.equal((await request("/api/place/bad-id")).status, 400);
  assert.equal((await request("/api/place/osm-node-999")).status, 404);
  const search = await request("/api/places?location=Pokhara&category=camping");
  assert.equal(search.body.places[0].facts.toilets, "yes");
  const pid = "osm-node-801";
  const user = await request("/api/signup", {
    name: "Place Tester",
    handle: "place_tester",
    country: "NP",
    password: "Synthetic-test-only-42",
  });
  const image =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  const body = {
    placeId: pid,
    image,
    country: "US",
    location: "Forged location",
    category: "food",
    caption: "A useful campsite tip.",
  };
  assert.equal((await request("/api/posts", body)).status, 401);
  assert.equal(
    (
      await request(
        "/api/posts",
        { ...body, placeId: "osm-node-999" },
        user.cookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(
        "/api/posts",
        { ...body, placeId: { id: pid } },
        user.cookie,
      )
    ).status,
    400,
  );
  const posted = await request("/api/posts", body, user.cookie);
  assert.equal(posted.status, 201);
  const linked = (await request(`/api/posts?placeId=${pid}`)).body.posts;
  assert.equal(linked.length, 1);
  assert.equal(linked[0].location, "Lake Camp");
  assert.equal(linked[0].country, "NP");
  assert.equal(linked[0].category, "camping");
  assert.equal(
    (await request("/api/posts?placeId=osm-node-802")).body.posts.length,
    0,
  );
  assert.equal(
    (
      await request(
        `/api/posts/${posted.body.id}/comments`,
        { text: "Are there showers?" },
        user.cookie,
      )
    ).status,
    201,
  );
  assert.equal(
    (await request(`/api/posts?placeId=${pid}`)).body.posts[0].commentCount,
    1,
  );
  assert.equal(
    (await request(`/api/place/${pid}`)).body.place.travelerPhoto.postId,
    posted.body.id,
  );
  const secondSearch = await request(
    "/api/places?location=Pokhara&category=camping",
  );
  assert.equal(
    secondSearch.body.places[0].travelerPhoto.credit,
    "Place Tester",
  );
  const unlinked = await request(
    "/api/posts",
    {
      image,
      country: "NP",
      location: "Somewhere else",
      category: "hiking",
      caption: "Unlinked older-style post",
    },
    user.cookie,
  );
  assert.equal(unlinked.status, 201);
  await new Promise((resolve) => server.close(resolve));
  const callsBefore = calls;
  await start();
  const persisted = (await request(`/api/place/${pid}`)).body.place;
  assert.equal(persisted.facts.showers, "no");
  assert.equal(persisted.travelerPhoto.postId, posted.body.id);
  assert.equal(
    calls,
    callsBefore,
    "Opening saved details does not depend on an external map service",
  );
  assert.equal(
    (await request(`/api/posts?placeId=${pid}`)).body.posts.length,
    1,
  );
  assert.equal((await request("/api/posts")).body.posts.length, 2);
});
