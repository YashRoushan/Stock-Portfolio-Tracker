import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { createFetchMock, Miniflare } from "miniflare";

test("Licensed quote mode uses dated closes, shares a cache, and keeps missing prices unavailable", async () => {
  const mock = createFetchMock();
  mock.disableNetConnect();
  const token = "test-fixture-token";
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const closes = mock.get("https://api.tiingo.com");
  const headers = { authorization: `Token ${token}` };
  const query = { startDate: daysAgo(14), endDate: daysAgo(0) };
  closes.intercept({ path: "/tiingo/daily/aapl/prices", query, headers }).reply(200, [
    { date: `${daysAgo(4)}T00:00:00.000Z`, close: 121.18, adjClose: 99 },
    { date: `${daysAgo(1)}T00:00:00.000Z`, close: 123.45, adjClose: 100 },
    { date: "not-a-date", close: 500 },
  ]);
  closes.intercept({ path: "/tiingo/daily/msft/prices", query, headers }).reply(401, { detail: "Unauthorized" });
  const runtime = new Miniflare({
    cf: false, modules: true, scriptPath: "dist/server/index.js",
    compatibilityDate: "2026-06-01", d1Databases: ["DB"], fetchMock: mock,
    bindings: { JWT_SECRET: "stock-atlas-test-only-signing-secret", STOCK_PRICE_PROVIDER: "tiingo", TIINGO_API_TOKEN: token },
  });
  try {
    const db = await runtime.getD1Database("DB");
    for (const file of (await readdir("drizzle")).filter(name => name.endsWith(".sql")).sort()) {
      const sql = await readFile(`drizzle/${file}`, "utf8");
      await db.batch(sql.split("--> statement-breakpoint").map(statement => db.prepare(statement.trim())));
    }
    const base = "https://stock-atlas.test";
    const guest = await runtime.dispatchFetch(`${base}/api/auth/demo`, { method: "POST" });
    assert.equal(guest.status, 200);
    const auth = { Authorization: `Bearer ${(await guest.json() as { token: string }).token}` };
    const quotes = async () => {
      const response = await runtime.dispatchFetch(`${base}/api/prices?tickers=AAPL,MSFT,UNKNOWN,AAPL`, { headers: auth });
      assert.equal(response.status, 200);
      return await response.json() as { pricing: { mode: string; asOf: string }; prices: unknown[] };
    };
    const result = await quotes();
    mock.assertNoPendingInterceptors();
    assert.equal(result.pricing.mode, "end-of-day");
    assert.equal(result.pricing.asOf, daysAgo(1));
    assert.deepEqual(result.prices, [
      { ticker: "AAPL", priceCents: 12_345, changeCents: 227, tradingDay: daysAgo(1), available: true, source: "tiingo" },
      { ticker: "MSFT", priceCents: 0, changeCents: 0, available: false, source: "tiingo" },
      { ticker: "UNKNOWN", priceCents: 0, changeCents: 0, available: false, source: "tiingo" },
    ]);
    assert.deepEqual(await quotes(), result);

    const post = (path: string, body: unknown) => runtime.dispatchFetch(`${base}${path}`, {
      method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const portfolioResponse = await post("/api/portfolios", { name: "Market valuation fixture" });
    const { portfolio } = await portfolioResponse.json() as { portfolio: { id: string } };
    const trade = await post("/api/transactions", {
      portfolioId: portfolio.id, ticker: "AAPL", type: "BUY", quantity: 3, price: 100, fee: 0,
      occurredAt: `${daysAgo(4)}T00:00:00.000Z`,
    });
    assert.equal(trade.status, 201);
    const summaryResponse = await runtime.dispatchFetch(`${base}/api/portfolios/${portfolio.id}/summary`, { headers: auth });
    const { summary } = await summaryResponse.json() as { summary: { totals: { totalValueCents: number } } };
    assert.equal(summary.totals.totalValueCents, 37_035);
  } finally {
    await runtime.dispose();
    await mock.close();
  }
});
