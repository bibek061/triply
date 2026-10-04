"use strict";
try {
  process.loadEnvFile();
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const { createProviders } = require("../lib/providers");
async function main() {
  const p = createProviders();
  const start = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 33 * 86400000).toISOString().slice(0, 10);
  const q = {
    start,
    end,
    adults: 2,
    currency: "USD",
    residence: "US",
    lat: 52.3676,
    lon: 4.9041,
    origin: "JFK",
    destination: "LHR",
    airport: "AMS",
    driverAge: 30,
    pickupTime: "10:00",
    dropoffTime: "10:00",
  };
  for (const kind of ["flights", "stays", "cars"]) {
    const result = await p[kind](q);
    console.log(
      JSON.stringify({
        kind,
        provider: result.provider,
        status: result.status,
        offers: result.offers.length,
        message: result.message,
      }),
    );
    if (!["live", "sandbox"].includes(result.status)) process.exitCode = 1;
  }
}
main().catch(() => {
  console.error(
    "Pricing check failed. No credentials or provider payloads have been printed.",
  );
  process.exitCode = 1;
});
