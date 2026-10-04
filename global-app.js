"use strict";
const $ = (s) => document.querySelector(s);
const escapeHTML = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icons = {
  plane: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="m22 2-11 11"/>',
  home: '<path d="m3 10 9-7 9 7v11H3Z"/><path d="M9 21v-8h6v8"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  heart: '<path d="M12 21 3 12a5.5 5.5 0 0 1 9-6 5.5 5.5 0 0 1 9 6Z"/>',
  chat: '<path d="M3 3h18v14H8l-5 4Z"/><path d="M7 8h10M7 12h6"/>',
  users:
    '<circle cx="8" cy="7" r="3"/><path d="M2 21v-3a6 6 0 0 1 12 0v3m3-17a3 3 0 0 1 0 6m2 11v-3a5 5 0 0 0-2-4"/>',
  tag: '<path d="M3 3h9l10 10-9 9L3 12Z"/><circle cx="8" cy="8" r="1"/>',
  moon: '<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',
  sparkles: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>',
  camping: '<path d="m12 3-10 18h20ZM8 21l4-8 4 8M10 3l4 3"/>',
  hiking: '<path d="m2 21 8-16 5 9 3-5 4 12ZM7 11l3 2 3-2"/>',
  views: '<path d="M2 17q10-14 20 0M2 21h20"/><circle cx="12" cy="8" r="3"/>',
  beaches: '<path d="M12 3v18M3 12a9 9 0 0 1 18 0ZM6 21h12"/>',
  attractions: '<path d="m3 8 9-5 9 5ZM5 10v9m7-9v9m7-9v9M2 22h20"/>',
  stays: '<path d="M3 21V3h18v18M8 21v-5h8v5M7 7h2m6 0h2M7 11h2m6 0h2"/>',
  cars: '<path d="m5 5-3 7v8h4v-3h12v3h4v-8l-3-7ZM2 12h20M6 15h2m8 0h2"/>',
  camera:
    '<rect x="2" y="6" width="20" height="15" rx="3"/><path d="m7 6 2-3h6l2 3"/><circle cx="12" cy="13" r="4"/>',
  check: '<path d="m4 12 5 5L20 5"/>',
};
const icon = (n) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[n] || icons.globe}</svg>`;
const photo = (id, w = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=85`;
const images = {
  hero: photo("photo-1464822759023-fed622ff2c3b", 1800),
  camping: photo("photo-1478131143081-fd1d83f3e7d7"),
  hiking: photo("photo-1551632811-561732d1e306"),
  views: photo("photo-1464822759023-fed622ff2c3b"),
  beaches: photo("photo-1512343879784-a960bf40e7f2"),
  attractions: photo("photo-1493976040374-85c8e12f0c0e"),
  stays: photo("photo-1566073771259-6a8506099945"),
};
const inspiration = [
  {
    name: "Pokhara",
    country: "NP",
    category: "hiking",
    label: "FOLLOW THE MOUNTAINS",
    image: photo("photo-1544735716-392fe2489ffa"),
  },
  {
    name: "Interlaken",
    country: "CH",
    category: "camping",
    label: "SLEEP UNDER THE STARS",
    image: images.camping,
  },
  {
    name: "Kyoto",
    country: "JP",
    category: "attractions",
    label: "TAKE THE LONG WAY",
    image: images.attractions,
  },
  {
    name: "Goa",
    country: "IN",
    category: "beaches",
    label: "A LITTLE SEA AIR",
    image: images.beaches,
  },
];
function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function store(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function future(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const state = {
  page: "home",
  country: "NP",
  location: "Pokhara, Nepal",
  kind: "explore",
  category: "all",
  budget: "",
  admission: "any",
  selectedDestination: null,
  mapView: "list",
  photoAssets: {},
  placePhotos: {},
  origin: "KTM",
  destination: "DEL",
  start: future(14),
  end: future(17),
  adults: 2,
  residence: "",
  driverAge: 30,
  pickupTime: "10:00",
  dropoffTime: "10:00",
  currency: read("triply-currency", "USD"),
  user: null,
  countries: [],
  currencies: [],
  posts: [],
  places: [],
  saved: [],
  chat: null,
  chatData: null,
  searchDone: false,
  placesError: "",
  priceData: null,
  loading: false,
};
let searchVersion = 0,
  renderVersion = 0,
  toastTimer,
  chatTimer,
  replyId = null,
  activePost = null;
async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok || data.error) throw Error(data.error || "Request failed");
  return data;
}
const countryName = (code) =>
  state.countries.find((c) => c.code === code)?.name || code;
const categoryName = (code) =>
  ({
    all: "All places",
    camping: "Camping",
    hiking: "Hiking",
    views: "Viewpoints",
    beaches: "Beaches",
    attractions: "Culture & sights",
    stays: "Stays",
    food: "Food",
  })[code] || escapeHTML(code);
const countryOptions = (selected = state.country || "NP") =>
  state.countries
    .map(
      (c) =>
        `<option value="${c.code}" ${selected === c.code ? "selected" : ""}>${escapeHTML(c.name)}</option>`,
    )
    .join("");
const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });
const currencyOptions = (selected = state.currency) =>
  state.currencies
    .map(
      (c) =>
        `<option value="${c}" ${selected === c ? "selected" : ""}>${c} · ${escapeHTML(currencyNames.of(c))}</option>`,
    )
    .join("");
