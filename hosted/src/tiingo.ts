type DailyClose = { date: string; close: number };
const lookback = 14 * 24 * 60 * 60 * 1_000;

export async function fetchTiingoClose(
  ticker: string,
  token: string,
  now: Date,
  request: typeof fetch = fetch,
) {
  const endDate = now.toISOString().slice(0, 10);
  const startDate = new Date(+now - lookback).toISOString().slice(0, 10);
  const url = new URL(`https://api.tiingo.com/tiingo/daily/${encodeURIComponent(ticker.toLowerCase())}/prices`);
  url.search = new URLSearchParams({ startDate, endDate }).toString();

  try {
    const response = await request(url, {
      headers: { Authorization: `Token ${token}`, Accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return null;

    const closes = new Map<string, number>();
    for (const candidate of payload as Partial<DailyClose>[]) {
      if (!candidate || typeof candidate.date !== "string" || typeof candidate.close !== "number") continue;
      const tradingDay = candidate.date.slice(0, 10);
      const price = Math.round(candidate.close * 100);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tradingDay) || tradingDay < startDate || tradingDay > endDate ||
          !Number.isSafeInteger(price) || price <= 0) continue;
      closes.set(tradingDay, price);
    }
    const [current, previous] = [...closes].sort(([left], [right]) => right.localeCompare(left));
    if (!current || !previous) return null;
    return { tradingDay: current[0], priceCents: current[1], changeCents: current[1] - previous[1] };
  } catch {
    // Never include upstream errors or request credentials in a public response.
    return null;
  }
}
