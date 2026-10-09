const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { hostingEnv } = require("../lib/hosting");
const { createApp } = require("../lib/app-server");

test("hosted startup requires storage and an exact HTTPS origin", () => {
  assert.deepEqual(hostingEnv({}), {});
  assert.throws(
    () => hostingEnv({ NODE_ENV: "production" }),
    /Production requires/,
  );
  assert.throws(
    () =>
      hostingEnv({
        NODE_ENV: "production",
        PUBLIC_ORIGIN: "https://triply.example",
      }),
    /DATA_DIR/,
  );
  for (const origin of [
    "http://triply.example",
    "https://triply.example/path",
    "https://user:pass@triply.example",
    "https://triply.example/?q=1",
  ])
    assert.throws(() => hostingEnv({ PUBLIC_ORIGIN: origin }));
  const env = hostingEnv({
    NODE_ENV: "production",
    RENDER: "true",
    RENDER_EXTERNAL_URL: "https://triply.onrender.com/",
    DATA_DIR: "/var/data/triply",
  });
  assert.equal(env.PUBLIC_ORIGIN, "https://triply.onrender.com");
  assert.equal(
    hostingEnv({ ...env, PUBLIC_ORIGIN: "https://travel.example/" })
      .PUBLIC_ORIGIN,
    "https://travel.example",
  );
  assert.equal(
    hostingEnv({ RENDER_EXTERNAL_URL: "https://ignored.example" })
      .PUBLIC_ORIGIN,
    undefined,
  );
});

test("hosted health, secure sessions, origin rejection and private-file isolation", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "triply-hosting-"));
  const publicOrigin = "https://triply.example";
  const server = createApp({
    dataDir: dir,
    env: {
      PUBLIC_ORIGIN: publicOrigin,
      GOOGLE_MAPS_EMBED_API_KEY: "synthetic-public-embed-key",
      DUFFEL_ACCESS_TOKEN: "synthetic-private-flight-token",
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const health = await fetch(base + "/healthz");
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });
  assert.equal(health.headers.get("cache-control"), "no-store");
  const head = await fetch(base + "/healthz", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const configResponse = await fetch(base + "/api/config");
  const configText = await configResponse.text();
  assert.equal(JSON.parse(configText).googleMapsEmbedKey, "synthetic-public-embed-key");
  assert.ok(!configText.includes("synthetic-private-flight-token"));
  assert.match(configResponse.headers.get("content-security-policy"), /frame-src https:\/\/www\.google\.com\/maps\/embed\//);
  const signup = (origin) =>
    fetch(base + "/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        handle: "launchqa",
        name: "Launch QA",
        password: "Synthetic-launch-QA-2026",
        country: "US",
        discover: false,
      }),
    });
  assert.equal((await signup("https://untrusted.example")).status, 403);
  const account = await signup(publicOrigin);
  assert.equal(account.status, 201);
  assert.match(account.headers.get("set-cookie"), /; Secure/);
  assert.match(account.headers.get("set-cookie"), /HttpOnly/);
  for (const route of [
    "/.env",
    "/render.yaml",
    "/private-data/triply.sqlite",
    "/lib/hosting.js",
  ])
    assert.equal((await fetch(base + route)).status, 404);
});
