"use strict";
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const files = [
  "server.js",
  "global-app.js",
  ...["lib", "scripts", "tests"].flatMap((dir) =>
    fs
      .readdirSync(dir)
      .filter((file) => file.endsWith(".js"))
      .map((file) => `${dir}/${file}`),
  ),
];
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax checked ${files.length} JavaScript files.`);
