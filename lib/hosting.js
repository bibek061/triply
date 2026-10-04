"use strict";

function hostingEnv(source = process.env) {
  const env = { ...source };
  const origin =
    env.PUBLIC_ORIGIN || (env.RENDER === "true" ? env.RENDER_EXTERNAL_URL : "");
  if (origin) {
    const url = new URL(origin);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error(
        "PUBLIC_ORIGIN must be an HTTPS origin without a path or credentials.",
      );
    env.PUBLIC_ORIGIN = url.origin;
  }
  if (env.NODE_ENV === "production" && (!env.PUBLIC_ORIGIN || !env.DATA_DIR))
    throw new Error(
      "Production requires PUBLIC_ORIGIN (or Render's external URL) and a persistent DATA_DIR.",
    );
  return env;
}

module.exports = { hostingEnv };
