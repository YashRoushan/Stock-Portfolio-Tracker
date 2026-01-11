export interface PriceQuote {
  ticker: string;
  priceCents: number;
  changeCents: number;
}

export interface MarketDataProvider {
  getQuote: (ticker: string) => Promise<PriceQuote | null>;
  getDividends?: (ticker: string) => Promise<{ date: string; amountCents: number }[]>;
}