const money = (value, currency) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4000);
}
function header() {
  document
    .querySelectorAll("[data-icon]")
    .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
  $("#main-nav").innerHTML = [
    ["home", "globe", "Discover"],
    ["deals", "tag", "Travel deals"],
    ["community", "users", "Community"],
    ["messages", "chat", "Messages"],
    ["saved", "heart", "Saved places"],
  ]
    .map(
      ([page, ic, label]) =>
        `<a class="nav-link ${page === state.page ? "active" : ""}" href="#${page}" ${page === state.page ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></a>`,
    )
    .join("");
  $("#profile-button").textContent = state.user
    ? state.user.name.split(" ")[0]
    : "Sign in";
  $("#currency").innerHTML = currencyOptions();
}
function modal(title, subtitle, body) {
  $("#modal").innerHTML =
    `<div class="modal-header"><div><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div><button data-action="close" class="close-button" aria-label="Close dialog">×</button></div><div class="modal-body">${body}</div>`;
  if (!$("#modal").open) $("#modal").showModal();
}
function empty(title, description, action, label) {
  return `<div class="empty-state">${icon("globe")}<h2>${title}</h2><p>${description}</p>${action ? `<button class="primary-button" data-action="${action}">${label}</button>` : ""}</div>`;
}
function intro(title, description, right = "") {
  return `<div class="page-intro"><div><h1>${title}</h1><p>${description}</p></div>${right}</div>`;
}
function navigate(page) {
  location.hash = page;
  if (state.page === page) render();
}
function capture() {
  const form = $("#global-search");
  if (!form) return;
  const b = new FormData(form);
  if (
    b.has("location") &&
    String(b.get("location")).trim() !== state.location
  ) {
    state.selectedDestination = null;
    state.country = "";
    state.center = null;
    state.searchDone = false;
  }
  for (const key of [
    "country",
    "location",
    "origin",
    "destination",
    "start",
    "end",
    "budget",
    "admission",
    "residence",
    "driverAge",
    "pickupTime",
    "dropoffTime",
  ])
    if (b.has(key)) state[key] = String(b.get(key)).trim();
  if (b.has("adults")) state.adults = Number(b.get("adults"));
}
function destinationHint() {
  const country = state.countries.find((c) => c.code === state.country);
  return (
    icon("globe") +
    "Search worldwide · Country, state, or city" +
    (state.kind !== "flights" && country
      ? " <span>·</span> " +
        escapeHTML(country.name) +
        ": " +
        country.currencies.map((c) => c.code).join(", ") +
        ' <button type="button" data-action="local-currency">Use local currency</button>'
      : "")
  );
}
function searchForm() {
  return TriplyExplore.searchForm();
}
function categoryFilters() {
  return `<div class="category-bar">${["all", "camping", "hiking", "views", "beaches", "attractions"].map((c) => `<button class="category-pill ${state.category === c ? "active" : ""}" data-action="category" data-category="${c}" aria-pressed="${state.category === c}">${icon(c === "all" ? "globe" : c)}${categoryName(c)}</button>`).join("")}</div>`;
}
function destinationLabel(location, country) {
  const name = countryName(country || "");
  return name && !location.toLowerCase().includes(name.toLowerCase())
    ? `${location}, ${name}`
    : location;
}
function placeCard(p, index) {
  return TriplyExplore.placeCard(p, index);
}
function mapsURL(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
function discover() {
  return TriplyExplore.discover();
}
function providerLinks() {
  const place = state.location,
    q = new URLSearchParams({
      ss: place,
      checkin: state.start,
      checkout: state.end,
      group_adults: state.adults,
      no_rooms: 1,
      selected_currency: state.currency,
    });
  if (state.kind === "stays")
    return [
      {
        name: "Booking.com",
        subtitle: "Hotels, guesthouses & apartments",
        url: `https://www.booking.com/searchresults.html?${q}`,
        detail: "Destination, dates, guests, and preferred currency included.",
      },
      {
        name: "Expedia",
        subtitle: "Compare another booking provider",
        url: `https://www.expedia.com/Hotel-Search?${new URLSearchParams({ destination: place, startDate: state.start, endDate: state.end, adults: state.adults })}`,
        detail: "Recheck dates, taxes, and cancellation terms on arrival.",
      },
      {
        name: "Google Hotels",
        subtitle: "Explore rates across booking sites",
        url: `https://www.google.com/travel/hotels?${new URLSearchParams({ q: `hotels in ${place}`, curr: state.currency })}`,
        detail: "Select your dates and compare the total stay price.",
      },
      {
        name: "Agoda",
        subtitle: "Hotels, apartments & vacation stays",
        url: "https://www.agoda.com/",
        detail:
          "Enter your destination, dates, and guests. Compare the full total, including taxes.",
      },
      {
        name: "Hotels.com",
        subtitle: "Compare rooms and member rates",
        url: "https://www.hotels.com/",
        detail:
          "Enter your trip details. Check whether discounts require signing in and match cancellation terms.",
      },
    ];
  if (state.kind === "flights")
    return [
      {
        name: "Google Flights",
        subtitle: "Compare airlines and booking sites",
        url: `https://www.google.com/travel/flights?${new URLSearchParams({ q: `one way flights from ${state.origin} to ${state.destination} on ${state.start} for ${state.adults} adults`, curr: state.currency })}`,
        detail: "Check that your route, date, and traveler count were applied.",
      },
      {
        name: "Expedia",
        subtitle: "Airline tickets & flight options",
        url: "https://www.expedia.com/Flights",
        detail: "Enter the route and departure date shown above.",
      },
      {
        name: "KAYAK",
        subtitle: "Compare another flight search",
        url:
          /^[A-Z]{3}$/i.test(state.origin) &&
          /^[A-Z]{3}$/i.test(state.destination)
            ? `https://www.kayak.com/flights/${state.origin.toUpperCase()}-${state.destination.toUpperCase()}/${state.start}?adults=${state.adults}&currency=${state.currency}`
            : "https://www.kayak.com/flights",
        detail: "Review baggage, stops, and the final price.",
      },
      {
        name: "Skyscanner",
        subtitle: "Search airlines and travel agencies",
        url: "https://www.skyscanner.com/",
        detail:
          "Choose one way and enter your route, date, and adults. Check baggage and the booking seller.",
      },
      {
        name: "Trip.com",
        subtitle: "Compare another flight booking site",
        url: "https://www.trip.com/flights/",
        detail:
          "Enter your route and date. Compare the same flights, baggage allowance, and refund rules.",
      },
    ];
  return [
    {
      name: "Rentalcars.com",
      subtitle: "Compare rental companies",
      url: "https://www.rentalcars.com/",
      detail: `Enter ${place} and your pickup/drop-off dates.`,
    },
    {
      name: "DiscoverCars",
      subtitle: "Compare local & international rentals",
      url: "https://www.discovercars.com/",
      detail: "Compare deposits, mileage, and insurance as well as price.",
    },
    {
      name: "Expedia Cars",
      subtitle: "Find another rental option",
      url: "https://www.expedia.com/Cars",
      detail: "Select your city, dates, pickup times, and driver details.",
    },
    {
      name: "Skyscanner Cars",
      subtitle: "Search across rental providers",
      url: "https://www.skyscanner.com/car-rental",
      detail:
        "Enter your pickup location and local times. Compare the same car category, mileage, and insurance.",
    },
    {
      name: "Auto Europe",
      subtitle: "Compare international car rentals",
      url: "https://www.autoeurope.com/",
      detail:
        "Enter your dates and driver age. Check the rental total, deposit, and pickup location.",
    },
  ];
}
function comparisonTripDetails() {
  const lines =
    state.kind === "flights"
      ? [
          `One-way flight: ${state.origin} → ${state.destination}`,
          `Departure: ${state.start}`,
          "Cabin: Economy",
        ]
      : state.kind === "stays"
        ? [
            `Stay: ${state.location}`,
            `Check-in: ${state.start}`,
            `Check-out: ${state.end}`,
            "Rooms: 1",
          ]
        : [
            `Car rental: ${state.location}`,
            "Pickup and return at the same location",
            `Pickup: ${state.start} ${state.pickupTime} (local time)`,
            `Return: ${state.end} ${state.dropoffTime} (local time)`,
            `Driver age: ${state.driverAge}`,
          ];
  lines.push(`Adults: ${state.adults}`, `Currency: ${state.currency}`);
  if (state.kind !== "flights" && state.residence)
    lines.push(`Country of residence: ${countryName(state.residence)}`);
  if (state.budget)
    lines.push(`Maximum total: ${state.budget} ${state.currency}`);
  return lines.join("\n");
}
function updateComparisonLinks() {
  const links = document.querySelectorAll("[data-provider-index]");
  if (!links.length) return;
  capture();
  const providers = providerLinks();
  links.forEach((link) => {
    const provider = providers[Number(link.dataset.providerIndex)];
    if (provider) link.href = provider.url;
  });
}
function pricingResults() {
  const data = state.priceData;
  const provider = state.kind === "flights" ? "Duffel" : "Booking.com";
  const connected =
    state.kind === "flights"
      ? state.pricing.configured
      : state.pricing.bookingConfigured;
  if (!data)
    return `<section id="live-pricing" class="live-pricing" aria-live="polite"><h3>${state.kind === "flights" ? "Flight" : state.kind === "cars" ? "Rental car" : "Stay"} prices · ${provider}</h3><p>${state.loading ? "Checking prices for your trip…" : connected ? "Search to compare returned prices." : "Pricing is not connected yet. Use the booking websites below while account access is set up."}</p></section>`;
  const available = (data.offers || []).filter(
    (o) => !o.expiresAt || Date.parse(o.expiresAt) > Date.now(),
  );
  const offers = TriplyFilters.offers(available, state.budget, state.currency);
  return `<section id="live-pricing" class="live-pricing" aria-live="polite"><div class="section-heading"><h3>${escapeHTML(data.provider || provider)} prices</h3><span class="price-mode ${data.status === "live" ? "is-live" : ""}">${data.status === "sandbox" ? "TEST DATA" : data.status === "live" ? "LIVE SEARCH" : "CONNECTION STATUS"}</span></div><p>${escapeHTML(data.message || "Prices could not be loaded.")}</p>${data.checkedAt ? `<p class="source-note">Checked ${escapeHTML(new Date(data.checkedAt).toLocaleString())} · sorted by total in ${escapeHTML(state.currency)}${state.budget ? ` · maximum ${money(Number(state.budget), state.currency)}` : ""}</p>` : ""}${offers.length ? `<div class="price-offers">${offers.map((o, i) => `<article class="price-offer">${o.image ? `<img class="offer-image" src="${escapeHTML(o.image)}" alt="${escapeHTML(o.name)} · Booking.com property photo" loading="lazy">` : ""}<div class="offer-description"><h4>${escapeHTML(o.name)}</h4>${(o.details || []).map((d) => `<p>${escapeHTML(d)}</p>`).join("")}<small>${escapeHTML(o.terms || "")}</small>${o.expiresAt ? `<p class="source-note">Offer expires ${escapeHTML(new Date(o.expiresAt).toLocaleTimeString())}. Search again before making plans.</p>` : ""}</div><div class="offer-price"><strong>${money(o.total, o.currency)}</strong><small>${data.status === "sandbox" ? "Test total" : i === 0 ? "Lowest returned total" : "Total for this search"}</small>${o.url && data.status === "live" ? `<a class="primary-button" href="${escapeHTML(o.url)}" target="_blank" rel="noopener noreferrer">View offer ↗</a>` : `<span class="source-note">${data.status === "sandbox" ? "Test offer · no live booking" : "Compare booking sites below"}</span>`}</div></article>`).join("")}</div>` : ["live", "sandbox"].includes(data.status) ? `<div class="notice">${available.length && state.budget ? "No returned offers fit this budget. Increase the maximum total and search again." : "No current offers returned in this currency. Try other dates or a currency supported by the provider."}</div>` : ""}</section>`;
}
function dealResults() {
  return `${intro("A good trip starts with a good deal.", "Compare the journey, the stay, and the little details.")} ${searchForm()}<section class="content-section"><div class="section-heading"><div><h2>${state.kind === "flights" ? `${escapeHTML(state.origin)} → ${escapeHTML(state.destination)}` : `${state.kind === "cars" ? "Car rentals" : "Places to stay"} in ${escapeHTML(state.location)}`}</h2><p>${state.start}${state.kind === "flights" ? "" : ` → ${state.end}`} · ${state.adults} travelers · ${state.currency}</p></div><button class="text-link" data-action="convert">Compare currencies ↗</button></div>${pricingResults()}<div class="comparison-note">${icon("check")}<div><h3>Compare on ${providerLinks().length} booking websites</h3><p>Prices are shown on each website. Use the same dates, travelers, inclusions, and cancellation terms to compare totals. Some sites need you to enter your trip details again.</p><button class="text-link" data-action="copy-trip">Copy trip details ↗</button></div></div><div class="provider-grid">${providerLinks()
    .map(
      (p, i) =>
        `<article class="provider-card">${TriplyExplore.providerPhoto(state.kind)}<span class="provider-number">0${i + 1}</span><div class="provider-wordmark">${p.name}</div><h3>${p.subtitle}</h3><p>${escapeHTML(p.detail)}</p><span class="price-check-label">Price available on provider</span><a class="primary-button" data-provider-index="${i}" target="_blank" rel="noopener noreferrer" href="${escapeHTML(p.url)}">Compare on ${p.name} ↗</a></article>`,
    )
    .join(
      "",
    )}</div><p class="source-note">You book and pay on the provider’s website. Triply does not create reservations. Lowest returned total means lowest among this search’s returned offers, not every website or every available option.</p></section>`;
}

function postCard(p) {
  return `<article class="pick-card"><div class="pick-image"><img src="${p.image}" alt="${escapeHTML(p.location)} shared by ${escapeHTML(p.name)}" loading="lazy"><span class="verified-badge">${categoryName(p.category)} · Community photo</span></div><div class="pick-body"><div class="pick-author"><span class="small-avatar">${escapeHTML(p.name.slice(0, 2).toUpperCase())}</span><strong>${escapeHTML(p.name)}</strong><span>@${escapeHTML(p.handle)}</span></div><h3>${escapeHTML(p.location)}, ${escapeHTML(countryName(p.country))}</h3><p class="post-caption">${escapeHTML(p.caption)}</p><div class="pick-bottom"><button class="text-link" data-action="comments" data-id="${p.id}">${icon("chat")}${p.commentCount} comments</button><button class="text-link" data-action="nearby" data-country="${p.country}" data-location="${escapeHTML(p.location)}">Find deals →</button></div><div class="quick-questions"><button data-action="question" data-id="${p.id}" data-question="Where did you stay?">Where did you stay?</button><button data-action="question" data-id="${p.id}" data-question="How much was it?">How much was it?</button></div><button class="report-link" data-action="report" data-id="${p.id}">Report post</button></div></article>`;
}
function community() {
  return `${intro("Every place has a story. Share yours.", "Camping, city breaks, trails, and the people along the way.", `<button class="primary-button" data-action="create-post">${icon("camera")}Share a photo</button>`)}<div class="community-strip"><div>${icon("users")}<strong>New places. New friends.</strong><span>Join the conversation, then say hello.</span></div><a href="#messages" class="text-link">Find travelers →</a></div><div id="community-results" class="picks-grid"><div class="loading-state">Loading traveler stories…</div></div>`;
}
async function loadPosts(version) {
  try {
    const data = await api("/api/posts");
    if (version !== renderVersion) return;
    state.posts = data.posts;
    $("#community-results").innerHTML = data.posts.length
      ? data.posts.map(postCard).join("")
      : empty(
          "Be the first to share a little adventure.",
          "Post a photo from a campsite, hike, viewpoint, or any place you loved.",
          "create-post",
          "Share your first photo",
        );
  } catch (error) {
    if (version === renderVersion)
      $("#community-results").innerHTML = empty(
        "We couldn’t load the feed.",
        escapeHTML(error.message),
      );
  }
}
function savedPage() {
  return `${intro("For your someday-soon list.", "Places worth keeping close.")}<div id="saved-results" class="places-grid">${state.user ? (state.saved.length ? state.saved.map(placeCard).join("") : empty("Your next adventure belongs here.", "Save places from discovery to find them again.")) : empty("Keep your discoveries together.", "Sign in to save places to your account.", "account", "Sign in")}</div>`;
}
function messagesPage() {
  return `${intro("A new friend starts with hello.", "Ask for a local tip. Find someone who shares your kind of adventure.")} ${!state.user ? empty("Travel is better with good company.", "Create an account to find travelers and start a conversation.", "account", "Join Triply") : `<div class="messaging-layout"><aside class="chat-sidebar"><form id="traveler-search"><label for="traveler-query">Find travelers</label><div class="search-inline"><input id="traveler-query" name="query" placeholder="Name or username" maxlength="50"><button class="primary-button">${icon("search")}Find</button></div></form><div id="traveler-results"></div><h3>Your conversations</h3><div id="chat-list"><p class="muted">Loading…</p></div><p class="source-note">Only members who opt into traveler discovery appear in search. Turn this on in your profile.</p></aside><section class="chat-panel" id="chat-panel">${empty("Make room for a new travel friend.", "Find a traveler and send a message request. Chat opens when they accept.")}</section></div>`}`;
}
function auth(mode = "login") {
  modal(
    mode === "signup"
      ? "Your next chapter starts here."
      : "Welcome back, traveler.",
    "YOUR TRIPLY ACCOUNT",
    `<form id="auth-form" data-mode="${mode}" class="stack-form">${mode === "signup" ? '<label>Display name<input name="name" autocomplete="name" minlength="2" maxlength="50" required></label>' : ""}<label>Username<input name="handle" autocomplete="username" pattern="[a-zA-Z0-9_]{3,24}" minlength="3" maxlength="24" required></label><label>Password<input type="password" name="password" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" minlength="${mode === "signup" ? 10 : 1}" maxlength="128" required></label>${mode === "signup" ? `<label>Home country<select name="country">${countryOptions()}</select></label><label class="check-label"><input type="checkbox" name="discover">Let other travelers find my profile and send message requests.</label><p class="source-note">Choose a password of at least 10 characters. You can change discoverability in your profile.</p>` : ""}<p class="form-error" role="alert"></p><button class="primary-button">${mode === "signup" ? "Create account" : "Sign in"}</button><button type="button" class="text-link" data-action="auth-mode" data-mode="${mode === "signup" ? "login" : "signup"}">${mode === "signup" ? "Already a member? Sign in" : "New here? Create an account"}</button></form>`,
  );
}
function account() {
  if (!state.user) return auth();
  modal(
    "Your little corner of Triply.",
    `@${escapeHTML(state.user.handle)}`,
    `<form id="profile-form" class="stack-form"><label>Display name<input name="name" value="${escapeHTML(state.user.name)}" minlength="2" maxlength="50" required></label><label>Home country<select name="country">${countryOptions(state.user.country)}</select></label><label class="check-label"><input type="checkbox" name="discover" ${state.user.discover ? "checked" : ""}>Allow travelers to find me and send message requests.</label><p class="form-error" role="alert"></p><button class="primary-button">Save profile</button><button class="secondary-button" type="button" data-action="logout">Sign out</button></form>`,
  );
}
function createPost() {
  if (!state.user) return auth("signup");
  modal(
    "A good place is worth sharing.",
    "SHARE A PHOTO · HELP THE NEXT TRAVELER",
    `<form id="post-form" class="stack-form"><label class="upload-area">${icon("camera")}<strong>Choose your travel photo</strong><span>JPG, PNG, or WebP · up to 3 MB</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><label>Where was it?<input name="location" placeholder="e.g. Lakeside, Pokhara" maxlength="100" minlength="2" required></label><div class="form-grid"><label>Country<select name="country">${countryOptions()}</select></label><label>Category<select name="category">${["camping", "hiking", "views", "beaches", "attractions", "stays", "food"].map((c) => `<option value="${c}">${categoryName(c)}</option>`).join("")}</select></label></div><label>Your tip<textarea name="caption" placeholder="What made it special? Anything the next traveler should know?" maxlength="1500" minlength="2" rows="4" required></textarea></label><p class="source-note">Your photo, caption, display name, and location will be visible to people using this Triply server. Only share photos you have permission to post.</p><p class="form-error" role="alert"></p><button class="primary-button">Share photo →</button></form>`,
  );
}
async function openComments(pid, question = "") {
  activePost = state.posts.find((p) => p.id === pid);
  if (!activePost) return;
  replyId = null;
  modal(
    "Ask someone who’s been there.",
    escapeHTML(activePost.location),
    '<div class="loading-state">Loading conversation…</div>',
  );
  try {
    const data = await api(`/api/posts/${pid}/comments`);
    if (!$("#modal").open || activePost?.id !== pid) return;
    modal(
      "Ask someone who’s been there.",
      escapeHTML(activePost.location),
      `<p class="discussion-caption">${escapeHTML(activePost.caption)}</p><div class="real-comments">${data.comments.length ? data.comments.map((c) => `<article class="real-comment ${c.parent_id ? "is-reply" : ""}"><strong>${escapeHTML(c.name)}</strong><span>@${escapeHTML(c.handle)}</span><p>${escapeHTML(c.body)}</p><button class="text-link" data-action="reply" data-id="${c.id}" data-name="${escapeHTML(c.name)}">Reply</button></article>`).join("") : empty("Be the first to ask.", "A good question can make someone’s next trip easier.")}</div>${state.user ? `<form id="comment-form" class="stack-form" data-id="${pid}"><span id="reply-context"></span><label>Ask a question or share a tip<textarea name="text" maxlength="500" rows="3" required>${escapeHTML(question)}</textarea></label><div class="quick-questions"><button type="button" data-action="fill-question" data-question="Where did you stay?">Where did you stay?</button><button type="button" data-action="fill-question" data-question="How much was it?">How much was it?</button></div><p class="form-error" role="alert"></p><button class="primary-button">Post comment</button></form>` : `<button class="primary-button" data-action="account">Sign in to comment</button>`}`,
    );
  } catch (error) {
    toast(error.message);
  }
}
function requestChat(uid, name) {
  if (!state.user) return auth();
  modal(
    `Say hello to ${escapeHTML(name)}.`,
    "SEND A MESSAGE REQUEST",
    `<form id="request-form" class="stack-form" data-user="${uid}"><label>Your introduction<textarea name="text" rows="4" maxlength="1000" placeholder="Hi! I’m planning a trip and would love to ask about…" required></textarea></label><p class="source-note">They’ll see this introduction and can accept, decline, or block the request. Further messages unlock after acceptance.</p><p class="form-error" role="alert"></p><button class="primary-button">Send request →</button></form>`,
  );
}
async function refreshChatList() {
  if (state.page !== "messages" || !state.user) return;
  const data = await api("/api/conversations");
  if (!$("#chat-list")) return;
  $("#chat-list").innerHTML = data.conversations.length
    ? data.conversations
        .map(
          (c) =>
            `<button class="chat-list-item ${state.chat === c.id ? "selected" : ""}" data-action="chat" data-id="${c.id}"><span class="small-avatar">${escapeHTML(c.name.slice(0, 2))}</span><span><strong>${escapeHTML(c.name)}</strong><small>${c.blocked ? "Blocked" : c.status === "accepted" ? "Connected" : c.status === "declined" ? "Declined" : c.incoming ? "New message request" : "Request sent"}</small></span></button>`,
        )
        .join("")
    : '<p class="muted">Your conversations will appear here.</p>';
}
async function openChat(cid) {
  state.chat = cid;
  await refreshChatList();
  const data = await api(`/api/conversations/${cid}`);
  if (state.chat !== cid || !$("#chat-panel")) return;
  state.chatData = data;
  const c = data.conversation;
  $("#chat-panel").innerHTML =
    `<div class="chat-header"><div><h3>${escapeHTML(c.other.name)}</h3><p>@${escapeHTML(c.other.handle)} · ${countryName(c.other.country)}</p></div><button class="text-link" data-action="report" data-id="${c.other.id}">Report</button><button class="text-link" data-action="chat-action" data-kind="block">Block</button></div><div id="chat-messages" class="chat-messages"></div><div id="chat-controls">${c.blocked ? '<div class="notice">Messages are blocked.</div>' : c.status === "pending" ? (c.incoming ? '<div class="request-actions"><p>Accept this request to start chatting.</p><button class="primary-button" data-action="chat-action" data-kind="accept">Accept request</button><button class="secondary-button" data-action="chat-action" data-kind="decline">Decline</button></div>' : '<div class="notice">Request sent. You can chat after they accept.</div>') : c.status === "declined" ? '<div class="notice">This request was declined.</div>' : '<form id="message-form" class="message-form"><label class="sr-only" for="message-input">Message</label><textarea id="message-input" name="text" maxlength="1000" rows="2" placeholder="Write a message…" required></textarea><button class="primary-button">Send →</button><p class="form-error" role="alert"></p></form>'}</div>`;
  drawMessages(data.messages);
}
function drawMessages(messages) {
  const box = $("#chat-messages");
  if (!box) return;
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.innerHTML = messages
    .map(
      (m) =>
        `<div class="message ${m.user_id === state.user.id ? "mine" : ""}"><p>${escapeHTML(m.body)}</p><time>${new Date(m.created).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>`,
    )
    .join("");
  if (nearBottom) box.scrollTop = box.scrollHeight;
}
async function pollChat() {
  if (state.page !== "messages" || !state.user || document.hidden) return;
  try {
    await refreshChatList();
    if (state.chat) {
      const cid = state.chat;
      const data = await api(`/api/conversations/${cid}`);
      if (state.page !== "messages" || state.chat !== cid) return;
      if (
        data.conversation.status !== state.chatData?.conversation.status ||
        data.conversation.blocked !== state.chatData?.conversation.blocked
      )
        return openChat(state.chat);
      if (
        JSON.stringify(data.messages) !==
        JSON.stringify(state.chatData?.messages)
      ) {
        state.chatData = data;
        drawMessages(data.messages);
      }
    }
  } catch {
    /* Preserve the draft on transient connection failures. */
  }
}
function converter() {
  modal(
    "A little clarity on currency.",
    "CONVERT YOUR TRAVEL BUDGET",
    `<form id="convert-form" class="stack-form"><label>Amount<input name="amount" type="number" min="0" max="1000000000" step="any" value="100" required></label><div class="form-grid"><label>From<select name="from">${currencyOptions("USD")}</select></label><label>To<select name="to">${currencyOptions(state.currency === "USD" ? "NPR" : state.currency)}</select></label></div><p id="conversion-result" class="conversion-result" aria-live="polite"></p><p class="form-error" role="alert"></p><button class="primary-button">Convert</button><p class="source-note">Indicative daily rates; providers may use different exchange rates or fees. <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">Rates By Exchange Rate API</a>.</p></form>`,
  );
}
async function runSearch() {
  capture();
  if (
    state.kind !== "flights" &&
    !TriplyFilters.dates(state.start, state.end)
  ) {
    $("#search-error").textContent = "Choose an end date after the start date.";
    return;
  }
  if (
    state.kind === "flights" &&
    state.origin.toLowerCase() === state.destination.toLowerCase()
  ) {
    $("#search-error").textContent =
      "Choose different departure and arrival places.";
    return;
  }
  const version = ++searchVersion,
    query = { ...state };
  state.loading = true;
  state.priceData = null;
  if (query.kind === "explore") {
    state.searchDone = true;
    state.placesError = "";
    state.places = [];
    state.area = null;
    state.center = null;
    navigate("home");
    render();
    try {
      const data = await api(
        "/api/places?" +
          new URLSearchParams({
            location: query.location,
            ...(query.selectedDestination
              ? { destinationId: query.selectedDestination.id }
              : {}),
            category: query.category,
          }),
      );
      if (version !== searchVersion) return;
      state.country = data.country || "";
      state.area = data.scope === "area" ? data : null;
      state.places = data.places.map((p) => ({
        ...p,
        location: query.location,
        country: state.country,
      }));
      state.center = data.center;
      state.placesError = data.message || "";
    } catch (e) {
      if (version === searchVersion) state.placesError = e.message;
    } finally {
      if (version === searchVersion) {
        state.loading = false;
        if (state.page === "home") render();
      }
    }
  } else {
    navigate("deals");
    render();
    try {
      const data = await api(
        `/api/${query.kind}?` +
          new URLSearchParams({
            origin: query.origin,
            destination: query.destination,
            start: query.start,
            end: query.end,
            adults: query.adults,
            currency: query.currency,
            location: query.location,
            ...(query.selectedDestination
              ? { destinationId: query.selectedDestination.id }
              : {}),
            residence: query.residence,
            driverAge: query.driverAge,
            pickupTime: query.pickupTime,
            dropoffTime: query.dropoffTime,
            platform: window.innerWidth <= 640 ? "mobile" : "desktop",
          }),
      );
      if (version !== searchVersion) return;
      state.priceData = data;
    } catch (e) {
      if (version === searchVersion)
        state.priceData = { message: e.message, offers: [] };
    }
    if (version === searchVersion) {
      state.loading = false;
      if (state.page === "deals") render();
    }
  }
}
function render() {
  TriplyExplore.dispose();
  const version = ++renderVersion;
  clearInterval(chatTimer);
  header();
  $("#main").innerHTML =
    state.page === "home"
      ? discover()
      : state.page === "deals"
        ? dealResults()
        : state.page === "community"
          ? community()
          : state.page === "messages"
            ? messagesPage()
            : savedPage();
  if (state.page === "home" && state.searchDone && !state.loading) {
    TriplyExplore.mountMap();
    TriplyExplore.loadPhotos(version);
  }
  if (state.page === "community") loadPosts(version);
  if (state.page === "messages" && state.user) {
    refreshChatList().catch((e) => toast(e.message));
    if (state.chat) openChat(state.chat).catch((e) => toast(e.message));
    chatTimer = setInterval(pollChat, 5000);
  }
}
async function refreshUser() {
  state.user = (await api("/api/me")).user;
  state.saved = state.user ? (await api("/api/saved")).items : [];
}
document.addEventListener("click", async (event) => {
  const el = event.target.closest("[data-action]");
  if (!el) return;
  const { action, id, kind } = el.dataset;
  try {
    if (action === "close") $("#modal").close();
    if (action === "account") account();
    if (action === "copy-trip") {
      capture();
      const details = comparisonTripDetails();
      try {
        await navigator.clipboard.writeText(details);
        toast(
          "Trip details copied. Use them to compare the same trip on each site.",
        );
      } catch {
        modal(
          "Your trip details",
          "Select and copy these details for the booking website.",
          `<label>Trip details<textarea id="trip-copy-fallback" rows="10" readonly>${escapeHTML(details)}</textarea></label>`,
        );
        $("#trip-copy-fallback").select();
      }
    }
    if (action === "auth-mode") auth(el.dataset.mode);
    if (action === "kind") {
      capture();
      searchVersion++;
      state.kind = kind;
      state.loading = false;
      state.priceData = null;
      if (kind === "explore") navigate("home");
      else if (state.page === "deals") render();
      else render();
    }
    if (action === "category") {
      capture();
      state.category = el.dataset.category;
      state.kind = "explore";
      if (state.searchDone) await runSearch();
      else render();
    }
    if (action === "browse-city") {
      const city = state.area?.destinations.find((city) => city.id === id);
      if (!city) return;
      capture();
      state.location = city.label;
      state.country = city.country;
      state.selectedDestination = city;
      state.kind = "explore";
      const input = $("#destination-input");
      if (input) input.value = city.label;
      await runSearch();
    }
    if (action === "local-currency") {
      capture();
      const code = state.countries.find((c) => c.code === state.country)
        ?.currencies[0]?.code;
      if (!code)
        return toast("No official currency is listed for this territory.");
      state.currency = code;
      store("triply-currency", code);
      render();
      toast(`Display currency set to ${code}`);
    }
    if (action === "inspiration") {
      const p = inspiration[Number(el.dataset.index)];
      state.selectedDestination = null;
      state.country = p.country;
      state.location = `${p.name}, ${countryName(p.country)}`;
      state.category = p.category;
      state.kind = "explore";
      render();
      await runSearch();
    }
    if (action === "search-again") await runSearch();
    if (action === "nearby") {
      $("#modal").close();
      capture();
      state.selectedDestination = null;
      state.country = el.dataset.country;
      state.location = el.dataset.location
        .toLowerCase()
        .includes(countryName(el.dataset.country).toLowerCase())
        ? el.dataset.location
        : `${el.dataset.location}, ${countryName(el.dataset.country)}`;
      state.kind = "stays";
      navigate("deals");
    }
    if (action === "convert") converter();
    if (action === "credits")
      modal(
        "Built for a curious world.",
        "DATA & PHOTO CREDITS",
        `<p class="source-note">Places © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>, ODbL. Country data from <a href="https://github.com/mledoze/countries" target="_blank" rel="noopener noreferrer">mledoze/countries</a>; current currency mappings from <a href="https://github.com/unicode-org/cldr-json" target="_blank" rel="noopener noreferrer">Unicode CLDR</a>. <a href="/data/countries.json" target="_blank">Download the adapted country catalog</a> under the <a href="/licenses/countries-ODbL.txt" target="_blank">Open Database License</a>, with <a href="/licenses/unicode.txt" target="_blank">Unicode attribution</a>. Rates By <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">Exchange Rate API</a>. Destination suggestions © <a href="https://www.geonames.org" target="_blank" rel="noopener noreferrer">GeoNames</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Maps use Leaflet (BSD-2-Clause). Place photos use linked Wikimedia Commons images with individual credits. Inspiration photos from Unsplash and Pexels are illustrative, with credits on cards; community photos are uploaded by their authors.</p>`,
      );
    if (action === "create-post") createPost();
    if (action === "comments" || action === "question")
      await openComments(id, el.dataset.question || "");
    if (action === "reply") {
      replyId = id;
      $("#reply-context").textContent = `Replying to ${el.dataset.name}`;
      $("#comment-form textarea").focus();
    }
    if (action === "fill-question") {
      $("#comment-form textarea").value = el.dataset.question;
      $("#comment-form textarea").focus();
    }
    if (action === "save-place") {
      if (!state.user) return auth();
      const place = [...state.places, ...state.saved].find((p) => p.id === id);
      if (!place) return;
      const result = await api("/api/saved", {
        method: "POST",
        body: { item: place },
      });
      state.saved = (await api("/api/saved")).items;
      render();
      toast(
        result.saved
          ? "Saved for your next adventure."
          : "Removed from saved places.",
      );
    }
    if (action === "logout") {
      await api("/api/logout", { method: "POST", body: {} });
      state.user = null;
      state.saved = [];
      state.chat = null;
      state.chatData = null;
      $("#modal").close();
      render();
    }
    if (action === "request-chat") requestChat(id, el.dataset.name);
    if (action === "chat") await openChat(id);
    if (action === "chat-action") {
      await api(`/api/conversations/${state.chat}/action`, {
        method: "POST",
        body: { action: kind },
      });
      await openChat(state.chat);
    }
    if (action === "report") {
      if (!state.user) return auth();
      modal(
        "Tell us what happened.",
        "REPORT CONTENT OR A TRAVELER",
        `<form id="report-form" class="stack-form" data-id="${escapeHTML(id)}"><label>Reason<textarea name="reason" minlength="3" maxlength="1000" rows="4" required></textarea></label><p class="source-note">Your report is stored for the site owner to review. This local development server has no staffed moderation queue yet. For unwanted messages, also use Block.</p><p class="form-error" role="alert"></p><button class="primary-button">Submit report</button></form>`,
      );
    }
  } catch (error) {
    toast(error.message);
  }
});
document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!form.id) return;
  event.preventDefault();
  if (form.id === "global-search") return runSearch();
  const b = Object.fromEntries(new FormData(form)),
    submit = form.querySelector('[type="submit"],button:not([type])');
  if (submit) submit.disabled = true;
  const err = form.querySelector(".form-error");
  if (err) err.textContent = "";
  try {
    if (form.id === "auth-form") {
      const result = await api(`/api/${form.dataset.mode}`, {
        method: "POST",
        body: { ...b, discover: b.discover === "on" },
      });
      state.user = result.user;
      state.saved = (await api("/api/saved")).items;
      $("#modal").close();
      render();
      toast(`Welcome, ${state.user.name}.`);
    }
    if (form.id === "profile-form") {
      state.user = (
        await api("/api/profile", {
          method: "PATCH",
          body: { ...b, discover: b.discover === "on" },
        })
      ).user;
      $("#modal").close();
      render();
      toast("Profile updated.");
    }
    if (form.id === "post-form") {
      const file = form.querySelector('[name="photo"]').files[0];
      if (!file || file.size > 3145728)
        throw Error("Choose an image under 3 MB.");
      const image = await preparePhoto(file);
      await api("/api/posts", {
        method: "POST",
        body: {
          country: b.country,
          location: b.location,
          category: b.category,
          caption: b.caption,
          image,
        },
      });
      $("#modal").close();
      navigate("community");
      if (state.page === "community") render();
      toast("Your story is live on this Triply server.");
    }
    if (form.id === "comment-form") {
      await api(`/api/posts/${form.dataset.id}/comments`, {
        method: "POST",
        body: { text: b.text, parentId: replyId },
      });
      await openComments(form.dataset.id);
      if (state.page === "community") loadPosts(renderVersion);
    }
    if (form.id === "traveler-search") {
      const data = await api("/api/travelers?q=" + encodeURIComponent(b.query));
      $("#traveler-results").innerHTML = data.travelers.length
        ? data.travelers
            .map(
              (u) =>
                `<div class="traveler-result"><strong>${escapeHTML(u.name)}</strong><span>@${escapeHTML(u.handle)} · ${countryName(u.country)}</span><button class="text-link" data-action="request-chat" data-id="${u.id}" data-name="${escapeHTML(u.name)}">Say hello →</button></div>`,
            )
            .join("")
        : '<p class="source-note">No discoverable travelers found. Invite a friend to create an account and enable traveler discovery.</p>';
    }
    if (form.id === "request-form") {
      const result = await api("/api/conversations", {
        method: "POST",
        body: { userId: form.dataset.user, text: b.text },
      });
      state.chat = result.id;
      $("#modal").close();
      navigate("messages");
      if (state.page === "messages") await openChat(state.chat);
    }
    if (form.id === "message-form") {
      await api(`/api/conversations/${state.chat}/messages`, {
        method: "POST",
        body: { text: b.text },
      });
      form.reset();
      await pollChat();
    }
    if (form.id === "convert-form") {
      const data = await api("/api/convert?" + new URLSearchParams(b));
      $("#conversion-result").textContent =
        `${money(data.amount, data.from)} = ${money(data.converted, data.to)}${data.updatedAt ? ` · Rates ${data.stale ? "cached, " : ""}updated ${data.updatedAt}` : ""}`;
    }
    if (form.id === "report-form") {
      await api("/api/reports", {
        method: "POST",
        body: { targetId: form.dataset.id, reason: b.reason },
      });
      $("#modal").close();
      toast("Report saved for the site owner.");
    }
  } catch (error) {
    if (err) err.textContent = error.message;
    else toast(error.message);
  } finally {
    if (submit) submit.disabled = false;
  }
});
async function preparePhoto(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Choose a JPG, PNG, or WebP photo.");
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > 40000000) {
    bitmap.close();
    throw Error("Choose a smaller image.");
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
document.addEventListener("input", (event) => {
  if (!event.target.closest("#global-search")) return;
  updateComparisonLinks();
  searchVersion++;
  state.loading = false;
  state.priceData = null;
  const panel = $("#live-pricing");
  if (panel)
    panel.innerHTML = "<p>Search again to update prices for these details.</p>";
  const button = $("#global-search .search-submit");
  button.disabled = false;
  button.textContent =
    state.kind === "explore" ? "Find places" : "Compare prices";
});
document.addEventListener("change", (event) => {
  if (event.target.id === "currency") {
    capture();
    searchVersion++;
    state.loading = false;
    state.currency = event.target.value;
    store("triply-currency", state.currency);
    state.priceData = null;
    render();
  }
  if (
    event.target.closest("#global-search") &&
    event.target.matches("input,select")
  ) {
    updateComparisonLinks();
    searchVersion++;
    state.loading = false;
    state.priceData = null;
    const button = $("#global-search .search-submit");
    button.disabled = false;
    button.innerHTML =
      icon("search") +
      (state.kind === "explore" ? "Find places" : "Compare prices");
    if (event.target.name === "location") {
      capture();
      $(".country-context").innerHTML = destinationHint();
    }
  }
});
$("#theme-toggle").addEventListener("click", () => {
  const dark = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", dark);
  $("#theme-toggle").setAttribute("aria-pressed", String(dark));
  store("triply-dark", dark);
});
document.documentElement.classList.toggle("dark", read("triply-dark", false));
function route() {
  let page = location.hash.slice(1);
  if (page === "home" && state.page !== "home") state.kind = "explore";
  if (page === "picks") page = "community";
  state.page = ["home", "deals", "community", "messages", "saved"].includes(
    page,
  )
    ? page
    : "home";
  if (state.page === "deals" && state.kind === "explore")
    state.kind = "flights";
  render();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
(async () => {
  try {
    const config = await api("/api/config");
    Object.assign(state, {
      countries: config.countries,
      currencies: config.currencies,
      pricing: config.pricing,
      photoAssets: config.photos,
    });
    if (!state.currencies.includes(state.currency)) state.currency = "USD";
    await refreshUser();
    route();
  } catch (error) {
    $("#main").innerHTML = empty(
      "Triply couldn’t reach its server.",
      escapeHTML(error.message),
    );
  }
})();
