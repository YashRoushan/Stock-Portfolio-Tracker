import { MarketDataProvider, PriceQuote } from "./provider";
import { toCents } from "../../utils/money";

const apiKey = process.env.FMP_API_KEY || "";

export const fmpProvider: MarketDataProvider = {
  async getQuote(ticker: string): Promise<PriceQuote | null> {
    if (!apiKey) {
      return null;
    }
    const url = `https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(
      ticker
    )}?apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as Array<{ price: number; change: number }>;
    if (!payload.length) {
      return null;
    }
    const quote = payload[0];
    if (!quote.price) {
      return null;
    }
    return {
      ticker,
      priceCents: toCents(quote.price),
      changeCents: toCents(quote.change || 0)
    };
  }
};
