"use strict";
const catalog = require("../data/countries.json").countries;
const data = require("../data/destinations.json");
const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const countries = new Map(catalog.map((c) => [c.code, c.name]));
const regions = new Map(data.regions.map((r) => [r[0], r[1]]));
const entries = [
  ...catalog.map((c) => ({
    id: `country-${c.code}`,
    name: c.name,
    label: c.name,
    kind: "Country",
    country: c.code,
    aliases: c.officialName,
    population: 0,
  })),
  ...data.regions.map((r) => ({
    id: `region-${r[0]}`,
    name: r[1],
    label: `${r[1]}, ${countries.get(r[0].split(".")[0])}`,
    kind: "State / region",
    country: r[0].split(".")[0],
    aliases: r[2],
    population: 0,
  })),
  ...data.cities.map((r) => ({
    id: `city-${r[0]}`,
    name: r[1],
    label: [r[1], regions.get(`${r[3]}.${r[4]}`), countries.get(r[3])]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(", "),
    kind: "City",
    country: r[3],
    region: `${r[3]}.${r[4]}`,
    lat: r[5],
    lon: r[6],
    aliases: r[2],
    population: r[7],
  })),
].map((e) => ({
  ...e,
  search: normalize(`${e.label} ${e.aliases}`),
  normalizedName: normalize(e.name),
}));
const byId = new Map(entries.map((e) => [e.id, e]));
function publicEntry(e) {
  return {
    id: e.id,
    name: e.name,
    label: e.label,
    kind: e.kind,
    country: e.country,
    lat: e.lat,
    lon: e.lon,
  };
}
function suggestions(query) {
  const q = normalize(query),
    tokens = q.split(" ");
  if (q.length < 2) return [];
  return entries
    .filter((e) =>
      tokens.every((t) => e.search.split(" ").some((w) => w.startsWith(t))),
    )
    .map((e) => ({
      e,
      score:
        (e.normalizedName === q
          ? 100
          : e.normalizedName.startsWith(q)
            ? 50
            : 0) +
        (e.kind === "Country" ? 15 : e.kind === "State / region" ? 5 : 0) +
        Math.log10(e.population + 1),
    }))
    .sort((a, b) => b.score - a.score || a.e.label.localeCompare(b.e.label))
    .slice(0, 8)
    .map((x) => publicEntry(x.e));
}
function destination(id) {
  const e = byId.get(id);
  return e ? publicEntry(e) : null;
}
function browseDestination(location, country = "", selected) {
  const q = normalize(location);
  let area = selected ? byId.get(selected.id) : null;
  if (!selected) {
    area = entries.find(
      (e) =>
        e.kind === "Country" &&
        (!country || e.country === country) &&
        [e.name, e.aliases, e.label].some((v) => v && normalize(v) === q),
    );
    if (!area) {
      const matches = entries.filter(
        (e) =>
          e.kind === "State / region" &&
          (!country || e.country === country) &&
          [e.name, e.aliases, e.label].some((v) => v && normalize(v) === q),
      );
      if (matches.length === 1) area = matches[0];
    }
  }
  if (!area || area.kind === "City") return null;
  const cities = entries
    .filter(
      (e) =>
        e.kind === "City" &&
        e.country === area.country &&
        (area.kind === "Country" || e.region === area.id.slice(7)),
    )
    .sort(
      (a, b) => b.population - a.population || a.label.localeCompare(b.label),
    );
  return {
    scope: "area",
    destination: publicEntry(area),
    destinations: cities.slice(0, 12).map(publicEntry),
    cityCount: cities.length,
    country: area.country,
    places: [],
    center: null,
  };
}
module.exports = { suggestions, destination, browseDestination };
