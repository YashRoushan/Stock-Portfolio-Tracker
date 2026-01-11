export const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(cents / 100);
};

export const formatPct = (value: number) => {
  return `${(value * 100).toFixed(2)}%`;
};
