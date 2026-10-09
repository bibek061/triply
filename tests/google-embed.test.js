const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

test("Google embed stays in-page, follows categories, and escapes destination input", () => {
  const state = {
    googleMapsEmbedKey: "synthetic-test-key",
    searchDone: true, kind: "explore", category: "camping",
    location: 'Paris & <img src=x onerror=alert(1)>', country: "FR",
    places: [], placeFilters: {}, currency: "USD", start: "2026-11-01",
    end: "2026-11-03", adults: 2, budget: "", admission: "any",
  };
  const escapeHTML = (v) => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const context = {
    window: {}, document: {addEventListener() {}}, state, URLSearchParams,
    TriplyFilters: {places: () => []}, escapeHTML,
    destinationLabel: (location) => location, intro: () => "", icon: () => "",
    categoryFilters: () => "", categoryName: (category) => category,
    destinationHint: () => "", future: () => "2026-10-08",
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../explore-ui.js"), "utf8"), context);
  for (const [category, term] of [["camping", "campsites"], ["hiking", "hiking trails"], ["beaches", "beaches"]]) {
    state.category = category;
    const html = context.window.TriplyExplore.discover();
    assert.ok(!html.includes("<img src=x"));
    const src = html.match(/<iframe[^>]+src="([^"]+)"/)[1].replaceAll("&amp;", "&");
    const url = new URL(src);
    assert.equal(url.origin, "https://www.google.com");
    assert.equal(url.pathname, "/maps/embed/v1/search");
    assert.equal(url.searchParams.get("q"), `${term} near ${state.location}`);
    assert.equal(url.searchParams.get("key"), "synthetic-test-key");
    assert.match(html, /referrerpolicy="strict-origin-when-cross-origin"/);
    assert.ok(!html.includes('name="admission"'));
  }
});
