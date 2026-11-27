export const formatCurrency = (cents: number | null) => {
  if (cents === null) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(cents / 100);
};

export const formatPct = (value: number | null) => {
  if (value === null) return "Unavailable";
  return `${(value * 100).toFixed(2)}%`;
};
