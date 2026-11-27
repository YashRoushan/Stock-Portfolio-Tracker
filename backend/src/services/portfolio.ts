export type PortfolioTransaction = {
  ticker: string;
  type: "BUY" | "SELL";
  quantity: number | { toString(): string };
  priceCents: number;
  feeCents: number;
  occurredAt: Date;
};
export type PortfolioDividend = { ticker: string; amountCents: number };

import { mulCents } from "../utils/money";
import { toDateKey } from "../utils/date";

export type HoldingMetrics = {
  ticker: string;
  quantity: number;
  avgCostCents: number;
  costBasisCents: number;
  currentPriceCents: number | null;
  currentValueCents: number | null;
  unrealizedPlCents: number | null;
  realizedPlCents: number;
  dailyChangeCents: number | null;
  dailyChangePct: number | null;
  dividendsCents: number;
};

export type DailyClose = { ticker: string; date: string; priceCents: number };
export type HistoryPoint = { date: string; valueCents: number; marketValueCents: number | null };
export type PortfolioSummary = {
  holdings: HoldingMetrics[];
  totals: {
    totalValueCents: number;
    totalCostBasisCents: number;
    totalUnrealizedPlCents: number;
    totalRealizedPlCents: number;
    totalDividendsCents: number;
  };
  coverage: { priced: number; open: number };
  allocation: Array<{ ticker: string; valueCents: number; pct: number }>;
  series: HistoryPoint[];
};

type PriceMap = Record<string, { priceCents: number; changeCents: number | null }>;

const roundShares = (quantity: number) => Math.round(quantity * 1_000_000) / 1_000_000;
const toNumber = (value: unknown): number => Number(value);

export const computeHoldings = (
  transactions: PortfolioTransaction[],
  dividends: PortfolioDividend[],
  prices: PriceMap,
  closes: DailyClose[] = []
): { holdings: HoldingMetrics[]; series: HistoryPoint[] } => {
  const grouped = new Map<string, PortfolioTransaction[]>();
  for (const tx of transactions) {
    const ticker = tx.ticker.toUpperCase();
    if (!grouped.has(ticker)) {
      grouped.set(ticker, []);
    }
    grouped.get(ticker)?.push(tx);
  }

  const dividendByTicker = dividends.reduce<Record<string, number>>((acc, div) => {
    const ticker = div.ticker.toUpperCase();
    acc[ticker] = (acc[ticker] || 0) + div.amountCents;
    return acc;
  }, {});

  const holdings: HoldingMetrics[] = [];

  for (const [ticker, txs] of grouped.entries()) {
    const sorted = [...txs].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    let quantity = 0;
    let costBasisCents = 0;
    let realizedPlCents = 0;

    for (const tx of sorted) {
      const qty = toNumber(tx.quantity);
      const gross = mulCents(tx.priceCents, qty);
      if (tx.type === "BUY") {
        quantity = roundShares(quantity + qty);
        costBasisCents += gross + tx.feeCents;
      } else {
        const avgCostCents = quantity ? costBasisCents / quantity : 0;
        const removedCost = Math.round(avgCostCents * qty);
        const proceeds = gross - tx.feeCents;
        realizedPlCents += proceeds - removedCost;
        costBasisCents -= removedCost;
        quantity = roundShares(quantity - qty);
      }
    }

    const avgCostCents = quantity ? Math.round(costBasisCents / quantity) : 0;
    const quote = prices[ticker];
    const price = quote?.priceCents > 0 ? quote.priceCents : null;
    const change = price === null ? null : quote.changeCents;
    const previousClose = price !== null && change !== null ? price - change : 0;
    const currentValueCents = quantity === 0 ? 0 : price === null ? null : mulCents(price, quantity);
    const unrealizedPlCents = currentValueCents === null ? null : currentValueCents - costBasisCents;
    const dailyChangeCents = change === null ? null : mulCents(change, quantity);
    const dailyChangePct = previousClose > 0 && change !== null && quantity > 0 ? change / previousClose : null;

    holdings.push({
      ticker,
      quantity,
      avgCostCents,
      costBasisCents,
      currentPriceCents: price,
      currentValueCents,
      unrealizedPlCents,
      realizedPlCents,
      dailyChangeCents,
      dailyChangePct,
      dividendsCents: dividendByTicker[ticker] || 0
    });
  }

  const series = computeHistory(transactions, closes);

  return { holdings, series };
};

