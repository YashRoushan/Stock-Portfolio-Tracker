/** Fixed, illustrative values for the public demo. No market-data claim is made. */
export const demoPricing = {
  mode: "sample",
  label: "Illustrative sample prices",
  currency: "USD",
  isLive: false,
} as const;

export const sampleQuotes: Record<string, { priceCents: number; changeCents: number }> = {
  AAPL: { priceCents: 19850, changeCents: 125 },
  MSFT: { priceCents: 41500, changeCents: 210 },
  VTI: { priceCents: 27500, changeCents: 95 },
  GOOGL: { priceCents: 17500, changeCents: -85 },
  NVDA: { priceCents: 13500, changeCents: 180 },
};

export function getSampleQuotes(tickers: string[]) {
  return [...new Set(tickers)].map((ticker) => ({
    ticker,
    ...(sampleQuotes[ticker] ?? { priceCents: 0, changeCents: 0 }),
    available: Object.hasOwn(sampleQuotes, ticker),
    source: "sample",
  }));
}
