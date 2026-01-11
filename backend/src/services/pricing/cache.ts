import { MarketDataProvider, PriceQuote } from "./provider";

const ttlSeconds = Number(process.env.PRICE_CACHE_TTL_SECONDS || 60);

type CacheEntry = {
  quote: PriceQuote;
  expiresAt: number;
};

export class PriceCache {
  private cache = new Map<string, CacheEntry>();
  private provider: MarketDataProvider;

  constructor(provider: MarketDataProvider) {
    this.provider = provider;
  }

  async getQuotes(tickers: string[]): Promise<PriceQuote[]> {
    const now = Date.now();
    const results: PriceQuote[] = [];

    for (const rawTicker of tickers) {
      const ticker = rawTicker.toUpperCase();
      const existing = this.cache.get(ticker);
      if (existing && existing.expiresAt > now) {
        results.push(existing.quote);
        continue;
      }

      const quote = await this.provider.getQuote(ticker);
      if (quote) {
        this.cache.set(ticker, {
          quote,
          expiresAt: now + ttlSeconds * 1000
        });
        results.push(quote);
      }
    }

    return results;
  }
}
