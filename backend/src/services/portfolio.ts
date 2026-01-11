import { Transaction, TransactionType, Dividend } from "@prisma/client";
import { mulCents } from "../utils/money";
import { toDateKey } from "../utils/date";

export type HoldingMetrics = {
  ticker: string;
  quantity: number;
  avgCostCents: number;
  costBasisCents: number;
  currentPriceCents: number;
  currentValueCents: number;
  unrealizedPlCents: number;
  realizedPlCents: number;
  dailyChangeCents: number;
  dailyChangePct: number;
  dividendsCents: number;
};

export type PortfolioSummary = {
  holdings: HoldingMetrics[];
  totals: {
    totalValueCents: number;
    totalCostBasisCents: number;
    totalUnrealizedPlCents: number;
    totalRealizedPlCents: number;
    totalDividendsCents: number;
  };
  allocation: Array<{ ticker: string; valueCents: number; pct: number }>;
  series: Array<{ date: string; valueCents: number }>;
};

type PriceMap = Record<string, { priceCents: number; changeCents: number }>;

const toNumber = (value: unknown): number => Number(value);

export const computeHoldings = (
  transactions: Transaction[],
  dividends: Dividend[],
  prices: PriceMap
): { holdings: HoldingMetrics[]; series: Array<{ date: string; valueCents: number }> } => {
  const grouped = new Map<string, Transaction[]>();
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
      if (tx.type === TransactionType.BUY) {
        quantity += qty;
        costBasisCents += gross + tx.feeCents;
      } else {
        const avgCostCents = quantity ? costBasisCents / quantity : 0;
        const removedCost = Math.round(avgCostCents * qty);
        const proceeds = gross - tx.feeCents;
        realizedPlCents += proceeds - removedCost;
        costBasisCents -= removedCost;
        quantity -= qty;
      }
    }

    const avgCostCents = quantity ? Math.round(costBasisCents / quantity) : 0;
    const price = prices[ticker]?.priceCents || 0;
    const change = prices[ticker]?.changeCents || 0;
    const currentValueCents = mulCents(price, quantity);
    const unrealizedPlCents = currentValueCents - costBasisCents;
    const dailyChangeCents = mulCents(change, quantity);
    const dailyChangePct = currentValueCents
      ? dailyChangeCents / currentValueCents
      : 0;

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

  const series = computeSimplifiedSeries(transactions);

  return { holdings, series };
};

export const summarizePortfolio = (
  holdings: HoldingMetrics[],
  series: Array<{ date: string; valueCents: number }>
): PortfolioSummary => {
  const totalValueCents = holdings.reduce((sum, holding) => sum + holding.currentValueCents, 0);
  const totalCostBasisCents = holdings.reduce((sum, holding) => sum + holding.costBasisCents, 0);
  const totalUnrealizedPlCents = holdings.reduce((sum, holding) => sum + holding.unrealizedPlCents, 0);
  const totalRealizedPlCents = holdings.reduce((sum, holding) => sum + holding.realizedPlCents, 0);
  const totalDividendsCents = holdings.reduce((sum, holding) => sum + holding.dividendsCents, 0);

  const allocation = holdings.map((holding) => {
    const pct = totalValueCents ? holding.currentValueCents / totalValueCents : 0;
    return { ticker: holding.ticker, valueCents: holding.currentValueCents, pct };
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
    allocation,
    series
  };
};

const computeSimplifiedSeries = (transactions: Transaction[]): Array<{ date: string; valueCents: number }> => {
  const sorted = [...transactions].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const byDate = new Map<string, Transaction[]>();

  for (const tx of sorted) {
    const key = toDateKey(tx.occurredAt);
    if (!byDate.has(key)) {
      byDate.set(key, []);
    }
    byDate.get(key)?.push(tx);
  }

  let quantityByTicker: Record<string, { qty: number; costBasisCents: number }> = {};
  const series: Array<{ date: string; valueCents: number }> = [];

  for (const [date, txs] of byDate.entries()) {
    for (const tx of txs) {
      const ticker = tx.ticker.toUpperCase();
      if (!quantityByTicker[ticker]) {
        quantityByTicker[ticker] = { qty: 0, costBasisCents: 0 };
      }
      const record = quantityByTicker[ticker];
      const qty = toNumber(tx.quantity);
      const gross = mulCents(tx.priceCents, qty);

      if (tx.type === TransactionType.BUY) {
        record.qty += qty;
        record.costBasisCents += gross + tx.feeCents;
      } else {
        const avgCostCents = record.qty ? record.costBasisCents / record.qty : 0;
        const removedCost = Math.round(avgCostCents * qty);
        record.costBasisCents -= removedCost;
        record.qty -= qty;
      }
    }

    const totalCostBasis = Object.values(quantityByTicker).reduce(
      (sum, item) => sum + item.costBasisCents,
      0
    );
    series.push({ date, valueCents: totalCostBasis });
  }

  return series;
};
