import test from 'node:test';
import assert from 'node:assert/strict';
import { computeHoldings, summarizePortfolio, type PortfolioTransaction } from '../../backend/src/services/portfolio';

function trade(type: 'BUY' | 'SELL', quantity: number, priceCents: number, feeCents: number, date: string): PortfolioTransaction {
  return { ticker: 'AAPL', type, quantity, priceCents, feeCents, occurredAt: new Date(date) };
}

test('Average cost includes fees, partial sells, dividends and a chronological cost-basis trace', () => {
  const buysAndSell = [trade('BUY', 10, 10_000, 100, '2026-01-01'), trade('SELL', 4, 15_000, 200, '2026-02-01')];
  const { holdings, series } = computeHoldings(buysAndSell, [{ ticker: 'AAPL', amountCents: 250 }], { AAPL: { priceCents: 20_000, changeCents: 100 } });
  const summary = summarizePortfolio(holdings, series);
  assert.equal(holdings[0].quantity, 6);
  assert.equal(holdings[0].costBasisCents, 60_060);
  assert.equal(holdings[0].realizedPlCents, 19_760);
  assert.equal(holdings[0].unrealizedPlCents, 59_940);
  assert.equal(holdings[0].dividendsCents, 250);
  assert.deepEqual(series, [{ date: '2026-01-01', valueCents: 100_100, marketValueCents: null }, { date: '2026-02-01', valueCents: 60_060, marketValueCents: null }]);
  assert.equal(summary.totals.totalValueCents, 120_000);
  assert.equal(summary.totals.totalDividendsCents, 250);
});

test('Fractional shares, fully closed positions and an empty portfolio are handled', () => {
  const txs = [trade('BUY', 0.25, 10_000, 0, '2026-01-01'), trade('SELL', 0.25, 12_000, 0, '2026-02-01')];
  const result = computeHoldings(txs, [], {});
  assert.equal(result.holdings[0].quantity, 0);
  assert.equal(result.holdings[0].costBasisCents, 0);
  assert.equal(result.holdings[0].realizedPlCents, 500);
  const empty = computeHoldings([], [], {});
  assert.deepEqual(summarizePortfolio(empty.holdings, empty.series).totals, {totalValueCents:0,totalCostBasisCents:0,totalUnrealizedPlCents:0,totalRealizedPlCents:0,totalDividendsCents:0});
});

test('Daily moves use the previous close and preserve unavailable changes', () => {
  const tx = trade('BUY', 2, 10_000, 0, '2026-01-01');
  for (const [price, change, expected] of [
    [11_000, 1_000, 0.1], [9_000, -1_000, -0.1], [10_000, 0, 0],
    [10_000, null, null], [10_000, 10_000, null],
  ] as const) {
    const result = computeHoldings([tx], [], { AAPL: { priceCents: price, changeCents: change } });
    assert.equal(result.holdings[0].dailyChangePct, expected);
  }
});

test('Unpriced holdings preserve cost basis and do not contribute a fictitious loss', () => {
  const tx = trade('BUY', 1, 50_000, 0, '2026-01-05');
  const result = computeHoldings([tx, { ...tx, ticker: 'XYZ' }], [], { AAPL: { priceCents: 52_000, changeCents: 200 } });
  const summary = summarizePortfolio(result.holdings, result.series);
  assert.equal(summary.holdings[1].currentValueCents, null);
  assert.equal(summary.holdings[1].unrealizedPlCents, null);
  assert.deepEqual(summary.coverage, { priced: 1, open: 2 });
  assert.equal(summary.totals.totalCostBasisCents, 100_000);
  assert.equal(summary.totals.totalUnrealizedPlCents, 2_000);
  assert.equal(summary.allocation.length, 1);
});
