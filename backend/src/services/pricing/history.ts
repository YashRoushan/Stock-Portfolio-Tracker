import prisma from "../../prisma";
import type { DailyClose } from "../portfolio";

const refreshAfter = new Map<string, number>();
const refreshes = new Map<string, Promise<void>>();

async function refresh(ticker: string) {
  const fmp = process.env.MARKET_DATA_PROVIDER?.toLowerCase() === "fmp";
  const key = fmp ? process.env.FMP_API_KEY : process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) return;
  const url = fmp
    ? new URL("https://financialmodelingprep.com/stable/historical-price-eod/full")
    : new URL("https://www.alphavantage.co/query");
  url.searchParams.set("apikey", key);
  url.searchParams.set("symbol", ticker);
  if (!fmp) url.searchParams.set("function", "TIME_SERIES_DAILY");

  let observations: Array<{ date: string; close: unknown }>;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return;
    const data = await response.json();
    observations = fmp ? data : Object.entries(data["Time Series (Daily)"] ?? {}).map(([date, row]) =>
      ({ date, close: (row as Record<string, unknown>)["4. close"] }));
    if (!Array.isArray(observations)) return;
  } catch {
    return; // Previously stored sessions remain available if the provider is down.
  }

  const closes = observations.flatMap(row => {
    const priceCents = Math.round(Number(row?.close) * 100);
    return row && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isSafeInteger(priceCents) && priceCents > 0
      ? [{ ticker, date: row.date, priceCents }] : [];
  });
  if (closes.length) await prisma.dailyClose.createMany({ data: closes, skipDuplicates: true });
}

export async function historicalCloses(tickers: string[]): Promise<DailyClose[]> {
  for (const ticker of tickers) {
    let task = refreshes.get(ticker);
    if (!task && Date.now() >= (refreshAfter.get(ticker) ?? 0)) {
      refreshAfter.set(ticker, Date.now() + 6 * 3600_000);
      task = refresh(ticker).finally(() => refreshes.delete(ticker));
      refreshes.set(ticker, task);
    }
    await task;
  }
  return prisma.dailyClose.findMany({ where: { ticker: { in: tickers } } });
}
