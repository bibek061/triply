// Node 24+: SQLite, password hashing, HTTP server, and fetch are built in.
try {
  process.loadEnvFile();
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const { createApp } = require("./lib/app-server");
const port = Number(process.env.PORT || 4173);
createApp().listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(
    `Triply is running at http://${process.env.HOST || "127.0.0.1"}:${port}`,
  ),
);
