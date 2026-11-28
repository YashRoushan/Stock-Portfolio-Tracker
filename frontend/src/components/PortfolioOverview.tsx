import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import PerformanceChart, { type HistoryPoint } from "./PerformanceChart";
import type { Pricing } from "./PriceDisclosure";
import { formatCurrency, formatPct } from "../lib/format";

const COLORS = [
  "#b5694a",
  "#7cc6a4",
  "#111415",
  "#d7b08c",
  "#4a6b8a",
  "#9b6f4a",
];

type Holding = {
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

export type Summary = {
  coverage: { priced: number; open: number };
  holdings: Holding[];
  totals: {
    totalValueCents: number;
    totalCostBasisCents: number;
    totalUnrealizedPlCents: number;
    totalRealizedPlCents: number;
    totalDividendsCents: number;
  };
  allocation: Array<{ ticker: string; valueCents: number; pct: number }>;
  series: HistoryPoint[];
};

export default function PortfolioOverview({ summary, pricing }: { summary: Summary; pricing?: Pricing }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof Holding>("currentValueCents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const holdings = useMemo(() => {
    const filtered = summary.holdings.filter((holding) =>
      holding.ticker.toLowerCase().includes(search.toLowerCase()),
    );
    const sorted = [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === null) return bVal === null ? 0 : 1;
      if (bVal === null) return -1;
      if (aVal < bVal) {
        return sortDir === "asc" ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortDir === "asc" ? 1 : -1;
      }
      return 0;
    });
    return sorted;
  }, [summary, search, sortKey, sortDir]);

  const toggleSort = (key: keyof Holding) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const partial = summary.coverage.priced < summary.coverage.open;
  const unpriced = partial && summary.coverage.priced === 0;
  const coverage = partial ? `Partial · ${summary.coverage.priced} of ${summary.coverage.open} open holdings priced` : "";

  return (
    <>
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl bg-white/80 p-6 shadow-card">
          <h2 className="font-display text-lg font-semibold">Portfolio summary</h2>
          {coverage && <p className="text-xs text-ink/70">{coverage} · value and unrealised P/L are partial.</p>}
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span>
                {pricing?.mode === "sample" ? "Sample valuation" : "Total value"}
              </span>
              <span className="font-semibold">
                {formatCurrency(unpriced ? null : summary.totals.totalValueCents)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Cost basis</span>
              <span className="font-semibold">
                {formatCurrency(summary.totals.totalCostBasisCents)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Unrealized P/L</span>
              <span className="font-semibold">
                {formatCurrency(unpriced ? null : summary.totals.totalUnrealizedPlCents)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Realized P/L</span>
              <span className="font-semibold">
                {formatCurrency(summary.totals.totalRealizedPlCents)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Dividends</span>
              <span className="font-semibold">
                {formatCurrency(summary.totals.totalDividendsCents)}
              </span>
            </div>
          </div>
        </div>
        <div className="lg:col-span-2"><PerformanceChart series={summary.series} sample={pricing?.mode === "sample"} /></div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl bg-white/80 p-6 shadow-card lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Holdings</h2>
            <input
              aria-label="Search holdings by ticker"
              className="w-full min-w-0 rounded-full border border-ink/10 px-4 py-2 text-sm sm:w-44"
              placeholder="Search ticker"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {partial ? (
            <p className="mt-3 text-sm text-ink/70">
              Some tickers have no available quote. Allocation includes
              priced holdings only.
            </p>
          ) : null}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink/70">
                <tr>
                  <th className="py-2">Ticker</th>
                  <th className="py-2">Qty</th>
                  <th
                    className="py-2"
                    aria-sort={
                      sortKey === "avgCostCents"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort("avgCostCents")}
                      aria-label="Sort by average cost"
                    >
                      Avg cost
                    </button>
                  </th>
                  <th
                    className="py-2"
                    aria-sort={
                      sortKey === "currentValueCents"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort("currentValueCents")}
                      aria-label="Sort by value"
                    >
                      Value
                    </button>
                  </th>
                  <th
                    className="py-2"
                    aria-sort={
                      sortKey === "unrealizedPlCents"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort("unrealizedPlCents")}
                      aria-label="Sort by unrealised profit or loss"
                    >
                      Unrealised
                    </button>
                  </th>
                  <th className="py-2">Realized</th>
                  <th className="py-2">
                    {pricing?.mode === "sample" ? "Sample change" : "Daily"}
                  </th>
                  <th className="py-2">Dividends</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => (
                  <tr
                    key={holding.ticker}
                    className="border-t border-ink/5"
                  >
                    <td className="py-3 font-semibold">{holding.ticker}</td>
                    <td className="py-3">{holding.quantity.toFixed(4)}</td>
                    <td className="py-3">
                      {formatCurrency(holding.avgCostCents)}
                    </td>
                    <td className="py-3">
                      {formatCurrency(holding.currentValueCents)}
                    </td>
                    <td className="py-3">
                      {formatCurrency(holding.unrealizedPlCents)}
                    </td>
                    <td className="py-3">
                      {formatCurrency(holding.realizedPlCents)}
                    </td>
                    <td className="py-3">
                      {holding.dailyChangeCents !== null ? (
                        <>
                          {formatCurrency(holding.dailyChangeCents)} (
                          {formatPct(holding.dailyChangePct)})
                        </>
                      ) : (
                        "Unavailable"
                      )}
                    </td>
                    <td className="py-3">
                      {formatCurrency(holding.dividendsCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!holdings.length ? (
              <p className="mt-4 text-sm text-ink/70">
                {search ? "No holdings match this ticker." : "No holdings yet."}
              </p>
            ) : null}
          </div>
        </div>
        <div className="rounded-3xl bg-white/80 p-6 shadow-card">
          <h2 className="font-display text-lg font-semibold">Allocation</h2>
          <div
            className="mt-4 h-48"
            role="img"
            aria-label="Allocation of quoted holdings"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={summary.allocation}
                  dataKey="valueCents"
                  nameKey="ticker"
                  innerRadius={48}
                  outerRadius={76}
                >
                  {summary.allocation.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.ticker}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2 text-xs">
            {summary.allocation.map((entry) => (
              <div key={entry.ticker} className="flex justify-between">
                <span>{entry.ticker}</span>
                <span>{formatPct(entry.pct)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
