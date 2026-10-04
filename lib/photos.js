"use strict";
// Match images through OSM's explicit Wikidata / Wikimedia references, never
// by a fuzzy name match that could photograph a different place.
function createPhotos({ fetchImpl = fetch } = {}) {
  const cache = new Map(),
    pending = new Map();
  const clean = (value) =>
    String(value || "")
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .slice(0, 300);
  const safeUrl = (value, host) => {
    try {
      const u = new URL(value);
      return u.protocol === "https:" &&
        (u.hostname === host || u.hostname.endsWith("." + host))
        ? u.href
        : null;
    } catch {
      return null;
    }
  };
  async function request(host, query) {
    const r = await fetchImpl(
      `https://${host}/w/api.php?${new URLSearchParams({ format: "json", ...query })}`,
      {
        headers: {
          "User-Agent": "Triply/2.0 (https://github.com/bibek061/triply)",
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!r.ok) throw Error("Photos unavailable");
    return r.json();
  }
  async function enrich(items) {
    const result = {};
    const missing = items.filter((p) => !cache.has(p.id));
    if (missing.length) {
      const key = missing
        .map((p) => p.id)
        .sort()
        .join("|");
      if (!pending.has(key))
        pending.set(
          key,
          (async () => {
            const files = new Map(
              missing
                .filter((p) => /^File:[^|]+$/i.test(p.commons || ""))
                .map((p) => [p.id, p.commons]),
            );
            const qs = [
              ...new Set(
                missing
                  .map((p) => p.wikidata)
                  .filter((q) => /^Q\d+$/.test(q || "")),
              ),
            ];
            if (qs.length)
              try {
                const data = await request("www.wikidata.org", {
                  action: "wbgetentities",
                  ids: qs.join("|"),
                  props: "claims",
                });
                for (const p of missing) {
                  const claim = data.entities?.[p.wikidata]?.claims?.P18?.find(
                    (c) =>
                      c.rank !== "deprecated" &&
                      typeof c.mainsnak?.datavalue?.value === "string",
                  );
                  if (claim && !files.has(p.id))
                    files.set(p.id, "File:" + claim.mainsnak.datavalue.value);
                }
              } catch {
                /* Keep category photos when the source is unavailable. */
              }
            if (files.size)
              try {
                const data = await request("commons.wikimedia.org", {
                  action: "query",
                  titles: [...new Set(files.values())].join("|"),
                  prop: "imageinfo",
                  iiprop: "url|extmetadata",
                  iiurlwidth: "800",
                });
                const normalize = (t) => t.replace(/_/g, " ").normalize("NFC");
                const normalized = new Map(
                  (data.query?.normalized || []).map((n) => [
                    normalize(n.from),
                    normalize(n.to),
                  ]),
                );
                const pages = new Map(
                  Object.values(data.query?.pages || {}).map((p) => [
                    normalize(p.title),
                    p.imageinfo?.[0],
                  ]),
                );
                for (const [id, title] of files) {
                  const key = normalize(title),
                    info = pages.get(normalized.get(key) || key),
                    meta = info?.extmetadata;
                  const url =
                      safeUrl(info?.thumburl, "upload.wikimedia.org") ||
                      safeUrl(info?.thumburl, "thumb.wikimedia.org"),
                    source = safeUrl(
                      info?.descriptionurl,
                      "commons.wikimedia.org",
                    );
                  const license = clean(meta?.LicenseShortName?.value),
                    author = clean(meta?.Artist?.value);
                  if (url && source && license && author)
                    cache.set(id, {
                      url,
                      source,
                      credit: author,
                      license,
                      kind: "place",
                    });
                }
              } catch {
                /* An unavailable image must not hide the map or place results. */
              }
            // Bound the cache and avoid repeated misses during this server session.
            for (const p of missing)
              if (!cache.has(p.id)) cache.set(p.id, null);
            while (cache.size > 2000) cache.delete(cache.keys().next().value);
          })().finally(() => pending.delete(key)),
        );
      await pending.get(key);
    }
    for (const p of items) if (cache.get(p.id)) result[p.id] = cache.get(p.id);
    return result;
  }
  return { enrich };
}
module.exports = { createPhotos };
