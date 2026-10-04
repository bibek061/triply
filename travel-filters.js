(function (root) {
  const filters = {
    places: (items, fee) =>
      fee === "free" ? items.filter((p) => p.feeStatus === "free") : items,
    offers: (items, budget, currency) =>
      items.filter(
        (o) =>
          o.currency === currency &&
          Number.isFinite(o.total) &&
          (budget === "" || budget === null || o.total <= Number(budget)),
      ),
    dates: (start, end) => {
      const valid = (v) =>
        /^\d{4}-\d{2}-\d{2}$/.test(v) &&
        Number.isFinite(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v;
      return valid(start) && valid(end) && end > start;
    },
  };
  if (typeof module === "object") module.exports = filters;
  else root.TriplyFilters = filters;
})(typeof window !== "undefined" ? window : this);
