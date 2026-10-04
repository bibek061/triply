// Node 24+: SQLite, password hashing, HTTP server, and fetch are built in.
try {
  process.loadEnvFile();
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const { createApp } = require("./lib/app-server");
const { hostingEnv } = require("./lib/hosting");
const env = hostingEnv();
const port = Number(env.PORT || 4173);
const server = createApp({ env }).listen(port, env.HOST || "127.0.0.1", () =>
  console.log(
    `Triply is running at ${env.PUBLIC_ORIGIN || `http://${env.HOST || "127.0.0.1"}:${port}`}`,
  ),
);
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  server.close(() => {
    clearTimeout(timeout);
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
