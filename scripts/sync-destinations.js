"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  zlib = require("node:zlib");
const countries = require("../data/countries.json").countries;
// Read just the named file into memory; never extract archive paths to disk.
function unzipEntry(zip, wanted) {
  let end = zip.length - 22;
  while (
    end >= Math.max(0, zip.length - 65557) &&
    zip.readUInt32LE(end) !== 0x06054b50
  )
    end--;
  if (end < Math.max(0, zip.length - 65557))
    throw Error("Invalid ZIP directory");
  let offset = zip.readUInt32LE(end + 16);
  for (let i = 0; i < zip.readUInt16LE(end + 10); i++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50)
      throw Error("Invalid ZIP entry");
    const size = zip.readUInt32LE(offset + 20),
      length = zip.readUInt16LE(offset + 28);
    const name = zip.toString("utf8", offset + 46, offset + 46 + length);
    if (name === wanted) {
      if (zip.readUInt32LE(offset + 24) > 50000000)
        throw Error("Dataset too large");
      const local = zip.readUInt32LE(offset + 42);
      const start =
        local +
        30 +
        zip.readUInt16LE(local + 26) +
        zip.readUInt16LE(local + 28);
      const bytes = zip.subarray(start, start + size),
        method = zip.readUInt16LE(offset + 10);
      return (
        method === 8
          ? zlib.inflateRawSync(bytes, { maxOutputLength: 50000000 })
          : method === 0
            ? bytes
            : (() => {
                throw Error("Unsupported ZIP compression");
              })()
      ).toString("utf8");
    }
    offset +=
      46 +
      length +
      zip.readUInt16LE(offset + 30) +
      zip.readUInt16LE(offset + 32);
  }
  throw Error("Cities file missing");
}
async function main() {
  const base = "https://download.geonames.org/export/dump/";
  const download = async (file) => {
    const r = await fetch(base + file, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw Error(`Download failed: ${file}`);
    return Buffer.from(await r.arrayBuffer());
  };
  const [admin, zip] = await Promise.all([
    download("admin1CodesASCII.txt"),
    download("cities15000.zip"),
  ]);
  const known = new Set(countries.map((c) => c.code));
  const regions = admin
    .toString("utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split("\t"))
    .filter((row) => known.has(row[0].split(".")[0]));
  const cities = unzipEntry(zip, "cities15000.txt")
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split("\t"))
    .filter((row) => known.has(row[8]))
    .map((r) => [
      r[0],
      r[1],
      r[2],
      r[8],
      r[10],
      Number(r[4]),
      Number(r[5]),
      Number(r[14]),
    ]);
  if (cities.length < 20000 || regions.length < 2000)
    throw Error("Incomplete destination data");
  fs.writeFileSync(
    path.join(__dirname, "../data/destinations.json"),
    JSON.stringify({
      source: base,
      license: "CC BY 4.0",
      retrievedAt: new Date().toISOString(),
      regions,
      cities,
    }) + "\n",
  );
  console.log(`Saved ${regions.length} regions and ${cities.length} cities.`);
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
