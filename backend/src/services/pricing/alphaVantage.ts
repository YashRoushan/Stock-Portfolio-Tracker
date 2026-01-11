import { MarketDataProvider, PriceQuote } from "./provider";
import { toCents } from "../../utils/money";

const apiKey = process.env.ALPHA_VANTAGE_API_KEY || "";

export const alphaVantageProvider: MarketDataProvider = {
  async getQuote(ticker: string): Promise<PriceQuote | null> {
    if (!apiKey) {
      return null;
    }
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
      ticker
    )}&apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      "Global Quote"?: Record<string, string>;
    };
    const quote = payload["Global Quote"];
    if (!quote) {
      return null;
    }
    const price = Number(quote["05. price"] || 0);
    const change = Number(quote["09. change"] || 0);
    if (!price) {
      return null;
    }
    return {
      ticker,
      priceCents: toCents(price),
      changeCents: toCents(change)
    };
  }
};
