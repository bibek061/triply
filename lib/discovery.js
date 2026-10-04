"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { createPhotos } = require("./photos");
const { browseDestination } = require("./destinations");

function createDiscovery({ dataDir, fetchImpl = fetch, env = process.env }) {
  const cache = new Map(),
    pending = new Map();
  const photoRefs = new Map(),
    photos = createPhotos({ fetchImpl });
  let geoQueue = Promise.resolve(),
    mapQueue = Promise.resolve(),
    lastGeo = 0;
  const geocoder =
    env.NOMINATIM_URL || "https://nominatim.openstreetmap.org/search";
  const overpass =
    env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

  async function cached(key, ttl, load) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.value;
    if (pending.has(key)) return pending.get(key);
    const promise = load()
      .then((value) => {
        if (cache.size >= 300) cache.delete(cache.keys().next().value);
        cache.set(key, { at: Date.now(), value });
        return value;
      })
      .finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }

  async function json(url, options = {}) {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(35000),
      ...options,
      headers: {
        "User-Agent": "Triply/2.0 (https://github.com/bibek061/triply)",
        Accept: "application/json",
        ...options.headers,
      },
    });
    if (!response.ok) throw Error("External discovery service unavailable");
    return response.json();
  }

  function geocode(country, location) {
    return cached(`geo:${country}:${location.toLowerCase()}`, 86400000, () => {
      // Nominatim allows at most one request per second, across all users.
      const job = geoQueue.then(async () => {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(0, 1100 - (Date.now() - lastGeo))),
        );
        lastGeo = Date.now();
        return json(
          `${geocoder}?${new URLSearchParams({ q: location, ...(country ? { countrycodes: country.toLowerCase() } : {}), addressdetails: "1", format: "jsonv2", limit: "1" })}`,
        );
      });
      geoQueue = job.catch(() => {});
      return job;
    });
  }

  async function places({ country = "", location, category, destination }) {
    const area = browseDestination(location, country, destination);
    if (area) return area;
    return cached(
      JSON.stringify([
        country,
        location.toLowerCase(),
        category,
        destination?.id,
      ]),
      3600000,
      async () => {
        const centers =
          destination &&
          Number.isFinite(destination.lat) &&
          Number.isFinite(destination.lon)
            ? [
                {
                  lat: destination.lat,
                  lon: destination.lon,
                  display_name: destination.label,
                  address: { country_code: destination.country },
                },
              ]
            : await geocode(country, location);
        if (!centers.length)
          return {
            places: [],
            center: null,
            message:
              "No destination found. Try a country, state, or city name; add the country if the name is ambiguous.",
          };
        const lat = Number(centers[0].lat),
          lon = Number(centers[0].lon);
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lon) ||
          Math.abs(lat) > 90 ||
          Math.abs(lon) > 180
        )
          throw Error("Invalid coordinates");
        const selectors = {
          camping: ['nwr["tourism"="camp_site"]'],
          hiking: ['relation["route"="hiking"]', 'nwr["natural"="peak"]'],
          views: ['nwr["tourism"="viewpoint"]'],
          beaches: ['nwr["natural"="beach"]'],
          attractions: ['nwr["tourism"="attraction"]', 'nwr["historic"]'],
        };
        const chosen = selectors[category] || Object.values(selectors).flat();
        // Bounding boxes use the spatial index much faster than relation-around
        // queries. Filter their corner results back to a 20 km circle below.
        const latDelta = 20 / 111.195;
        const lonDelta = Math.min(
          180,
          latDelta / Math.max(0.0001, Math.cos((lat * Math.PI) / 180)),
        );
        const south = Math.max(-90, lat - latDelta),
          north = Math.min(90, lat + latDelta);
        const west = lon - lonDelta,
          east = lon + lonDelta;
        const ranges =
          west < -180
            ? [
                [west + 360, 180],
                [-180, east],
              ]
            : east > 180
              ? [
                  [west, 180],
                  [-180, east - 360],
                ]
              : [[west, east]];
        const query = `[out:json][timeout:25][maxsize:33554432];(${ranges.flatMap(([w, e]) => chosen.map((s) => `${s}["name"](${south},${w},${north},${e});`)).join("")});out center 100;`;
        // Serialize map requests; identical searches already share one promise.
        const job = mapQueue.then(() =>
          json(`${overpass}?${new URLSearchParams({ data: query })}`),
        );
        mapQueue = job.catch(() => {});
        const result = await job;
        // A 200 response can contain a timeout remark and partial data.
        if (result.remark)
          throw Error("Map query did not complete. Try another location.");
        if (!Array.isArray(result.elements))
          throw Error("Invalid map response");
        const response = {
          country: centers[0].address?.country_code?.toUpperCase() || country,
          center: { lat, lon, name: centers[0].display_name },
          checkedAt: new Date().toISOString(),
          places: result.elements
            .map((p) => {
              const point = p.center || p;
              const radians = (degrees) => (degrees * Math.PI) / 180;
              const a =
                Math.sin(radians(point.lat - lat) / 2) ** 2 +
                Math.cos(radians(lat)) *
                  Math.cos(radians(point.lat)) *
                  Math.sin(radians(point.lon - lon) / 2) ** 2;
              return {
                ...p,
                distance: 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a))),
              };
            })
            .filter(
              (p) =>
                p.tags?.name &&
                p.distance <= 20 &&
                ["node", "way", "relation"].includes(p.type),
            )
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 35)
            .map((p) => ({
              id: `osm-${p.type}-${p.id}`,
              name: p.tags.name,
              lat: Number((p.center || p).lat),
              lon: Number((p.center || p).lon),
              distanceKm: Math.round(p.distance * 10) / 10,
              feeStatus:
                p.tags.fee === "no"
                  ? "free"
                  : p.tags.fee === "yes"
                    ? "paid"
                    : "unknown",
              wikidata: p.tags.wikidata || "",
              commons: p.tags.wikimedia_commons || "",
              wikipedia: p.tags.wikipedia || "",
              category:
                p.tags.tourism === "camp_site"
                  ? "camping"
                  : p.tags.route === "hiking" || p.tags.natural === "peak"
                    ? "hiking"
                    : p.tags.tourism === "viewpoint"
                      ? "views"
                      : p.tags.natural === "beach"
                        ? "beaches"
                        : "attractions",
              detail:
                p.tags.description ||
                p.tags.tourism ||
                p.tags.natural ||
                "Outdoor place",
              url: `https://www.openstreetmap.org/${p.type}/${p.id}`,
              fee:
                p.tags.fee === "yes"
                  ? "Admission may apply"
                  : p.tags.fee === "no"
                    ? "No fee listed"
                    : "Check access & fees",
            })),
        };
        for (const p of response.places) photoRefs.set(p.id, p);
        while (photoRefs.size > 2000)
          photoRefs.delete(photoRefs.keys().next().value);
        return response;
      },
    );
  }

  async function convert(amount, from, to) {
    if (from === to) return { amount, from, to, converted: amount };
    const file = path.join(dataDir, "exchange-cache.json");
    let stored;
    try {
      stored = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {}
    let data = stored;
    if (!data || Date.now() - data.fetchedAt > 86400000) {
      data = await cached("rates", 86400000, async () => {
        const value = await json("https://open.er-api.com/v6/latest/USD");
        if (value.result !== "success" || !value.rates?.USD)
          throw Error("Currency rates unavailable");
        const fresh = { ...value, fetchedAt: Date.now() };
        fs.writeFileSync(file, JSON.stringify(fresh));
        return fresh;
      }).catch((error) => {
        if (stored && Date.now() - stored.fetchedAt < 7 * 86400000)
          return stored;
        throw error;
      });
    }
    if (!data.rates[from] || !data.rates[to])
      return {
        error:
          "This currency is not covered by the rate provider. No conversion was made.",
      };
    return {
      amount,
      from,
      to,
      converted: (amount / data.rates[from]) * data.rates[to],
      updatedAt: data.time_last_update_utc,
      stale: Date.now() - data.fetchedAt > 86400000,
    };
  }
  return {
    places,
    convert,
    savedDetails: async (id) => {
      const place = photoRefs.get(id);
      if (!place) return {};
      const images = await photos.enrich([place]);
      return {
        fee: place.fee,
        feeStatus: place.feeStatus,
        photo: images[id] || null,
      };
    },
    destinationPhotos: (cities) => photos.enrich(cities),
    photos: (ids) =>
      photos.enrich(ids.map((id) => photoRefs.get(id)).filter(Boolean)),
  };
}
module.exports = { createDiscovery };
