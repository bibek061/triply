"use strict";
// Native adapters based on Duffel v2 and Booking.com Demand v3.2.
const validTotal = (v) =>
  v !== null &&
  v !== "" &&
  v !== undefined &&
  Number.isFinite(Number(v)) &&
  Number(v) > 0;
function safeURL(value, domains) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      domains.some((d) => u.hostname === d || u.hostname.endsWith("." + d))
      ? u.href
      : "";
  } catch {
    return "";
  }
}
function createProviders({ fetchImpl = fetch, env = process.env } = {}) {
  const configured = Boolean(env.DUFFEL_ACCESS_TOKEN?.trim());
  const bookingConfigured = Boolean(
    env.BOOKING_API_TOKEN?.trim() &&
    /^\d+$/.test(env.BOOKING_AFFILIATE_ID || ""),
  );
  const production =
    env.DUFFEL_ACCESS_TOKEN?.startsWith("duffel_live_") || false;
  const bookingProduction = env.BOOKING_ENV === "production";
  const bookingBase = bookingProduction
    ? "https://demandapi.booking.com/3.2"
    : "https://demandapi-sandbox.booking.com/3.2";
  const pending = new Map();
  const unavailable = (provider) => ({
    provider,
    status: "not_configured",
    offers: [],
    message: `${provider} pricing is not connected. You can still compare on the booking websites below.`,
  });
  async function request(url, body, headers, provider) {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
      redirect: "error",
    });
    if (!res.ok) {
      const status =
        res.status === 401 || res.status === 403
          ? "access_required"
          : res.status === 429
            ? "rate_limited"
            : "unavailable";
      throw Object.assign(
        new Error(
          status === "access_required"
            ? `${provider} rejected API access. Check the token, environment, and product permissions.`
            : status === "rate_limited"
              ? `${provider} is rate-limiting searches. Try again shortly.`
              : `${provider} could not complete this search. Try another destination or date.`,
        ),
        { providerStatus: status },
      );
    }
    return res.json();
  }
  const booking = (route, body) =>
    request(
      bookingBase + route,
      body,
      {
        Authorization: `Bearer ${env.BOOKING_API_TOKEN}`,
        "X-Affiliate-Id": env.BOOKING_AFFILIATE_ID,
      },
      "Booking.com",
    );
  function search(kind, provider, q, fn) {
    const key = kind + JSON.stringify(q);
    if (pending.has(key)) return pending.get(key);
    const job = fn()
      .catch((e) => ({
        provider,
        status: e.providerStatus || "unavailable",
        offers: [],
        message: e.providerStatus
          ? e.message
          : `${provider} could not be reached. Please retry.`,
      }))
      .finally(() => pending.delete(key));
    pending.set(key, job);
    return job;
  }
  function result(provider, live, offers, q, message) {
    const currencies = [
      ...new Set(offers.map((o) => o.currency).filter(Boolean)),
    ];
    return {
      provider,
      status: live ? "live" : "sandbox",
      checkedAt: new Date().toISOString(),
      currencies,
      message:
        (live
          ? message
          : "Sandbox examples only — these are not live, bookable prices. ") +
        (currencies.some((c) => c !== q.currency)
          ? ` Other returned currencies: ${currencies.filter((c) => c !== q.currency).join(", ")}. Select one of those currencies and search again to see its offers.`
          : ""),
      offers: offers
        .filter((o) => validTotal(o.total) && o.currency === q.currency)
        .sort((a, b) => a.total - b.total)
        .slice(0, 30),
    };
  }
  function flights(q) {
    return search("flights", "Duffel", q, async () => {
      if (!configured) return unavailable("Duffel");
      if (!/^[A-Z]{3}$/.test(q.origin) || !/^[A-Z]{3}$/.test(q.destination))
        return {
          provider: "Duffel",
          status: "needs_airport_codes",
          offers: [],
          message:
            "Enter airport codes such as JFK and LHR to check flight fares.",
        };
      const { data } = await request(
        "https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=15000",
        {
          data: {
            slices: [
              {
                origin: q.origin,
                destination: q.destination,
                departure_date: q.start,
              },
            ],
            passengers: Array.from({ length: q.adults }, () => ({
              type: "adult",
            })),
            cabin_class: "economy",
          },
        },
        {
          Authorization: `Bearer ${env.DUFFEL_ACCESS_TOKEN}`,
          "Duffel-Version": "v2",
        },
        "Duffel",
      );
      if (
        !data ||
        !Array.isArray(data.offers) ||
        typeof data.live_mode !== "boolean"
      )
        throw Error("Invalid response");
      const offers = data.offers
        .filter(
          (o) =>
            !o.partial &&
            validTotal(o.total_amount) &&
            Date.parse(o.expires_at) > Date.now() &&
            o.live_mode === data.live_mode,
        )
        .map((o) => {
          const segments = (o.slices || []).flatMap((s) => s.segments || []);
          return {
            id: o.id,
            name: o.owner?.name || "Airline offer",
            total: Number(o.total_amount),
            currency: o.total_currency,
            expiresAt: o.expires_at,
            details: segments.map(
              (s) =>
                `${s.origin?.iata_code} → ${s.destination?.iata_code} · ${s.departing_at} · Operated by ${s.operating_carrier?.name || "carrier not supplied"}`,
            ),
            terms:
              "Economy · total for all selected adults. Optional baggage and extras may cost more. Separate booking-site searches do not guarantee this fare.",
            url: "",
          };
        });
      return result(
        "Duffel",
        data.live_mode,
        offers,
        q,
        "Airline offers sorted by total for this search. Recheck availability before purchase.",
      );
    });
  }
  function stays(q) {
    return search("stays", "Booking.com", q, async () => {
      if (!bookingConfigured) return unavailable("Booking.com");
      const response = await booking("/accommodations/search", {
        booker: {
          country: q.residence.toLowerCase(),
          platform: q.platform || "desktop",
        },
        checkin: q.start,
        checkout: q.end,
        currency: q.currency,
        coordinates: { latitude: q.lat, longitude: q.lon, radius: 10 },
        guests: { number_of_adults: q.adults, number_of_rooms: 1 },
        extras: ["products"],
        rows: 20,
        sort: { by: "price", direction: "ascending" },
      });
      if (!Array.isArray(response.data)) throw Error("Invalid response");
      const rows = response.data.filter((o) =>
        validTotal(o.price?.total?.booker_currency),
      );
      let details = [];
      if (rows.length)
        details =
          (
            await booking("/accommodations/details", {
              accommodations: rows.map((o) => o.id),
              languages: ["en-us"],
              extras: ["photos", "rooms"],
            }).catch(() => ({ data: [] }))
          ).data || [];
      const offers = rows.map((o) => {
        const d = details.find((x) => x.id === o.id),
          product = o.products?.[0],
          room = d?.rooms?.find((r) => r.id === product?.room),
          photo = d?.photos?.find((p) => p.main_photo) || d?.photos?.[0];
        return {
          id: String(o.id),
          name: d?.name?.["en-us"] || `Property ${o.id}`,
          total: Number(o.price.total.booker_currency),
          currency: o.currency?.booker,
          image: safeURL(photo?.url?.standard, ["bstatic.com"]),
          url: safeURL(o.url, ["booking.com"]),
          details: [
            `${q.adults} adults · 1 room · ${q.start} to ${q.end}`,
            room?.name?.["en-us"] || "See room details on Booking.com",
          ],
          terms: [
            product?.policies?.cancellation?.type?.replaceAll("_", " "),
            product?.policies?.meal_plan?.plan?.replaceAll("_", " "),
            "Full-stay total; conditional charges and optional extras may apply.",
          ]
            .filter(Boolean)
            .join(" · "),
        };
      });
      return result(
        "Booking.com",
        bookingProduction,
        offers,
        q,
        "Up to 20 returned stays within 10 km, sorted by full-stay total. Rooms and cancellation terms vary; these are not identical products across websites.",
      );
    });
  }
  function cars(q) {
    return search("cars", "Booking.com", q, async () => {
      if (!bookingConfigured) return unavailable("Booking.com");
      const location = q.airport
        ? { airport: q.airport }
        : { coordinates: { latitude: q.lat, longitude: q.lon } };
      const response = await booking("/cars/search", {
        booker: { country: q.residence.toLowerCase() },
        currency: q.currency,
        driver: { age: q.driverAge },
        filters: { number_of_seats: q.adults },
        route: {
          pickup: { datetime: `${q.start}T${q.pickupTime}:00`, location },
          dropoff: { datetime: `${q.end}T${q.dropoffTime}:00`, location },
        },
        maximum_results: 30,
        sort: { by: "price", direction: "ascending" },
      });
      if (!Array.isArray(response.data)) throw Error("Invalid response");
      const rows = response.data.filter((o) => validTotal(o.price?.total));
      let suppliers = [];
      if (rows.length)
        suppliers =
          (
            await booking("/cars/suppliers", {
              suppliers: [...new Set(rows.map((o) => o.supplier))],
            }).catch(() => ({ data: [] }))
          ).data || [];
      const offers = rows.map((o) => ({
        id: String(o.offer || o.car),
        name: (o.categories || ["Rental car"]).join(" / ").replaceAll("_", " "),
        total: Number(o.price.total),
        currency: o.price.currency,
        url: safeURL(o.url?.web, ["booking.com", "rentalcars.com"]),
        details: [
          suppliers.find((s) => s.id === o.supplier)?.name ||
            `Supplier ${o.supplier}`,
          `Vehicle reference ${o.car} · confirm model on provider`,
          `Pick up ${q.start} ${q.pickupTime}; return ${q.end} ${q.dropoffTime} (local time)`,
        ],
        terms: [
          o.policies?.cancellation?.type?.replaceAll("_", " "),
          o.policies?.fuel?.replaceAll("_", " "),
          o.policies?.mileage?.type ? `${o.policies.mileage.type} mileage` : "",
          o.policies?.deposit
            ? `Deposit: ${o.policies.deposit.amount} ${o.policies.deposit.currency}`
            : "",
          "Rental total includes returned taxes/fees. Optional cover and extras may cost more.",
        ]
          .filter(Boolean)
          .join(" · "),
      }));
      return result(
        "Booking.com",
        bookingProduction,
        offers,
        q,
        "Up to 30 rental offers, sorted by full-rental total. Pickup and return use the same search location; confirm the depot on the provider.",
      );
    });
  }
  return {
    flights,
    stays,
    cars,
    configured,
    production,
    bookingConfigured,
    bookingProduction,
  };
}
module.exports = { createProviders, safeURL };
