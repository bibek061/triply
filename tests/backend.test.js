const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { createApp } = require("../lib/app-server");
test("accounts, private chat consent, posts, comments, saved places, and persistence", async (t) => {
  const base = path.resolve(__dirname, "../test-results");
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, "backend-"));
  let server = createApp({ dataDir: dir, env: {} });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (
    route,
    method = "GET",
    body,
    cookie = "",
    headers = {},
  ) => {
    const res = await fetch(origin + route, {
      method,
      headers: {
        Origin: origin,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: res.status,
      body: await res.json(),
      cookie: res.headers.get("set-cookie")?.split(";")[0],
    };
  };
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (path.dirname(path.resolve(dir)) !== base)
      throw Error("Unsafe test cleanup path");
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const config = await request("/api/config");
  assert.equal(config.status, 200);
  assert.equal(config.body.countries.length, 250);
  assert.ok(config.body.currencies.includes("ZWG"));
  assert.equal(config.body.pricing.configured, false);
  assert.ok(config.body.photos.camping.url.startsWith("https://"));
  const suggestions = await request("/api/destinations?q=Paris");
  assert.equal(suggestions.body.destinations[0].country, "FR");
  const india = await request("/api/places?location=India&category=all");
  assert.equal(india.status, 200);
  assert.equal(india.body.scope, "area");
  assert.equal(india.body.destinations.length, 12);
  assert.equal(india.body.center, null);
  assert.equal(
    (await request("/api/destination-photos?ids=country-IN")).status,
    400,
  );
  assert.equal(
    (await request("/api/destination-photos?ids=https://example.com")).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/api/destination-photos?ids=" +
          Array(13).fill(india.body.destinations[0].id).join(","),
      )
    ).status,
    400,
  );
  assert.equal(
    (await request("/api/places?location=Paris&destinationId=invalid")).status,
    400,
  );
  assert.equal(
    (await request("/api/photos?ids=https://evil.example")).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/api/flights?origin=JFK&destination=LHR&start=2099-02-31&adults=1&currency=USD",
      )
    ).status,
    400,
  );
  assert.equal(
    (await request("/api/places?country=INVALID&location=Paris")).status,
    400,
  );
  const signup = (handle, discover = true) =>
    request("/api/signup", "POST", {
      handle,
      name: handle,
      password: "Triply-test-password-2026",
      country: "NP",
      discover,
    });
  const alice = await signup("alice"),
    bob = await signup("bob"),
    eve = await signup("eve", false);
  assert.equal(alice.status, 201);
  assert.equal(bob.status, 201);
  assert.ok(alice.cookie);
  assert.ok(!JSON.stringify(alice.body).includes("password"));
  assert.equal(
    (
      await request(
        "/api/signup",
        "POST",
        {
          handle: "csrf",
          name: "CSRF",
          password: "Triply-test-password-2026",
          country: "NP",
        },
        {},
        { Origin: "https://untrusted.example" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/login", "POST", {
        handle: "alice",
        password: "wrong-password",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/api/login", "POST", {
        handle: "alice",
        password: "Triply-test-password-2026",
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/me", "GET", null, alice.cookie)).body.user.handle,
    "alice",
  );
  assert.equal(
    (await request("/api/posts", "POST", { caption: "not signed in" })).status,
    401,
  );
  const travelers = await request("/api/travelers", "GET", null, alice.cookie);
  assert.ok(travelers.body.travelers.some((u) => u.handle === "bob"));
  assert.ok(!travelers.body.travelers.some((u) => u.handle === "eve"));
  const chat = await request(
    "/api/conversations",
    "POST",
    { userId: bob.body.user.id, text: "Any hiking tips for Pokhara?" },
    alice.cookie,
  );
  assert.equal(chat.status, 201);
  const cid = chat.body.id;
  assert.equal(
    (await request(`/api/conversations/${cid}`, "GET", null, eve.cookie))
      .status,
    404,
  );
  assert.equal(
    (
      await request(
        `/api/conversations/${cid}/messages`,
        "POST",
        { text: "Before consent" },
        alice.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/api/conversations/${cid}/action`,
        "POST",
        { action: "accept" },
        alice.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/api/conversations/${cid}/action`,
        "POST",
        { action: "accept" },
        bob.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/api/conversations/${cid}/messages`,
        "POST",
        { text: "Let’s compare trail ideas." },
        alice.cookie,
      )
    ).status,
    201,
  );
  assert.equal(
    (await request(`/api/conversations/${cid}`, "GET", null, bob.cookie)).body
      .messages.length,
    2,
  );
  assert.equal(
    (
      await request(
        `/api/conversations/${cid}/messages`,
        "POST",
        { text: "   " },
        bob.cookie,
      )
    ).status,
    400,
  );
  await request(
    `/api/conversations/${cid}/action`,
    "POST",
    { action: "block" },
    bob.cookie,
  );
  assert.equal(
    (
      await request(
        `/api/conversations/${cid}/messages`,
        "POST",
        { text: "Blocked" },
        alice.cookie,
      )
    ).status,
    403,
  );
  const image =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  const post = await request(
    "/api/posts",
    "POST",
    {
      country: "NP",
      location: "Pokhara",
      category: "hiking",
      caption: "A great day on the trail.",
      image,
    },
    eve.cookie,
  );
  assert.equal(post.status, 201);
  assert.equal(
    (
      await request(
        `/api/posts/${post.body.id}/comments`,
        "POST",
        { text: "Where did you stay?" },
        alice.cookie,
      )
    ).status,
    201,
  );
  const comments = (await request(`/api/posts/${post.body.id}/comments`)).body
    .comments;
  assert.equal(
    (
      await request(
        `/api/posts/${post.body.id}/comments`,
        "POST",
        { text: "Near the lake.", parentId: comments[0].id },
        eve.cookie,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await request(
        `/api/posts/${post.body.id}/comments`,
        "POST",
        { text: "Invalid parent", parentId: "other-post" },
        eve.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/api/posts",
        "POST",
        {
          country: "NP",
          location: "Pokhara",
          category: "views",
          caption: "Not an image",
          image: "data:image/png;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
        },
        eve.cookie,
      )
    ).status,
    400,
  );
  const item = {
    id: "osm-node-123",
    name: "Viewpoint",
    location: "Pokhara",
    category: "views",
    country: "NP",
    url: "https://www.openstreetmap.org/node/123",
  };
  await request("/api/saved", "POST", { item }, alice.cookie);
  assert.equal(
    (await request("/api/saved", "GET", null, alice.cookie)).body.items.length,
    1,
  );
  assert.equal(
    (await request("/api/saved", "GET", null, eve.cookie)).body.items.length,
    0,
  );
  assert.equal(
    (
      await request(
        "/api/reports",
        "POST",
        { targetId: bob.body.user.id, reason: "Testing the report flow." },
        alice.cookie,
      )
    ).status,
    201,
  );
  const secret = await fetch(origin + "/private-data/triply.sqlite");
  assert.equal(secret.status, 404);
  await new Promise((resolve) => server.close(resolve));
  server = createApp({ dataDir: dir, env: {} });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  assert.equal(
    (await request("/api/me", "GET", null, alice.cookie)).body.user.handle,
    "alice",
  );
  assert.equal((await request("/api/posts")).body.posts.length, 1);
  assert.equal(
    (await request(`/api/posts/${post.body.id}/comments`)).body.comments.length,
    2,
  );
  await request("/api/logout", "POST", {}, alice.cookie);
  assert.equal(
    (await request("/api/me", "GET", null, alice.cookie)).body.user,
    null,
  );
});
