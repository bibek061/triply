"use strict";
// Exact map references take priority. Coordinate matches are always labeled nearby.
function createPhotos({ fetchImpl = fetch, now = Date.now } = {}) {
  const cache = new Map(),
    pending = new Map(),
    assigned = new Map();
  let active = 0;
  const queue = [];
  const clean = (value) =>
    String(value || "")
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .slice(0, 300);
  const normalize = (value) => value.replace(/_/g, " ").normalize("NFC");
  const words = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(
        (w) =>
          w.length >= 3 &&
          !new Set([
            "the",
            "and",
            "des",
            "les",
            "der",
            "die",
            "das",
            "view",
            "viewpoint",
            "point",
            "lake",
            "park",
            "beach",
            "camping",
            "camp",
            "site",
            "house",
            "pont",
            "bridge",
          ]).has(w),
      );
  const nameMatches = (name, title) => {
    const tokens = words(name),
      candidate = new Set(words(title));
    return (
      tokens.length > 0 &&
      tokens.filter((t) => candidate.has(t)).length >=
        Math.ceil(tokens.length / 2)
    );
  };
  const safeUrl = (value, host) => {
    try {
      const u = new URL(value);
      return u.protocol === "https:" && u.hostname === host ? u.href : null;
    } catch {
      return null;
    }
  };
  async function request(host, query) {
    if (active >= 3) await new Promise((resolve) => queue.push(resolve));
    active++;
    try {
      const r = await fetchImpl(
        `https://${host}/w/api.php?${new URLSearchParams({ format: "json", ...query })}`,
        {
          headers: {
            "User-Agent": "Triply/2.1 (https://github.com/bibek061/triply)",
          },
          signal: AbortSignal.timeout(6000),
        },
      );
      if (!r.ok) throw Error("Photos unavailable");
      const data = await r.json();
      if (data.error) throw Error("Photos unavailable");
      return data;
    } finally {
      active--;
      queue.shift()?.();
    }
  }
  function photo(info) {
    const meta = info?.extmetadata;
    const url =
      safeUrl(info?.thumburl, "upload.wikimedia.org") ||
      safeUrl(info?.thumburl, "thumb.wikimedia.org");
    const source = safeUrl(info?.descriptionurl, "commons.wikimedia.org");
    const license = clean(meta?.LicenseShortName?.value),
      credit = clean(meta?.Artist?.value);
    if (
      !url ||
      !source ||
      !license ||
      !credit ||
      !/^image\/(jpeg|png|webp)$/.test(info?.mime || "image/jpeg")
    )
      return null;
    if (
      !/^(CC BY(?:-SA)? [\d.]+|CC0(?: [\d.]+)?|Public domain)$/i.test(license)
    )
      return null;
    return {
      url,
      source,
      credit,
      license,
      kind: "place",
      title: clean(meta?.ObjectName?.value),
    };
  }
  async function readFiles(titles) {
    if (!titles.length) return new Map();
    const data = await request("commons.wikimedia.org", {
      action: "query",
      titles: [...new Set(titles)].join("|"),
      prop: "imageinfo",
      iiprop: "url|mime|extmetadata",
      iiurlwidth: "800",
    });
    const images = new Map(
      Object.values(data.query?.pages || {}).map((p) => [
        normalize(p.title),
        photo(p.imageinfo?.[0]),
      ]),
    );
    for (const n of data.query?.normalized || [])
      images.set(normalize(n.from), images.get(normalize(n.to)));
    return images;
  }
  async function load(items) {
    const result = {},
      files = new Map();
    for (const p of items) {
      const f = p.commons || "";
      if (f && !f.includes("|") && /\.(jpe?g|png|webp)$/i.test(f))
        files.set(p.id, /^File:/i.test(f) ? f : "File:" + f);
    }
    const qs = [
      ...new Set(
        items.map((p) => p.wikidata).filter((q) => /^Q\d+$/.test(q || "")),
      ),
    ];
    if (qs.length)
      try {
        const data = await request("www.wikidata.org", {
          action: "wbgetentities",
          ids: qs.join("|"),
          props: "claims",
        });
        for (const p of items) {
          const claim = data.entities?.[p.wikidata]?.claims?.P18?.filter(
            (c) =>
              c.rank !== "deprecated" &&
              typeof c.mainsnak?.datavalue?.value === "string",
          ).sort(
            (a, b) => (b.rank === "preferred") - (a.rank === "preferred"),
          )[0];
          if (claim && !files.has(p.id))
            files.set(p.id, "File:" + claim.mainsnak.datavalue.value);
        }
      } catch {}
    const languages = new Map();
    const cities = items.filter((p) => p.kind === "City" && !files.has(p.id));
    if (cities.length) {
      const fold = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
      const entries = cities.flatMap((p) =>
        [
          ...new Set(
            [
              p.name,
              fold(p.name),
              `${fold(p.name)}, ${p.label.split(", ").at(-1)}`,
              fold(p.label.split(", ").slice(0, -1).join(", ")),
            ].filter(Boolean),
          ),
        ].map((title) => ({ id: p.id, title, city: p })),
      );
      languages.set("en", entries);
    }
    for (const p of items.filter((p) => !files.has(p.id))) {
      const match = /^([a-z]{2,3}(?:-[a-z]{2,12})?):([^|]{1,250})$/.exec(
        p.wikipedia || "",
      );
      if (match) {
        if (!languages.has(match[1])) languages.set(match[1], []);
        languages.get(match[1]).push({ id: p.id, title: match[2] });
      }
    }
    await Promise.all(
      [...languages].map(async ([lang, entries]) => {
        try {
          const data = await request(`${lang}.wikipedia.org`, {
            action: "query",
            titles: entries.map((e) => e.title).join("|"),
            redirects: "1",
            prop: "pageimages|coordinates|pageprops",
            ppprop: "wikibase_item",
            colimit: "max",
            coprop: "country",
            piprop: "name",
            pilicense: "free",
            pilimit: "50",
          });
          const aliases = new Map(
            [
              ...(data.query?.normalized || []),
              ...(data.query?.redirects || []),
            ].map((n) => [normalize(n.from), normalize(n.to)]),
          );
          const pages = new Map(
            Object.values(data.query?.pages || {}).map((p) => [
              normalize(p.title),
              p,
            ]),
          );
          const unresolved = entries.some((e) => e.city)
            ? [...pages.values()].filter(
                (p) =>
                  p.pageimage &&
                  !p.coordinates?.length &&
                  /^Q\d+$/.test(p.pageprops?.wikibase_item || ""),
              )
            : [];
          if (unresolved.length)
            try {
              const coords = await request("www.wikidata.org", {
                action: "wbgetentities",
                ids: [
                  ...new Set(unresolved.map((p) => p.pageprops.wikibase_item)),
                ].join("|"),
                props: "claims",
              });
              for (const p of unresolved) {
                const value = coords.entities?.[
                  p.pageprops.wikibase_item
                ]?.claims?.P625?.find((c) => c.rank !== "deprecated")?.mainsnak
                  ?.datavalue?.value;
                if (
                  value &&
                  value.globe === "http://www.wikidata.org/entity/Q2"
                )
                  p.coordinates = [
                    { lat: value.latitude, lon: value.longitude },
                  ];
              }
            } catch {}
          for (const e of entries) {
            let title = normalize(e.title);
            for (let n = 0; n < 5 && aliases.has(title); n++)
              title = aliases.get(title);
            const page = pages.get(title);
            if (!page?.pageimage || files.has(e.id)) continue;
            if (e.city) {
              const c = page.coordinates?.[0];
              if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lon))
                continue;
              const rad = (n) => (n * Math.PI) / 180;
              const a =
                Math.sin(rad(c.lat - e.city.lat) / 2) ** 2 +
                Math.cos(rad(c.lat)) *
                  Math.cos(rad(e.city.lat)) *
                  Math.sin(rad(c.lon - e.city.lon) / 2) ** 2;
              if (
                6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a))) > 50 ||
                (c.country && c.country !== e.city.country)
              )
                continue;
              if (
                /(?:^|[ _])(flag|map|coat of arms)(?:[ _.]|$)/i.test(
                  page.pageimage,
                )
              )
                continue;
            }
            files.set(e.id, "File:" + page.pageimage);
          }
        } catch {}
      }),
    );
    try {
      const images = await readFiles([...files.values()]);
      for (const [id, file] of files) {
        const image = images.get(normalize(file));
        if (image)
          result[id] = {
            ...image,
            kind:
              items.find((p) => p.id === id)?.kind === "City"
                ? "city"
                : "place",
          };
      }
    } catch {}
    for (const [id, image] of Object.entries(result))
      assigned.set(image.source, id);
    await Promise.all(
      items
        .filter((p) => !result[p.id])
        .map(async (p) => {
          if (
            !Number.isFinite(p.lat) ||
            !Number.isFinite(p.lon) ||
            Math.abs(p.lat) > 90 ||
            Math.abs(p.lon) > 180
          )
            return;
          try {
            const data = await request("commons.wikimedia.org", {
              action: "query",
              list: "geosearch",
              gsprimary: "all",
              gsnamespace: "6",
              gsradius: "150",
              gslimit: "30",
              gscoord: `${p.lat}|${p.lon}`,
            });
            // Geotags can be wrong: also require a meaningful name match, never only proximity.
            const nearby = (data.query?.geosearch || [])
              .filter(
                (f) =>
                  Number.isFinite(f.dist) &&
                  f.dist <= 150 &&
                  /\.(jpe?g|png|webp)$/i.test(f.title) &&
                  nameMatches(p.name, f.title),
              )
              .sort((a, b) => a.dist - b.dist)
              .slice(0, 8);
            const images = await readFiles(nearby.map((f) => f.title));
            for (const f of nearby) {
              const image = images.get(normalize(f.title));
              if (
                !image ||
                (assigned.has(image.source) &&
                  assigned.get(image.source) !== p.id)
              )
                continue;
              assigned.set(image.source, p.id);
              result[p.id] = {
                ...image,
                kind: "nearby",
                distanceMeters: Math.round(f.dist),
                title: clean(f.title.replace(/^File:/, "")),
              };
              break;
            }
          } catch {
            /* No unrelated stock photo is substituted. */
          }
        }),
    );
    for (const p of items)
      cache.set(p.id, {
        photo: result[p.id] || null,
        expires: now() + (result[p.id] ? 86400000 : 600000),
      });
    while (cache.size > 2000) cache.delete(cache.keys().next().value);
    while (assigned.size > 2000) assigned.delete(assigned.keys().next().value);
  }
  async function enrich(items) {
    const missing = items.filter(
      (p) => !cache.has(p.id) || cache.get(p.id).expires <= now(),
    );
    const fresh = missing.filter((p) => !pending.has(p.id));
    if (fresh.length) {
      const job = load(fresh).finally(() =>
        fresh.forEach((p) => pending.delete(p.id)),
      );
      fresh.forEach((p) => pending.set(p.id, job));
    }
    await Promise.all(missing.map((p) => pending.get(p.id)));
    return Object.fromEntries(
      items
        .filter((p) => cache.get(p.id)?.photo)
        .map((p) => [p.id, cache.get(p.id).photo]),
    );
  }
  return { enrich };
}
module.exports = { createPhotos };
