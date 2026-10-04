"use strict";
try {
  process.loadEnvFile();
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const { createProviders } = require("../lib/providers");
async function main() {
  const provider = createProviders();
  if (!provider.configured) {
    console.log("Amadeus: credentials are not configured.");
    process.exitCode = 1;
    return;
  }
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + 30);
  const result = await provider.flights({
    origin: "JFK",
    destination: "LHR",
    start: day.toISOString().slice(0, 10),
    adults: 1,
    currency: "USD",
  });
  console.log(
    JSON.stringify({
      provider: "Amadeus",
      status: result.status,
      offers: result.offers.length,
      message: result.message,
    }),
  );
}
main().catch(() => {
  console.error(
    "Amadeus connection failed. Check your key/secret, environment, and account access. No credentials have been printed.",
  );
  process.exitCode = 1;
});