export const summarizePortfolio = (
  holdings: HoldingMetrics[],
  series: HistoryPoint[]
): PortfolioSummary => {
  const totalValueCents = holdings.reduce((sum, holding) => sum + (holding.currentValueCents ?? 0), 0);
  const totalCostBasisCents = holdings.reduce((sum, holding) => sum + holding.costBasisCents, 0);
  const totalUnrealizedPlCents = holdings.reduce((sum, holding) => sum + (holding.unrealizedPlCents ?? 0), 0);
  const totalRealizedPlCents = holdings.reduce((sum, holding) => sum + holding.realizedPlCents, 0);
  const totalDividendsCents = holdings.reduce((sum, holding) => sum + holding.dividendsCents, 0);

  const priced = holdings.filter(h => h.quantity > 0 && h.currentValueCents !== null);
  const allocation = priced.map((holding) => {
    const pct = totalValueCents ? holding.currentValueCents! / totalValueCents : 0;
    return { ticker: holding.ticker, valueCents: holding.currentValueCents!, pct };
  });

  return {
    holdings,
    totals: {
      totalValueCents,
      totalCostBasisCents,
      totalUnrealizedPlCents,
      totalRealizedPlCents,
      totalDividendsCents
    },
    coverage: { priced: priced.length, open: holdings.filter(h => h.quantity > 0).length },
    allocation,
    series
  };
};

const computeHistory = (transactions: PortfolioTransaction[], closes: DailyClose[]): HistoryPoint[] => {
  const sorted = [...transactions].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const byDate = new Map<string, PortfolioTransaction[]>();

  for (const tx of sorted) {
    const key = toDateKey(tx.occurredAt);
    if (!byDate.has(key)) {
      byDate.set(key, []);
    }
    byDate.get(key)?.push(tx);
  }

  const dailyPrices = new Map<string, Map<string, number>>();
  const firstDay = sorted.length ? toDateKey(sorted[0].occurredAt) : null;
  for (const close of closes) {
    if (!firstDay || close.date < firstDay) continue;
    if (!dailyPrices.has(close.date)) dailyPrices.set(close.date, new Map());
    dailyPrices.get(close.date)!.set(close.ticker, close.priceCents);
  }
  const dates = [...new Set([...byDate.keys(), ...dailyPrices.keys()])].sort();
  const quantityByTicker: Record<string, { qty: number; costBasisCents: number }> = Object.create(null);
  const series: HistoryPoint[] = [];

  for (const date of dates) {
    const txs = byDate.get(date) ?? [];
    for (const tx of txs) {
      const ticker = tx.ticker.toUpperCase();
      if (!quantityByTicker[ticker]) {
        quantityByTicker[ticker] = { qty: 0, costBasisCents: 0 };
      }
      const record = quantityByTicker[ticker];
      const qty = toNumber(tx.quantity);
      const gross = mulCents(tx.priceCents, qty);

      if (tx.type === "BUY") {
        record.qty = roundShares(record.qty + qty);
        record.costBasisCents += gross + tx.feeCents;
      } else {
        const avgCostCents = record.qty ? record.costBasisCents / record.qty : 0;
        const removedCost = Math.round(avgCostCents * qty);
        record.costBasisCents -= removedCost;
        record.qty = roundShares(record.qty - qty);
      }
    }

    const totalCostBasis = Object.values(quantityByTicker).reduce(
      (sum, item) => sum + item.costBasisCents,
      0
    );
    let marketValueCents: number | null = 0;
    for (const [ticker, position] of Object.entries(quantityByTicker)) {
      if (!position.qty) continue;
      const close = dailyPrices.get(date)?.get(ticker);
      if (close === undefined) {
        marketValueCents = null;
        break;
      }
      marketValueCents += mulCents(close, position.qty);
    }
    series.push({ date, valueCents: totalCostBasis, marketValueCents });
  }

  return series;
};
