"use strict";
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const scrypt = require("node:util").promisify(crypto.scrypt);
const { DatabaseSync } = require("node:sqlite");
const { createProviders } = require("./providers"),
  { createDiscovery } = require("./discovery");
const catalog = require("../data/countries.json"),
  root = path.join(__dirname, "..");
const countryCodes = new Set(catalog.countries.map((c) => c.code)),
  currencyCodes = new Set([
    "USD",
    ...catalog.countries.flatMap((c) => c.currencies.map((x) => x.code)),
  ]);
function createApp(options = {}) {
  const env = options.env || process.env,
    dataDir =
      options.dataDir || env.DATA_DIR || path.join(root, "private-data");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, "triply.sqlite"));
  db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,handle TEXT UNIQUE,name TEXT,password TEXT,country TEXT,discover INTEGER,created TEXT);
  CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER);
  CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),country TEXT,location TEXT,category TEXT,caption TEXT,image TEXT,created TEXT);
  CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY,post_id TEXT REFERENCES posts(id),user_id TEXT REFERENCES users(id),parent_id TEXT REFERENCES comments(id),body TEXT,created TEXT);
  CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,sender TEXT REFERENCES users(id),receiver TEXT REFERENCES users(id),status TEXT,created TEXT);
  CREATE UNIQUE INDEX IF NOT EXISTS conversation_pair ON conversations(min(sender,receiver),max(sender,receiver));
  CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,conversation_id TEXT REFERENCES conversations(id),user_id TEXT REFERENCES users(id),body TEXT,created TEXT);
  CREATE TABLE IF NOT EXISTS blocks(user_id TEXT REFERENCES users(id),blocked_id TEXT REFERENCES users(id),PRIMARY KEY(user_id,blocked_id));
  CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),target_id TEXT,reason TEXT,created TEXT);
  CREATE TABLE IF NOT EXISTS saves(user_id TEXT REFERENCES users(id),item_id TEXT,body TEXT,PRIMARY KEY(user_id,item_id));
  CREATE INDEX IF NOT EXISTS posts_time ON posts(created);CREATE INDEX IF NOT EXISTS comment_post ON comments(post_id,created);CREATE INDEX IF NOT EXISTS message_chat ON messages(conversation_id,created);`);
  const run = (s, ...a) => db.prepare(s).run(...a),
    one = (s, ...a) => db.prepare(s).get(...a),
    all = (s, ...a) => db.prepare(s).all(...a);
  const now = () => new Date().toISOString(),
    id = () => crypto.randomUUID(),
    hash = (v) => crypto.createHash("sha256").update(v).digest("hex");
  const providers = createProviders({ env, fetchImpl: options.fetchImpl }),
    discovery = createDiscovery({ dataDir, env, fetchImpl: options.fetchImpl });
  const limits = new Map();
  let cleanup = 0;
  function fail(status, message) {
    throw Object.assign(new Error(message), { status });
  }
  function limited(key, max, period) {
    const time = Date.now();
    if (time - cleanup > 60000) {
      for (const [k, v] of limits) if (v.until < time) limits.delete(k);
      run("DELETE FROM sessions WHERE expires<?", time);
      cleanup = time;
    }
    let v = limits.get(key);
    if (!v || v.until < time) {
      v = { n: 0, until: time + period };
      limits.set(key, v);
    }
    if (++v.n > max) fail(429, "Too many requests. Please try again later.");
  }
  function text(v, min, max, label) {
    if (typeof v !== "string" || v.trim().length < min || v.trim().length > max)
      fail(400, `${label} must be ${min}–${max} characters.`);
    return v.trim();
  }
  function country(v) {
    if (!countryCodes.has(v)) fail(400, "Select a valid country.");
    return v;
  }
  function currency(v) {
    if (!currencyCodes.has(v)) fail(400, "Select a valid currency.");
    return v;
  }
  const publicUser = (u) =>
    u
      ? {
          id: u.id,
          handle: u.handle,
          name: u.name,
          country: u.country,
          discover: Boolean(u.discover),
        }
      : null;
  const cookie = (req) =>
    (req.headers.cookie || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("triply_session="))
      ?.slice(15);
  function user(req) {
    const raw = cookie(req);
    return raw
      ? one(
          "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?",
          hash(raw),
          Date.now(),
        )
      : null;
  }
  function requireUser(req) {
    const u = user(req);
    if (!u) fail(401, "Sign in to continue.");
    return u;
  }
  function session(res, u) {
    const token = crypto.randomBytes(32).toString("hex");
    run(
      "INSERT INTO sessions VALUES(?,?,?)",
      hash(token),
      u.id,
      Date.now() + 604800000,
    );
    res.setHeader(
      "Set-Cookie",
      `triply_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${env.PUBLIC_ORIGIN?.startsWith("https:") ? "; Secure" : ""}`,
    );
  }
  const blocked = (a, b) =>
    Boolean(
      one(
        "SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?)",
        a,
        b,
        b,
        a,
      ),
    );
  function conversation(cid, u) {
    const c = one(
      "SELECT * FROM conversations WHERE id=? AND (sender=? OR receiver=?)",
      cid,
      u.id,
      u.id,
    );
    if (!c) fail(404, "Conversation not found.");
    return c;
  }
  async function body(req) {
    if (!req.headers["content-type"]?.startsWith("application/json"))
      fail(415, "Use application/json.");
    let n = 0;
    const chunks = [];
    for await (const chunk of req) {
      n += chunk.length;
      if (n > 4300000) fail(413, "Upload too large. Keep photos below 3 MB.");
      chunks.push(chunk);
    }
    try {
      const result = JSON.parse(Buffer.concat(chunks).toString() || "{}");
      if (!result || typeof result !== "object" || Array.isArray(result))
        fail(400, "JSON body must be an object.");
      return result;
    } catch {
      fail(400, "Invalid JSON.");
    }
  }
  function send(res, status, data) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://images.unsplash.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    );
    try {
      const url = new URL(req.url, "http://localhost"),
        route = url.pathname,
        method = req.method,
        ip = req.socket.remoteAddress;
      if (route.startsWith("/api/")) {
        limited(`all:${ip}`, 300, 60000);
        if (!["GET", "HEAD"].includes(method)) {
          const host = req.headers.host || "",
            expected = env.PUBLIC_ORIGIN || `http://${host}`;
          if (
            !env.PUBLIC_ORIGIN &&
            !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
          )
            fail(403, "Configure PUBLIC_ORIGIN for deployment.");
          if (req.headers.origin !== expected)
            fail(403, "Request origin not allowed.");
        }
        if (route === "/api/config" && method === "GET")
          return send(res, 200, {
            countries: catalog.countries,
            catalogUpdatedAt: catalog.retrievedAt,
            currencies: [...currencyCodes].sort(),
            pricing: {
              configured: providers.configured,
              environment: providers.production ? "production" : "test",
            },
          });
        if (route === "/api/me" && method === "GET")
          return send(res, 200, { user: publicUser(user(req)) });
        if (route === "/api/signup" && method === "POST") {
          limited(`signup:${ip}`, 10, 3600000);
          const b = await body(req),
            handle = text(b.handle, 3, 24, "Username").toLowerCase();
          if (!/^[a-z0-9_]+$/.test(handle))
            fail(400, "Use letters, numbers, and underscores.");
          const name = text(b.name, 2, 50, "Name"),
            password = text(b.password, 10, 128, "Password");
          country(b.country);
          if (one("SELECT 1 FROM users WHERE handle=?", handle))
            fail(409, "Username is already taken.");
          const salt = crypto.randomBytes(16).toString("hex"),
            derived = await scrypt(password, salt, 64),
            uid = id();
          try {
            run(
              "INSERT INTO users VALUES(?,?,?,?,?,?,?)",
              uid,
              handle,
              name,
              `${salt}:${derived.toString("hex")}`,
              b.country,
              b.discover === true ? 1 : 0,
              now(),
            );
          } catch {
            fail(409, "Username is already taken.");
          }
          const u = one("SELECT * FROM users WHERE id=?", uid);
          session(res, u);
          return send(res, 201, { user: publicUser(u) });
        }
        if (route === "/api/login" && method === "POST") {
          limited(`login:${ip}`, 20, 900000);
          const b = await body(req),
            u = one(
              "SELECT * FROM users WHERE handle=?",
              text(b.handle, 3, 24, "Username").toLowerCase(),
            ),
            password = text(b.password, 1, 128, "Password");
          const [salt, expected] = (
            u?.password || `${"0".repeat(32)}:${"0".repeat(128)}`
          ).split(":");
          const actual = await scrypt(password, salt, 64);
          if (
            !u ||
            !crypto.timingSafeEqual(actual, Buffer.from(expected, "hex"))
          )
            fail(401, "Username or password is incorrect.");
          session(res, u);
          return send(res, 200, { user: publicUser(u) });
        }
        if (route === "/api/logout" && method === "POST") {
          if (cookie(req))
            run("DELETE FROM sessions WHERE token=?", hash(cookie(req)));
          res.setHeader(
            "Set-Cookie",
            "triply_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
          );
          return send(res, 200, { ok: true });
        }
        if (route === "/api/profile" && method === "PATCH") {
          const u = requireUser(req),
            b = await body(req);
          run(
            "UPDATE users SET name=?,country=?,discover=? WHERE id=?",
            text(b.name, 2, 50, "Name"),
            country(b.country),
            b.discover === true ? 1 : 0,
            u.id,
          );
          return send(res, 200, {
            user: publicUser(one("SELECT * FROM users WHERE id=?", u.id)),
          });
        }
        if (route === "/api/places" && method === "GET") {
          limited(`places:${ip}`, 20, 60000);
          const q = {
            country: country(url.searchParams.get("country")),
            location: text(
              url.searchParams.get("location"),
              2,
              100,
              "Location",
            ),
            category: url.searchParams.get("category") || "all",
          };
          if (
            ![
              "all",
              "camping",
              "hiking",
              "views",
              "beaches",
              "attractions",
            ].includes(q.category)
          )
            fail(400, "Invalid place category.");
          return send(res, 200, await discovery.places(q));
        }
        if (route === "/api/convert" && method === "GET") {
          limited(`fx:${ip}`, 30, 60000);
          const amount = Number(url.searchParams.get("amount"));
          if (!Number.isFinite(amount) || amount < 0 || amount > 1e12)
            fail(400, "Enter a valid amount.");
          return send(
            res,
            200,
            await discovery.convert(
              amount,
              currency(url.searchParams.get("from")),
              currency(url.searchParams.get("to")),
            ),
          );
        }
        if (route === "/api/flights" && method === "GET") {
          limited(`flights:${ip}`, 10, 60000);
          const q = Object.fromEntries(url.searchParams),
            start = text(q.start, 10, 10, "Departure date"),
            adults = Number(q.adults);
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
            Number.isNaN(Date.parse(start)) ||
            new Date(start).toISOString().slice(0, 10) !== start ||
            start < new Date().toISOString().slice(0, 10)
          )
            fail(400, "Choose a future departure date.");
          if (!Number.isInteger(adults) || adults < 1 || adults > 9)
            fail(400, "Choose 1–9 travelers.");
          return send(
            res,
            200,
            await providers.flights({
              origin: text(q.origin, 2, 80, "Origin").toUpperCase(),
              destination: text(
                q.destination,
                2,
                80,
                "Destination",
              ).toUpperCase(),
              start,
              adults,
              currency: currency(q.currency),
            }),
          );
        }
        if (route === "/api/posts" && method === "GET") {
          const selected = url.searchParams.get("country");
          return send(res, 200, {
            posts: all(
              `SELECT p.*,u.name,u.handle,(SELECT count(*) FROM comments c WHERE c.post_id=p.id) AS commentCount FROM posts p JOIN users u ON u.id=p.user_id ${selected ? "WHERE p.country=?" : ""} ORDER BY p.created DESC LIMIT 100`,
              ...(selected ? [country(selected)] : []),
            ),
          });
        }
        if (route === "/api/posts" && method === "POST") {
          const u = requireUser(req);
          limited(`posts:${u.id}`, 10, 3600000);
          const b = await body(req);
          country(b.country);
          if (
            ![
              "camping",
              "hiking",
              "views",
              "beaches",
              "attractions",
              "stays",
              "food",
            ].includes(b.category)
          )
            fail(400, "Select a valid category.");
          const caption = text(b.caption, 2, 1500, "Caption"),
            location = text(b.location, 2, 100, "Location");
          const match =
            typeof b.image === "string" &&
            b.image.match(
              /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/,
            );
          if (!match) fail(400, "Upload a JPG, PNG, or WebP photo.");
          const bytes = Buffer.from(match[2], "base64");
          if (bytes.length > 3145728 || bytes.length < 12)
            fail(400, "Photo must be below 3 MB.");
          const valid =
            match[1] === "jpeg"
              ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
              : match[1] === "png"
                ? bytes
                    .subarray(0, 8)
                    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
                : bytes.toString("ascii", 0, 4) === "RIFF" &&
                  bytes.toString("ascii", 8, 12) === "WEBP";
          if (!valid) fail(400, "Invalid image contents.");
          if (
            one("SELECT count(*) AS n FROM posts WHERE user_id=?", u.id).n >=
            200
          )
            fail(429, "Account photo limit reached.");
          const pid = id(),
            file = `${pid}.${match[1]}`;
          fs.writeFileSync(path.join(dataDir, file), bytes);
          run(
            "INSERT INTO posts VALUES(?,?,?,?,?,?,?,?)",
            pid,
            u.id,
            b.country,
            location,
            b.category,
            caption,
            `/media/${file}`,
            now(),
          );
          return send(res, 201, { id: pid });
        }
        const comments = route.match(/^\/api\/posts\/([^/]+)\/comments$/);
        if (comments) {
          const pid = comments[1],
            post = one("SELECT * FROM posts WHERE id=?", pid);
          if (!post) fail(404, "Post not found.");
          if (method === "GET")
            return send(res, 200, {
              comments: all(
                "SELECT c.id,c.user_id,c.parent_id,c.body,c.created,u.name,u.handle FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.created",
                pid,
              ),
            });
          if (method === "POST") {
            const u = requireUser(req);
            limited(`comments:${u.id}`, 30, 60000);
            if (blocked(u.id, post.user_id))
              fail(403, "Comments are unavailable for this post.");
            const b = await body(req);
            if (
              b.parentId &&
              !one(
                "SELECT 1 FROM comments WHERE id=? AND post_id=?",
                b.parentId,
                pid,
              )
            )
              fail(400, "Reply must belong to this post.");
            run(
              "INSERT INTO comments VALUES(?,?,?,?,?,?)",
              id(),
              pid,
              u.id,
              b.parentId || null,
              text(b.text, 1, 500, "Comment"),
              now(),
            );
            return send(res, 201, { ok: true });
          }
        }
        if (route === "/api/travelers" && method === "GET") {
          const u = requireUser(req),
            q = (url.searchParams.get("q") || "").trim().slice(0, 50);
          return send(res, 200, {
            travelers: all(
              "SELECT id,handle,name,country FROM users WHERE discover=1 AND id!=? AND (name LIKE ? OR handle LIKE ?) AND id NOT IN (SELECT blocked_id FROM blocks WHERE user_id=? UNION SELECT user_id FROM blocks WHERE blocked_id=?) LIMIT 30",
              u.id,
              `%${q}%`,
              `%${q}%`,
              u.id,
              u.id,
            ),
          });
        }
        if (route === "/api/conversations" && method === "GET") {
          const u = requireUser(req);
          return send(res, 200, {
            conversations: all(
              "SELECT c.*,u.name,u.handle,u.country FROM conversations c JOIN users u ON u.id=CASE WHEN c.sender=? THEN c.receiver ELSE c.sender END WHERE c.sender=? OR c.receiver=? ORDER BY c.created DESC",
              u.id,
              u.id,
              u.id,
            ).map((c) => ({
              ...c,
              otherId: c.sender === u.id ? c.receiver : c.sender,
              incoming: c.receiver === u.id,
              blocked: blocked(c.sender, c.receiver),
            })),
          });
        }
        if (route === "/api/conversations" && method === "POST") {
          const u = requireUser(req);
          limited(`chatRequests:${u.id}`, 10, 3600000);
          const b = await body(req),
            other = one(
              "SELECT * FROM users WHERE id=? AND discover=1",
              String(b.userId),
            );
          if (!other || other.id === u.id || blocked(u.id, other.id))
            fail(404, "Traveler is not available for messages.");
          const existing = one(
            "SELECT * FROM conversations WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?)",
            u.id,
            other.id,
            other.id,
            u.id,
          );
          if (existing)
            return send(res, 200, { id: existing.id, status: existing.status });
          const message = text(b.text, 1, 1000, "Message"),
            cid = id();
          run(
            "INSERT INTO conversations VALUES(?,?,?,?,?)",
            cid,
            u.id,
            other.id,
            "pending",
            now(),
          );
          run(
            "INSERT INTO messages VALUES(?,?,?,?,?)",
            id(),
            cid,
            u.id,
            message,
            now(),
          );
          return send(res, 201, { id: cid, status: "pending" });
        }
        const chat = route.match(
          /^\/api\/conversations\/([^/]+)(?:\/(messages|action))?$/,
        );
        if (chat) {
          const u = requireUser(req),
            c = conversation(chat[1], u),
            other = c.sender === u.id ? c.receiver : c.sender;
          if (method === "GET")
            return send(res, 200, {
              conversation: {
                id: c.id,
                status: c.status,
                incoming: c.receiver === u.id,
                blocked: blocked(u.id, other),
                other: publicUser(one("SELECT * FROM users WHERE id=?", other)),
              },
              messages: all(
                "SELECT id,user_id,body,created FROM (SELECT rowid AS sequence,id,user_id,body,created FROM messages WHERE conversation_id=? ORDER BY created DESC,rowid DESC LIMIT 500) ORDER BY created,sequence",
                c.id,
              ),
            });
          if (method === "POST" && chat[2] === "action") {
            const b = await body(req);
            if (b.action === "block") {
              run("INSERT OR IGNORE INTO blocks VALUES(?,?)", u.id, other);
              return send(res, 200, { ok: true });
            }
            if (
              c.receiver !== u.id ||
              c.status !== "pending" ||
              !["accept", "decline"].includes(b.action)
            )
              fail(403, "Request cannot be changed.");
            run(
              "UPDATE conversations SET status=? WHERE id=?",
              b.action === "accept" ? "accepted" : "declined",
              c.id,
            );
            return send(res, 200, { ok: true });
          }
          if (method === "POST" && chat[2] === "messages") {
            if (c.status !== "accepted" || blocked(u.id, other))
              fail(403, "Request must be accepted before chatting.");
            limited(`messages:${u.id}`, 60, 60000);
            const b = await body(req);
            run(
              "INSERT INTO messages VALUES(?,?,?,?,?)",
              id(),
              c.id,
              u.id,
              text(b.text, 1, 1000, "Message"),
              now(),
            );
            return send(res, 201, { ok: true });
          }
        }
        if (route === "/api/reports" && method === "POST") {
          const u = requireUser(req);
          limited(`reports:${u.id}`, 10, 3600000);
          const b = await body(req);
          run(
            "INSERT INTO reports VALUES(?,?,?,?,?)",
            id(),
            u.id,
            text(b.targetId, 1, 100, "Target"),
            text(b.reason, 3, 1000, "Reason"),
            now(),
          );
          return send(res, 201, { ok: true });
        }
        if (route === "/api/saved" && method === "GET") {
          const u = requireUser(req);
          return send(res, 200, {
            items: all("SELECT body FROM saves WHERE user_id=?", u.id).map(
              (x) => JSON.parse(x.body),
            ),
          });
        }
        if (route === "/api/saved" && method === "POST") {
          const u = requireUser(req),
            b = await body(req),
            item = b.item || {},
            key = text(item.id, 1, 100, "Item");
          const clean = {
            id: key,
            name: text(item.name, 1, 150, "Name"),
            location: text(item.location || "Unknown", 1, 150, "Location"),
            category: text(item.category || "place", 1, 30, "Category"),
            url:
              typeof item.url === "string" &&
              /^https:\/\/(www\.)?(openstreetmap\.org|google\.com)\//.test(
                item.url,
              )
                ? item.url
                : "",
            country: country(item.country),
          };
          const exists = one(
            "SELECT 1 FROM saves WHERE user_id=? AND item_id=?",
            u.id,
            key,
          );
          if (exists)
            run("DELETE FROM saves WHERE user_id=? AND item_id=?", u.id, key);
          else
            run(
              "INSERT INTO saves VALUES(?,?,?)",
              u.id,
              key,
              JSON.stringify(clean),
            );
          return send(res, 200, { saved: !exists });
        }
        fail(404, "API route not found.");
      }
      if (!["GET", "HEAD"].includes(method)) fail(405, "Method not allowed.");
      const files = {
        "/": "index.html",
        "/index.html": "index.html",
        "/global-app.js": "global-app.js",
        "/styles.css": "styles.css",
        "/global.css": "global.css",
        "/data/countries.json": "data/countries.json",
        "/licenses/countries-ODbL.txt": "licenses/countries-ODbL.txt",
        "/licenses/unicode.txt": "licenses/unicode.txt",
      };
      let file = files[route] && path.join(root, files[route]);
      if (/^\/media\/[a-f0-9-]{36}\.(jpeg|png|webp)$/.test(route))
        file = path.join(dataDir, path.basename(route));
      if (!file || !fs.existsSync(file)) fail(404, "Not found.");
      const types = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".json": "application/json; charset=utf-8",
        ".txt": "text/plain; charset=utf-8",
      };
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)],
        "Cache-Control": route.startsWith("/media/")
          ? "public, max-age=86400"
          : "no-cache",
      });
      if (method === "HEAD") return res.end();
      fs.createReadStream(file).pipe(res);
    } catch (error) {
      if (!res.headersSent)
        send(res, error.status || 502, {
          error: error.status
            ? error.message
            : "The service is temporarily unavailable. Try again or use the provider search links.",
        });
      else res.end();
    }
  });
  server.on("close", () => db.close());
  return server;
}
module.exports = { createApp };
