"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createApp } = require("../lib/app-server");

test("saved places retain verified photos, attribution and fees across restart", async (t) => {
  const base = path.resolve(__dirname, "../test-results");
  fs.mkdirSync(base, { recursive: true });
  const dataDir = fs.mkdtempSync(path.join(base, "saved-"));
  const fetchImpl = async (url) => ({
    ok: true,
    json: async () =>
      url.includes("nominatim")
        ? [
            {
              lat: "48.85",
              lon: "2.29",
              display_name: "Paris, France",
              address: { country_code: "fr" },
            },
          ]
        : url.includes("overpass")
          ? {
              elements: [
                {
                  type: "node",
                  id: 123,
                  lat: 48.85,
                  lon: 2.29,
                  tags: {
                    name: "Tower",
                    tourism: "viewpoint",
                    fee: "no",
                    wikimedia_commons: "File:Tower.jpg",
                  },
                },
              ],
            }
          : {
              query: {
                pages: {
                  1: {
                    title: "File:Tower.jpg",
                    imageinfo: [
                      {
                        thumburl: "https://upload.wikimedia.org/tower.jpg",
                        descriptionurl:
                          "https://commons.wikimedia.org/wiki/File:Tower.jpg",
                        extmetadata: {
                          Artist: { value: "Photographer" },
                          LicenseShortName: { value: "CC BY-SA 4.0" },
                        },
                      },
                    ],
                  },
                },
              },
            },
  });
  let server, origin;
  async function start() {
    server = createApp({ dataDir, env: {}, fetchImpl });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  }
  await start();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    assert.equal(path.dirname(dataDir), base);
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  let cookie;
  async function request(route, body) {
    const response = await fetch(origin + route, {
      method: body ? "POST" : "GET",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    assert.ok(response.ok, `${route}: ${response.status}`);
    cookie = response.headers.get("set-cookie")?.split(";")[0] || cookie;
    return response.json();
  }
  await request("/api/signup", {
    name: "QA Saver",
    handle: "qa_saver",
    password: "QA-password-2026!",
    country: "FR",
  });
  const { places } = await request("/api/places?location=Paris&category=views");
  const item = {
    ...places[0],
    location: "Paris",
    country: "FR",
    fee: "Forged fee",
    photo: { url: "https://evil.example/image.jpg" },
  };
  assert.equal((await request("/api/saved", { item })).saved, true);
  await new Promise((resolve) => server.close(resolve));
  await start();
  const { items } = await request("/api/saved");
  assert.equal(items.length, 1);
  assert.equal(items[0].feeStatus, "free");
  assert.equal(items[0].fee, "No fee listed");
  assert.equal(items[0].photo.url, "https://upload.wikimedia.org/tower.jpg");
  assert.equal(items[0].photo.credit, "Photographer");
  assert.equal(items[0].photo.license, "CC BY-SA 4.0");
  assert.equal((await request("/api/saved", { item })).saved, false);
  assert.deepEqual((await request("/api/saved")).items, []);
  await request("/api/saved", { item: { ...item, id: "unknown" } });
  assert.equal((await request("/api/saved")).items[0].photo, undefined);
});
