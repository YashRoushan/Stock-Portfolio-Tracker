import type { HostedBindings } from "./types";
import { fetchTiingoClose } from "./tiingo";

/** Fixed values used when the site has no licensed valuation feed. */
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

const marketPricing = {
  mode: "end-of-day",
  label: "End-of-day market prices",
  currency: "USD",
  isLive: false,
  provider: "Tiingo",
} as const;

export function configuredPricing(env: HostedBindings) {
  return env.STOCK_PRICE_PROVIDER === "tiingo" && env.TIINGO_API_TOKEN?.trim()
    ? marketPricing : demoPricing;
}

type Quote = {
  ticker: string;
  priceCents: number;
  changeCents: number;
  available: boolean;
  source: string;
  tradingDay?: string;
};

type CachedClose = {
  price_cents: number | null;
  change_cents: number | null;
  trading_day: string | null;
};

const sixHours = 6 * 60 * 60 * 1_000;
const fourteenDays = 14 * 24 * 60 * 60 * 1_000;

async function getMarketQuote(env: HostedBindings, ticker: string, now: number): Promise<Quote> {
  const unavailable: Quote = { ticker, priceCents: 0, changeCents: 0, available: false, source: "tiingo" };
  // The public demo fetches only its five supported symbols. A shared atomic
  // refresh reservation prevents visitors or concurrent requests from exhausting the key.
  if (!Object.hasOwn(sampleQuotes, ticker)) return unavailable;
  const reservation = await env.DB.prepare(
    `INSERT INTO market_quotes (ticker, next_attempt_at) VALUES (?, ?)
     ON CONFLICT(ticker) DO UPDATE SET next_attempt_at = excluded.next_attempt_at
     WHERE market_quotes.next_attempt_at <= ?`,
  ).bind(ticker, now + sixHours, now).run();

  if (reservation.meta.changes) {
    const close = await fetchTiingoClose(ticker, env.TIINGO_API_TOKEN!.trim(), new Date(now));
    if (close) {
      await env.DB.batch([
        ...close.history.map(day => env.DB.prepare(
          "INSERT INTO daily_closes (ticker, date, price_cents) VALUES (?, ?, ?) ON CONFLICT(ticker,date) DO UPDATE SET price_cents = excluded.price_cents"
        ).bind(ticker, day.date, day.priceCents)),
        env.DB.prepare(
        `UPDATE market_quotes SET price_cents = ?, change_cents = ?, trading_day = ?
         WHERE ticker = ? AND next_attempt_at = ?`,
      ).bind(close.priceCents, close.changeCents, close.tradingDay, ticker, now + sixHours),
      ]);
    }
  }

  const cached = await env.DB.prepare(
    "SELECT price_cents, change_cents, trading_day FROM market_quotes WHERE ticker = ?",
  ).bind(ticker).first<CachedClose>();
  const oldest = new Date(now - fourteenDays).toISOString().slice(0, 10);
  if (!cached?.price_cents || cached.change_cents === null || !cached.trading_day || cached.trading_day < oldest) {
    return unavailable;
  }
  return {
    ticker, priceCents: cached.price_cents, changeCents: cached.change_cents,
    tradingDay: cached.trading_day, available: true, source: "tiingo",
  };
}

export async function portfolioQuotes(env: HostedBindings, tickers: string[]) {
  const pricing = configuredPricing(env);
  if (pricing.mode === "sample") return { prices: getSampleQuotes(tickers), pricing };
  const now = Date.now();
  const prices = await Promise.all([...new Set(tickers)].map(ticker => getMarketQuote(env, ticker, now)));
  const tradingDays = prices.flatMap(quote => quote.tradingDay ? [quote.tradingDay] : []).sort();
  return { prices, pricing: { ...pricing, asOf: tradingDays[0] ?? null } };
}


// Illustrative observations for the seeded workspace, independent of market data.
const sampleSessions = [
  ["2026-01-15", 18000, 38300, 24900, 15600, 11400],
  ["2026-01-30", 18420, 39110, 25200, 15900, 11800],
  ["2026-02-27", 18850, 38800, 25800, 16250, 11600],
  ["2026-03-31", 18600, 40100, 26120, 16540, 12000],
  ["2026-04-30", 19300, 39900, 26280, 17000, 12550],
  ["2026-05-29", 19150, 40700, 26900, 16800, 12300],
  ["2026-06-30", 19850, 41500, 27500, 17500, 13500],
] as const;

const sampleSymbols = ["AAPL", "MSFT", "VTI", "GOOGL", "NVDA"];

export function sampleCloses(symbols: string[]) {
  // Interpolate weekday observations only for the explicitly illustrative demo.
  const history = [];
  for (let i = 1; i < sampleSessions.length; i++) {
    const [start, ...from] = sampleSessions[i - 1];
    const [end, ...to] = sampleSessions[i];
    const first = Date.parse(start);
    const last = Date.parse(end);
    for (let time = first + (i === 1 ? 0 : 86_400_000); time <= last; time += 86_400_000) {
      const day = new Date(time);
      if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
      const fraction = (time - first) / (last - first);
      for (const ticker of symbols) {
        const index = sampleSymbols.indexOf(ticker);
        history.push({ ticker, date: day.toISOString().slice(0, 10),
          priceCents: Math.round(from[index] + (to[index] - from[index]) * fraction) });
      }
    }
  }
  return history;
}

export async function historicalCloses(env: HostedBindings, tickers: string[]) {
  const symbols = sampleSymbols.filter(ticker => tickers.includes(ticker));
  if (!symbols.length) return [];
  if (configuredPricing(env).mode === "sample") return sampleCloses(symbols);
  const records = await env.DB.prepare(
    `SELECT ticker, date, price_cents AS priceCents FROM daily_closes WHERE ticker IN (${symbols.map(() => "?").join(",")})`
  ).bind(...symbols).all<{ ticker: string; date: string; priceCents: number }>();
  return records.results;
}
