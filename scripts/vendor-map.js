"use strict";
const fs = require("node:fs"),
  path = require("node:path");
async function main() {
  const dir = path.join(__dirname, "../vendor/leaflet");
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, url] of [
    ["leaflet.js", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"],
    ["leaflet.css", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"],
    [
      "LICENSE",
      "https://raw.githubusercontent.com/Leaflet/Leaflet/v1.9.4/LICENSE",
    ],
  ]) {
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw Error("Map download failed");
    fs.writeFileSync(path.join(dir, file), await r.text());
    console.log("Saved " + file);
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
