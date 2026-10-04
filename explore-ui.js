"use strict";
window.TriplyExplore = (() => {
  let map,
    markers = new Map(),
    timer,
    suggestionVersion = 0,
    suggestions = [],
    selectedIndex = -1;
  const visiblePlaces = () =>
    TriplyFilters.places(state.places, state.admission);
  function searchForm() {
    const flight = state.kind === "flights";
    return `<form id="global-search" class="global-search enhanced-search"><div class="search-tabs">${[
      ["explore", "globe", "Places to go"],
      ["flights", "plane", "Flights"],
      ["stays", "stays", "Stays"],
      ["cars", "cars", "Cars"],
    ]
      .map(
        ([kind, ic, label]) =>
          `<button type="button" class="search-tab ${state.kind === kind ? "active" : ""}" data-action="kind" data-kind="${kind}" aria-pressed="${state.kind === kind}">${icon(ic)}${label}</button>`,
      )
      .join("")}</div>
    <div class="destination-row"><label class="destination-field"><span>${flight ? "FLYING TO · CITY OR IATA" : "WHERE TO? · COUNTRY, STATE, OR CITY"}</span><input id="destination-input" name="${flight ? "destination" : "location"}" aria-label="${flight ? "Flying to" : "Destination"}" ${flight ? "" : 'role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="destination-suggestions"'} value="${escapeHTML(flight ? state.destination : state.location)}" autocomplete="off" placeholder="${flight ? "City or airport code" : "Try Nepal, California, or Paris"}" minlength="2" maxlength="100" required>${flight ? "" : '<div id="destination-suggestions" class="destination-suggestions" role="listbox" aria-label="Destination suggestions" hidden></div>'}</label>${flight ? `<label><span>FLYING FROM · CITY OR IATA</span><input name="origin" aria-label="Flying from" value="${escapeHTML(state.origin)}" minlength="2" maxlength="80" required></label>` : ""}<button type="submit" class="primary-button search-submit" ${state.loading ? "disabled" : ""}>${icon("search")}${state.loading ? "Searching…" : state.kind === "explore" ? "Find places" : "Compare providers"}</button></div>
    <div class="trip-options"><label><span>${flight ? "DEPARTURE · ONE WAY" : "START DATE"}</span><input name="start" aria-label="Start date" type="date" value="${state.start}" min="${future(0)}" required></label>${flight ? "" : `<label><span>END DATE</span><input name="end" aria-label="End date" type="date" value="${state.end}" min="${state.start}" required></label>`}<label><span>TRAVELERS</span><select name="adults" aria-label="Travelers">${Array.from({ length: 9 }, (_, i) => `<option value="${i + 1}" ${state.adults === i + 1 ? "selected" : ""}>${i + 1} adult${i ? "s" : ""}</option>`).join("")}</select></label><label><span>${flight ? "MAX FLIGHT TOTAL" : "TRIP BUDGET"} · ${state.currency}</span><input type="number" name="budget" aria-label="${flight ? "Maximum flight total" : "Trip budget"}" min="1" max="10000000" step="any" placeholder="No limit" value="${escapeHTML(state.budget)}"></label>${state.kind === "explore" ? `<label><span>ENTRY FEES</span><select name="admission" aria-label="Entry fees"><option value="any" ${state.admission === "any" ? "selected" : ""}>Any entry fee</option><option value="free" ${state.admission === "free" ? "selected" : ""}>No entry fee listed</option></select></label>` : ""}</div>
    <div class="country-context">${destinationHint()}</div><p class="search-scope">${flight ? "Budget filters the returned flight total for all selected adults." : state.kind === "explore" ? "Dates and budget plan your trip. Places are filtered by listed entry fees; opening hours and other costs need checking." : "Budget is a planning target. Confirm the full price and availability on the provider’s website."}</p><p id="search-error" class="search-error" role="alert"></p></form>`;
  }
  function fallback(category) {
    return (
      state.photoAssets[category] ||
      state.photoAssets[category === "views" ? "hiking" : "attractions"]
    );
  }
  function photoSearchURL(p) {
    return (
      "https://www.google.com/search?" +
      new URLSearchParams({
        tbm: "isch",
        q: [
          p.name,
          p.location || state.location,
          countryName(p.country || state.country),
        ]
          .filter(Boolean)
          .join(" "),
      })
    );
  }
  function photoMarkup(p, unavailable = false) {
    const photo = unavailable ? null : state.placePhotos[p.id];
    if (!photo)
      return `<div class="place-photo photo-empty" data-photo-id="${escapeHTML(p.id)}"><span>${icon("pin")}</span><strong>${unavailable || Object.hasOwn(state.placePhotos, p.id) || state.page !== "home" ? "Photo unavailable" : "Finding local photos…"}</strong><small>${escapeHTML(p.name)}</small><a href="${escapeHTML(photoSearchURL(p))}" target="_blank" rel="noopener noreferrer">See photos on Google ↗</a></div>`;
    const label =
      photo.kind === "nearby"
        ? "Nearby photo · " + photo.distanceMeters + " m"
        : "Place photo";
    return `<div class="place-photo" data-photo-id="${escapeHTML(p.id)}"><img src="${escapeHTML(photo.url)}" alt="${escapeHTML(photo.kind === "nearby" ? photo.title + " — taken near " + p.name : p.name)}" loading="lazy" decoding="async"><span class="photo-kind">${label}</span><a class="photo-credit" href="${escapeHTML(photo.source)}" target="_blank" rel="noopener noreferrer">${escapeHTML(photo.credit)} · ${escapeHTML(photo.license)} · cropped</a></div>`;
  }
  function placeCard(p, index) {
    const saved = state.saved.some((x) => x.id === p.id);
    return `<article class="place-card photo-place-card" id="card-${escapeHTML(p.id)}">${photoMarkup(p)}<button class="save-button ${saved ? "saved" : ""}" data-action="save-place" data-id="${escapeHTML(p.id)}" aria-label="${saved ? "Unsave" : "Save"} ${escapeHTML(p.name)}">${icon("heart")}</button><div class="place-body"><span class="place-category">${Number.isInteger(index) ? `<span class="place-number">${index + 1}</span>` : ""}${categoryName(p.category)}${Number.isFinite(p.distanceKm) ? ` · ${p.distanceKm} km away` : ""}</span><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(destinationLabel(p.location || state.location, p.country || state.country))}</p><span class="place-fee">${escapeHTML(p.fee || "Check access & fees")}</span><div class="place-actions"><a class="text-link" href="${escapeHTML(photoSearchURL(p))}" target="_blank" rel="noopener noreferrer">Photos on Google ↗</a><button class="text-link" data-action="map-place" data-id="${escapeHTML(p.id)}">${icon("pin")}View on map</button><button class="text-link" data-action="nearby" data-location="${escapeHTML(p.location || state.location)}" data-country="${escapeHTML(p.country || state.country)}">Plan a visit →</button></div></div></article>`;
  }
  function discover() {
    const places = visiblePlaces();
    const introHTML = intro(
      state.searchDone
        ? "A little closer to your next adventure."
        : "Find your next somewhere.",
      state.searchDone
        ? "Places, photos, and a map. Find the ones that feel like you."
        : "A great view. A better deal. Someone to share it with.",
    );
    if (state.searchDone && state.area && !state.loading) {
      const area = state.area;
      return (
        introHTML +
        searchForm() +
        categoryFilters() +
        `<section class="content-section results-area"><div class="section-heading"><div><h2>Explore ${escapeHTML(area.destination.name)}</h2><p>Choose a city to find ${escapeHTML(categoryName(state.category).toLowerCase())} nearby.</p></div></div><p class="area-guidance">${escapeHTML(area.destination.name)} covers a wide area. Start with one of these cities, or search for a specific town. Your trip dates, budget, and entry-fee filter carry into the local search.</p><div class="area-cities">${area.destinations.map((city) => `<article class="area-city"><span class="area-city-icon">${icon("pin")}</span><div><h3>${escapeHTML(city.name)}</h3><p>${escapeHTML(city.label)}</p></div><button class="primary-button" data-action="browse-city" data-id="${escapeHTML(city.id)}">Explore ${escapeHTML(city.name)} →</button><a class="text-link" href="${escapeHTML(photoSearchURL({ ...city, location: city.label }))}" target="_blank" rel="noopener noreferrer">Photos on Google ↗</a></article>`).join("")}</div>${area.destinations.length ? `<p class="source-note">Showing ${area.destinations.length} larger cities from ${area.cityCount} cities in the destination catalog. Choose a city to load mapped places and photos; these are starting points, not a complete list of attractions. Destination data © GeoNames, CC BY 4.0.</p>` : empty("Search a town or landmark.", "This area has no city entries in the current catalog. Enter a more specific destination above.")}</section>`
      );
    }
    const hero = state.searchDone
      ? ""
      : `<section class="hero global-hero explore-hero"><img src="${images.hero}" alt="Mountains and an open valley"><div class="hero-content"><div class="hero-tag">LESS SCROLLING. MORE GOING.</div><h2>Good places.<br><em>Better company.</em></h2><p>Find the trail. Compare the flight.<br>Meet the people who make the trip.</p></div></section>`;
    const results = state.searchDone
      ? `<section class="content-section results-area"><div class="section-heading"><div><h2>${categoryName(state.category)} near ${escapeHTML(state.location)}</h2><p>${state.loading ? "Looking for places…" : state.placesError ? "Places could not be loaded" : `${places.length} places${state.admission === "free" ? " with no entry fee listed" : ""} · within 20 km of the mapped center`}</p></div><div class="mobile-view-switch"><button class="${state.mapView === "list" ? "active" : ""}" data-explore-view="list">${icon("globe")}List</button><button class="${state.mapView === "map" ? "active" : ""}" data-explore-view="map">${icon("pin")}Map</button></div></div><div class="trip-summary"><span>${escapeHTML(state.start)} → ${escapeHTML(state.end)}</span><span>${state.adults} traveler${state.adults === 1 ? "" : "s"}</span>${state.budget ? `<span>Trip budget ${money(Number(state.budget), state.currency)}</span>` : ""}<button data-action="kind" data-kind="stays" class="text-link">Find a stay for these dates →</button></div>${state.placesError ? empty("We couldn’t load places right now.", escapeHTML(state.placesError), "search-again", "Try again") : state.loading ? '<div class="loading-state">Finding places worth the trip…</div>' : `<div class="discovery-layout" data-view="${state.mapView}"><div class="places-grid">${places.length ? places.map(placeCard).join("") : empty(state.admission === "free" ? "No places match the free-entry filter." : "No mapped places found nearby.", state.admission === "free" ? "Select any entry fee to include places with unknown costs." : "Try a nearby town, landmark, or another category. Map coverage varies by location.")}</div><aside class="map-panel"><div class="map-heading"><strong>Your next adventure, mapped.</strong><span>Tap a pin to explore</span></div><div id="places-map" aria-label="Map of discovered places"></div><p class="map-help" id="map-help">Pins match the numbered place cards. Trail pins show approximate centers.</p></aside></div>`}<p class="source-note">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>. Entry-fee tags do not include transport, equipment, permits, or accommodation. ${state.center ? `Search center: ${escapeHTML(state.center.name)}.` : ""} Photos come from public Wikimedia contributions. “Place photo” uses an explicit place reference; “Nearby photo” was geotagged within 150 m and may show the surrounding area.</p></section>`
      : `<section class="content-section"><div class="section-heading"><div><h2>What’s your kind of escape?</h2><p>Pick a place. We’ll help you find what’s around it.</p></div></div><div class="destinations-grid">${inspiration.map((p, i) => `<button class="destination-card" data-action="inspiration" data-index="${i}"><img src="${p.image}" alt="${categoryName(p.category)} inspiration"><span class="destination-tag">${p.label}</span><div class="destination-copy"><h3>${p.name}</h3><p>${countryName(p.country)} · ${categoryName(p.category)}</p><span class="destination-arrow">↗</span></div></button>`).join("")}</div></section>`;
    return introHTML + hero + searchForm() + categoryFilters() + results;
  }
  function dispose() {
    if (map) {
      map.remove();
      map = null;
    }
    markers.clear();
    clearTimeout(timer);
    suggestionVersion++;
    suggestions = [];
    selectedIndex = -1;
  }
  function mountMap() {
    const el = $("#places-map");
    if (!el || !state.center || !window.L) return;
    map = L.map(el, { scrollWheelZoom: false }).setView(
      [state.center.lat, state.center.lon],
      12,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    })
      .on("tileerror", () => {
        if ($("#map-help"))
          $("#map-help").textContent =
            "Map tiles are temporarily unavailable. Place pins and map links still work.";
      })
      .addTo(map);
    const points = [];
    visiblePlaces().forEach((p, index) => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return;
      const pin = L.marker([p.lat, p.lon], {
        icon: L.divIcon({
          className: "triply-pin",
          html: `<span>${index + 1}</span>`,
          iconSize: [30, 36],
          iconAnchor: [15, 36],
        }),
        title: p.name,
      });
      pin.bindPopup(
        () =>
          `<div class="map-popup">${photoMarkup(p)}<strong>${escapeHTML(p.name)}</strong><p>${escapeHTML(p.fee)}</p><a href="${escapeHTML(p.url)}" target="_blank" rel="noopener noreferrer">Open full map ↗</a></div>`,
        { maxWidth: 240 },
      );
      pin.on("click", () => {
        document
          .querySelectorAll(".photo-place-card.is-selected")
          .forEach((c) => c.classList.remove("is-selected"));
        document.getElementById("card-" + p.id)?.classList.add("is-selected");
      });
      pin.addTo(map);
      markers.set(p.id, pin);
      points.push([p.lat, p.lon]);
    });
    if (points.length)
      map.fitBounds(points, { padding: [25, 25], maxZoom: 14 });
    requestAnimationFrame(() => map?.invalidateSize());
  }
  async function loadPhotos(version) {
    // Small batches reveal pictures progressively and keep source traffic bounded.
    const items = [...state.places];
    for (let offset = 0; offset < items.length; offset += 7) {
      if (version !== renderVersion) return;
      const batch = items.slice(offset, offset + 7);
      try {
        const data = await api(
          "/api/photos?" +
            new URLSearchParams({ ids: batch.map((p) => p.id).join(",") }),
        );
        for (const p of batch)
          state.placePhotos[p.id] = data.photos[p.id] || null;
      } catch {
        for (const p of batch)
          if (!state.placePhotos[p.id]) state.placePhotos[p.id] = null;
      }
      if (version !== renderVersion) return;
      for (const p of batch)
        document
          .querySelectorAll(`[data-photo-id="${p.id}"]`)
          .forEach((node) => {
            node.outerHTML = photoMarkup(p);
          });
    }
  }
  function closeSuggestions() {
    const box = $("#destination-suggestions");
    if (box) box.hidden = true;
    const input = $("#destination-input");
    input?.setAttribute("aria-expanded", "false");
    input?.removeAttribute("aria-activedescendant");
    selectedIndex = -1;
  }
  function choose(item) {
    state.location = item.label;
    state.country = item.country;
    state.selectedDestination = item;
    state.searchDone = false;
    state.center = null;
    const input = $("#destination-input");
    input.value = item.label;
    $(".country-context").innerHTML = destinationHint();
    closeSuggestions();
    input.focus();
  }
  function markSuggestion() {
    document
      .querySelectorAll(".destination-option")
      .forEach((el, i) =>
        el.setAttribute("aria-selected", String(i === selectedIndex)),
      );
    $("#destination-input")?.setAttribute(
      "aria-activedescendant",
      "suggestion-" + selectedIndex,
    );
  }
  document.addEventListener("input", (event) => {
    if (
      event.target.id !== "destination-input" ||
      event.target.name !== "location"
    )
      return;
    state.selectedDestination = null;
    clearTimeout(timer);
    const version = ++suggestionVersion,
      query = event.target.value.trim();
    if (query.length < 2) {
      closeSuggestions();
      return;
    }
    timer = setTimeout(async () => {
      try {
        const data = await api(
          "/api/destinations?q=" + encodeURIComponent(query),
        );
        if (version !== suggestionVersion || !$("#destination-suggestions"))
          return;
        suggestions = data.destinations;
        selectedIndex = -1;
        const box = $("#destination-suggestions");
        box.innerHTML = suggestions.length
          ? suggestions
              .map(
                (item, i) =>
                  `<button type="button" role="option" aria-selected="false" id="suggestion-${i}" class="destination-option" data-suggestion-index="${i}"><span class="suggestion-icon">${icon(item.kind === "City" ? "pin" : "globe")}</span><span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.label)}</small></span><em>${item.kind}</em></button>`,
              )
              .join("")
          : "<p>No suggestion found. You can still search this destination.</p>";
        box.hidden = false;
        $("#destination-input").setAttribute("aria-expanded", "true");
      } catch {
        closeSuggestions();
      }
    }, 180);
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.target.id !== "destination-input" ||
      $("#destination-suggestions")?.hidden !== false
    )
      return;
    if (event.key === "Escape") {
      closeSuggestions();
      return;
    }
    if (
      suggestions.length &&
      (event.key === "ArrowDown" || event.key === "ArrowUp")
    ) {
      event.preventDefault();
      selectedIndex =
        (selectedIndex +
          (event.key === "ArrowDown" ? 1 : -1) +
          suggestions.length) %
        suggestions.length;
      markSuggestion();
    }
    if (event.key === "Enter" && suggestions[selectedIndex]) {
      event.preventDefault();
      choose(suggestions[selectedIndex]);
    }
  });
  document.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-suggestion-index]");
    if (choice) {
      choose(suggestions[Number(choice.dataset.suggestionIndex)]);
      return;
    }
    if (!event.target.closest(".destination-field")) closeSuggestions();
    const view = event.target.closest("[data-explore-view]");
    if (view) {
      state.mapView = view.dataset.exploreView;
      document
        .querySelector(".discovery-layout")
        ?.setAttribute("data-view", state.mapView);
      document
        .querySelectorAll("[data-explore-view]")
        .forEach((b) =>
          b.classList.toggle("active", b.dataset.exploreView === state.mapView),
        );
      map?.invalidateSize();
    }
    const show = event.target.closest('[data-action="map-place"]');
    if (show) {
      const pin = markers.get(show.dataset.id);
      if (pin) {
        state.mapView = "map";
        document
          .querySelector(".discovery-layout")
          ?.setAttribute("data-view", "map");
        document
          .querySelectorAll("[data-explore-view]")
          .forEach((b) =>
            b.classList.toggle("active", b.dataset.exploreView === "map"),
          );
        map.invalidateSize();
        map.setView(pin.getLatLng(), 15);
        pin.openPopup();
        $("#places-map").scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      } else {
        const p = state.saved.find((p) => p.id === show.dataset.id);
        if (p) window.open(p.url, "_blank", "noopener,noreferrer");
      }
    }
  });
  document.addEventListener(
    "error",
    (event) => {
      const img = event.target;
      if (img.tagName !== "IMG" || !img.closest(".place-photo")) return;
      const node = img.closest(".place-photo"),
        p = [...state.places, ...state.saved].find(
          (p) => p.id === node.dataset.photoId,
        );
      if (p) {
        state.placePhotos[p.id] = null;
        node.outerHTML = photoMarkup(p, true);
      } else {
        img.hidden = true;
        node.querySelector(".photo-kind").textContent = "Photo unavailable";
      }
    },
    true,
  );
  function providerPhoto(kind) {
    const p = fallback(kind);
    return p
      ? `<img class="provider-photo" src="${escapeHTML(p.url)}" alt="${escapeHTML(p.alt)} — travel inspiration" loading="lazy"><p class="provider-photo-credit">Travel inspiration · <a href="${escapeHTML(p.source)}" target="_blank" rel="noopener noreferrer">${escapeHTML(p.credit)} · ${escapeHTML(p.license)}</a></p>`
      : "";
  }
  return {
    searchForm,
    placeCard,
    discover,
    dispose,
    mountMap,
    loadPhotos,
    providerPhoto,
  };
})();
