"use strict";
// Missing map tags remain unknown instead of becoming advertised facilities.
function placeFacts(tags = {}) {
  const text = (key) =>
    typeof tags[key] === "string" ? tags[key].slice(0, 1000) : "";
  const yesNo = (key) =>
    ["yes", "no"].includes(tags[key]) ? tags[key] : "unknown";
  const length = text("distance")
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*(km|m|mi)?$/i);
  const elevation = text("ele")
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*(?:m)?$/);
  let website = "";
  try {
    const url = new URL(text("website") || text("contact:website"));
    if (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      website = url.href;
  } catch {}
  const difficulties = [
    "strolling",
    "hiking",
    "mountain_hiking",
    "demanding_mountain_hiking",
    "alpine_hiking",
    "demanding_alpine_hiking",
    "difficult_alpine_hiking",
  ];
  const isTrail =
    tags.route === "hiking" || Boolean(tags.highway && tags.sac_scale);
  return {
    toilets: yesNo("toilets"),
    showers: yesNo("shower"),
    drinkingWater: yesNo("drinking_water"),
    tents: yesNo("tents"),
    caravans: yesNo("caravans"),
    wheelchair: ["yes", "no", "limited"].includes(tags.wheelchair)
      ? tags.wheelchair
      : "unknown",
    lifeguard: yesNo("lifeguard"),
    difficulty: difficulties.includes(tags.sac_scale)
      ? tags.sac_scale
      : "unknown",
    trailLengthKm:
      isTrail && length
        ? Number(length[1]) *
          (length[2]?.toLowerCase() === "m"
            ? 0.001
            : length[2]?.toLowerCase() === "mi"
              ? 1.609344
              : 1)
        : null,
    elevationMeters: elevation ? Number(elevation[1]) : null,
    openingHours: text("opening_hours"),
    access: text("access"),
    operator: text("operator"),
    surface: text("surface"),
    website,
    isTrail,
  };
}
module.exports = { placeFacts };
