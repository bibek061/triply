const fs = require("node:fs");
const { createDiscovery } = require("../lib/discovery");
fs.mkdirSync("private-data", { recursive: true });
const fetchImpl = async (url, options) => {
  const res = await fetch(url, options);
  console.log(new URL(url).hostname, res.status);
  if (!res.ok) console.log((await res.clone().text()).slice(0, 400));
  return res;
};
createDiscovery({ dataDir: "private-data", fetchImpl })
  .places({ country: "NP", location: "Pokhara", category: "views" })
  .then((result) => console.log("Places:", result.places.length))
  .catch((e) => {
    console.error(e.message, e.cause?.message);
    process.exitCode = 1;
  });
