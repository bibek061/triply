"use strict";
window.TriplyPlace = (() => {
  const labels = {
    toilets: "Toilets",
    showers: "Showers",
    drinkingWater: "Drinking water",
    tents: "Tents allowed",
    caravans: "Caravans allowed",
    wheelchair: "Wheelchair access",
    lifeguard: "Lifeguard",
  };
  const facilities = {
    camping: ["tents", "caravans", "toilets", "showers", "drinkingWater"],
    hiking: ["drinkingWater"],
    views: ["wheelchair"],
    beaches: ["lifeguard", "toilets", "showers"],
    attractions: ["wheelchair", "toilets"],
    all: ["wheelchair", "toilets"],
  };
  const difficultyLabels = {
    strolling: "Strolling",
    hiking: "Hiking (T1)",
    mountain_hiking: "Mountain hiking (T2)",
    demanding_mountain_hiking: "Demanding mountain hiking (T3)",
    alpine_hiking: "Alpine hiking (T4)",
    demanding_alpine_hiking: "Demanding alpine hiking (T5)",
    difficult_alpine_hiking: "Difficult alpine hiking (T6)",
  };
  function filters() {
    if (state.kind !== "explore") return "";
    const selected = state.placeFilters[state.category] || {};
    return `<fieldset class="place-filters"><legend>${categoryName(state.category)} filters</legend><div class="place-filter-controls">${(facilities[state.category] || []).map((key) => `<label class="check-label"><input type="checkbox" data-place-facility="${key}" ${(selected.facilities || []).includes(key) ? "checked" : ""}>${labels[key]}</label>`).join("")}${
      state.category === "hiking"
        ? `<label>Mapped difficulty<select data-place-filter="difficulty" aria-label="Mapped difficulty"><option value="">Any / not listed</option>${Object.entries(
            difficultyLabels,
          )
            .map(
              ([key, label]) =>
                `<option value="${key}" ${selected.difficulty === key ? "selected" : ""}>${label}</option>`,
            )
            .join(
              "",
            )}</select></label><label>Maximum trail length<select data-place-filter="maxLength" aria-label="Maximum trail length"><option value="">Any / not listed</option>${[2, 5, 10, 20, 50].map((n) => `<option value="${n}" ${String(selected.maxLength) === String(n) ? "selected" : ""}>${n} km</option>`).join("")}</select></label>`
        : ""
    }<button type="button" class="text-link" data-action="clear-place-filters">Clear filters</button></div><p class="source-note">Only explicitly mapped facilities match. Unknown values are excluded when a filter is selected. Filters apply to the returned places, not every place in the region.</p></fieldset>`;
  }
  const factValue = (value) =>
    ({ yes: "Listed", no: "No", limited: "Limited", unknown: "Not listed" })[
      value
    ] || "Not listed";
  function details(p) {
    const facts = p.facts || {};
    const rows = [
      ["Entry fees", p.fee || "Not listed"],
      ...(facilities[p.category] || []).map((key) => [
        labels[key],
        factValue(facts[key]),
      ]),
    ];
    if (p.category === "hiking")
      rows.push(
        [
          "Mapped difficulty",
          difficultyLabels[facts.difficulty] || "Not listed",
        ],
        [
          "Trail length",
          Number.isFinite(facts.trailLengthKm)
            ? `${Math.round(facts.trailLengthKm * 100) / 100} km`
            : "Not listed",
        ],
        [
          "Elevation above sea level",
          Number.isFinite(facts.elevationMeters)
            ? `${facts.elevationMeters} m (not elevation gain)`
            : "Not listed",
        ],
        ["Surface", facts.surface || "Not listed"],
      );
    rows.push(
      ["Opening hours (map listing)", facts.openingHours || "Not listed"],
      ["Access", facts.access || "Not listed"],
      ["Operator", facts.operator || "Not listed"],
    );
    const saved = state.saved.some((item) => item.id === p.id);
    const description = ["viewpoint", "camp_site", "peak", "beach", "attraction", "Outdoor place"].includes(p.detail)
      ? "See mapped details and stories from travelers who have visited."
      : p.detail;
    const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.lat + "," + p.lon)}`;
    return `<a class="text-link" href="#home">← Back to discovery</a>${intro(escapeHTML(p.name), `${categoryName(p.category)} · ${escapeHTML(p.location || countryName(p.country))}`)}<div class="place-detail-layout"><section class="detail-photo-panel">${TriplyExplore.photoMarkup(p)}<p class="source-note">Photo labels distinguish public images from traveler uploads. Source credits link to the original image or story.</p></section><section class="detail-info"><p>${escapeHTML(description || "Explore this mapped place and ask travelers who have visited.")}</p><div class="detail-actions"><a class="primary-button" href="${directions}" target="_blank" rel="noopener noreferrer">Get directions ↗</a><button class="secondary-button" data-action="save-place" data-id="${escapeHTML(p.id)}">${saved ? "Unsave place" : "Save place"}</button><button class="secondary-button" data-action="place-photo">Share a photo</button>${facts.website ? `<a class="text-link" href="${escapeHTML(facts.website)}" target="_blank" rel="noopener noreferrer">Listed website ↗</a>` : ""}</div><dl class="place-facts">${rows.map(([key, value]) => `<div><dt>${key}</dt><dd>${escapeHTML(value)}</dd></div>`).join("")}</dl><p class="source-note">Facts from <a href="${escapeHTML(p.url)}" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors ↗</a> · retrieved ${escapeHTML(new Date(p.updatedAt).toLocaleDateString())}. Missing tags mean not listed. Verify fees, facilities and access with the operator.</p>${p.category === "hiking" ? '<p class="source-note">Trail pins may mark a route center rather than a trailhead. Difficulty describes mapped terrain, not current conditions or a safety assessment.</p>' : ""}</section></div><section class="content-section"><div class="section-heading"><div><h2>Traveler photos & tips</h2><p>Stories from this exact place. Ask a question in the comments.</p></div><button class="primary-button" data-action="place-photo">Add your photo</button></div><div id="place-stories" class="picks-grid" aria-live="polite"><p>Loading traveler stories…</p></div></section>`;
  }
  async function load(version) {
    const current = () => version === renderVersion && state.page === "place";
    try {
      const { place } = await api(`/api/place/${state.placeId}`);
      if (!current()) return;
      state.activePlace = place;
      for (const item of [...state.places, ...state.saved]) {
        if (item.id === place.id)
          Object.assign(item, {
            travelerPhoto: place.travelerPhoto,
            facts: place.facts,
          });
      }
      $("#main").innerHTML = details(place);
      // Place information and traveler stories do not wait on external photos.
      loadStories(version);
      if (!Object.hasOwn(state.placePhotos, place.id)) {
        const data = await api(`/api/photos?ids=${place.id}`).catch(() => ({
          photos: {},
        }));
        if (!current()) return;
        state.placePhotos[place.id] = data.photos[place.id] || null;
        const photo = $(".detail-photo-panel .place-photo");
        if (photo) photo.outerHTML = TriplyExplore.photoMarkup(place);
      }
    } catch (error) {
      if (current())
        $("#main").innerHTML =
          `${empty("This place couldn’t be loaded.", escapeHTML(error.message))}<a class="primary-button" href="#home">Find a place</a>`;
    }
  }
  async function loadStories(version) {
    try {
      const data = await api(`/api/posts?placeId=${state.placeId}`);
      if (version !== renderVersion || state.page !== "place") return;
      state.posts = data.posts;
      $("#place-stories").innerHTML = data.posts.length
        ? data.posts.map(postCard).join("")
        : empty(
            "Be the first to share this place.",
            "Add your own photo and a useful tip for the next traveler.",
            "place-photo",
            "Share a photo",
          );
    } catch (error) {
      if (version === renderVersion && $("#place-stories"))
        $("#place-stories").innerHTML =
          `<p>${escapeHTML(error.message)}</p><button class="text-link" data-action="retry-place-stories">Try again</button>`;
    }
  }
  document.addEventListener("change", (event) => {
    if (!event.target.matches("[data-place-facility], [data-place-filter]"))
      return;
    capture();
    state.placeFilters[state.category] = {
      facilities: [
        ...document.querySelectorAll("[data-place-facility]:checked"),
      ].map((input) => input.dataset.placeFacility),
      difficulty: $("[data-place-filter=difficulty]")?.value || "",
      maxLength: $("[data-place-filter=maxLength]")?.value || "",
    };
    render();
  });
  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "photo-story" && state.page === "place") {
      event.preventDefault();
      $("#place-stories")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (action === "clear-place-filters") {
      capture();
      state.placeFilters[state.category] = {};
      state.admission = "any";
      render();
    }
    if (action === "retry-place-stories") loadStories(renderVersion);
  });
  return { filters, load, loadStories };
})();
