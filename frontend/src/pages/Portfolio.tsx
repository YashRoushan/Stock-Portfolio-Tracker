import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import Layout from "../components/Layout";
import { apiFetch, isHostedDemo } from "../api/client";
import PriceDisclosure, { type Pricing } from "../components/PriceDisclosure";
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
  currentPriceCents: number;
  currentValueCents: number;
  unrealizedPlCents: number;
  realizedPlCents: number;
  dailyChangeCents: number;
  dailyChangePct: number;
  dividendsCents: number;
};

type Summary = {
  holdings: Holding[];
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

type Dividend = {
  id: string;
  ticker: string;
  amountCents: number;
  occurredAt: string;
};

const PortfolioPage = () => {
  const { id } = useParams();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pricing, setPricing] = useState<Pricing>();
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof Holding>("currentValueCents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [savingDividend, setSavingDividend] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState("");
  const [dividendStatus, setDividendStatus] = useState("");

  const [txForm, setTxForm] = useState({
    ticker: "",
    type: "BUY",
    quantity: 1,
    price: 0,
    fee: 0,
    occurredAt: new Date().toISOString().slice(0, 10),
  });

  const [divForm, setDivForm] = useState({
    ticker: "",
    amount: 0,
    occurredAt: new Date().toISOString().slice(0, 10),
  });

  const loadSummary = async () => {
    if (!id) {
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch<{ summary: Summary; pricing?: Pricing }>(
        `/api/portfolios/${id}/summary`,
      );
      setSummary(response.summary);
      setPricing(response.pricing);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadDividends = async () => {
    if (!id) {
      return;
    }
    const response = await apiFetch<{ dividends: Dividend[] }>(
      `/api/dividends?portfolioId=${id}`,
    );
    setDividends(response.dividends);
  };

  useEffect(() => {
    loadSummary();
    loadDividends().catch((err) => setError((err as Error).message));
  }, [id]);

  const submitTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) {
      return;
    }
    setSavingTransaction(true);
    setTransactionStatus("");
    try {
      await apiFetch("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          portfolioId: id,
          ticker: txForm.ticker,
          type: txForm.type,
          quantity: Number(txForm.quantity),
          price: Number(txForm.price),
          fee: Number(txForm.fee),
          occurredAt: new Date(txForm.occurredAt).toISOString(),
        }),
      });
      setTxForm({ ...txForm, ticker: "", price: 0, fee: 0, quantity: 1 });
      await loadSummary();
      setTransactionStatus("Transaction saved.");
    } catch (err) {
      setTransactionStatus((err as Error).message);
    } finally {
      setSavingTransaction(false);
    }
  };

  const submitDividend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) {
      return;
    }
    setSavingDividend(true);
    setDividendStatus("");
    try {
      await apiFetch("/api/dividends", {
        method: "POST",
        body: JSON.stringify({
          portfolioId: id,
          ticker: divForm.ticker,
          amount: Number(divForm.amount),
          occurredAt: new Date(divForm.occurredAt).toISOString(),
        }),
      });
      setDivForm({ ...divForm, ticker: "", amount: 0 });
      await Promise.all([loadSummary(), loadDividends()]);
      setDividendStatus("Dividend saved.");
    } catch (err) {
      setDividendStatus((err as Error).message);
    } finally {
      setSavingDividend(false);
    }
  };

  const holdings = useMemo(() => {
    if (!summary) {
      return [];
    }
    const filtered = summary.holdings.filter((holding) =>
      holding.ticker.toLowerCase().includes(search.toLowerCase()),
    );
    const sorted = [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
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

  const hasMissingQuotes = summary?.holdings.some(
    (holding) => holding.quantity > 0 && holding.currentPriceCents <= 0,
  );

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">
              Portfolio details
            </h1>
            <p className="text-sm text-ink/70">
              Holdings computed from transactions
            </p>
          </div>
          <Link to="/" className="text-sm font-semibold text-ink">
            Back to dashboard
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-ink/70">Loading portfolio...</p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <PriceDisclosure pricing={pricing} />
        {summary ? (
          <section className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl bg-white/80 p-6 shadow-card">
              <h2 className="font-display text-lg font-semibold">KPIs</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>
                    {pricing?.mode === "sample" ? "Sample valuation" : "Total value"}
                  </span>
                  <span className="font-semibold">
                    {hasMissingQuotes
                      ? "Unavailable"
                      : formatCurrency(summary.totals.totalValueCents)}
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
                    {hasMissingQuotes
                      ? "Unavailable"
                      : formatCurrency(summary.totals.totalUnrealizedPlCents)}
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
            <div className="rounded-3xl bg-white/80 p-6 shadow-card lg:col-span-2">
              <h2 className="font-display text-lg font-semibold">
                Cost-basis history
              </h2>
              <p className="text-xs text-ink/70">
                Cost basis after trades, including fees · USD
              </p>
              <div
                className="mt-4 h-48"
                role="img"
                aria-label="Cost basis over transaction dates, in US dollars"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.series}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="valueCents"
                      stroke="#b5694a"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        ) : null}

        {summary ? (
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
              {hasMissingQuotes ? (
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
                          {holding.currentPriceCents > 0 ||
                          holding.quantity === 0
                            ? formatCurrency(holding.currentValueCents)
                            : "Unavailable"}
                        </td>
                        <td className="py-3">
                          {holding.currentPriceCents > 0 ||
                          holding.quantity === 0
                            ? formatCurrency(holding.unrealizedPlCents)
                            : "Unavailable"}
                        </td>
                        <td className="py-3">
                          {formatCurrency(holding.realizedPlCents)}
                        </td>
                        <td className="py-3">
                          {holding.currentPriceCents > 0 ? (
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
                    No holdings yet. Add a transaction.
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
                      outerRadius={70}
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
        ) : null}

        <datalist id="sample-tickers">
          {["AAPL", "MSFT", "VTI", "GOOGL", "NVDA"].map((ticker) => (
            <option key={ticker} value={ticker} />
          ))}
        </datalist>
        {isHostedDemo ? (
          <p className="text-sm text-ink/70">
            The hosted valuation feed covers AAPL, MSFT, VTI, GOOGL and NVDA.
            Transaction prices are entered in USD.
          </p>
        ) : null}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-white/80 p-6 shadow-card">
            <h2 className="font-display text-lg font-semibold">
              Add transaction
            </h2>
            <form onSubmit={submitTransaction} className="mt-4 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-ink/70">
                  Ticker
                  <input
                    className="rounded-2xl border border-ink/10 px-4 py-3"
                    placeholder="Ticker"
                    aria-label="Transaction ticker"
                    maxLength={12}
                    list="sample-tickers"
                    value={txForm.ticker}
                    onChange={(e) =>
                      setTxForm({
                        ...txForm,
                        ticker: e.target.value.toUpperCase(),
                      })
                    }
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-ink/70">
                  Type
                  <select
                    className="rounded-2xl border border-ink/10 px-4 py-3"
                    aria-label="Transaction type"
                    value={txForm.type}
                    onChange={(e) =>
                      setTxForm({ ...txForm, type: e.target.value })
                    }
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="grid gap-2 text-sm font-semibold text-ink/70">
                  Quantity
                  <input
                    type="number"
                    step="0.000001"
                    className="rounded-2xl border border-ink/10 px-4 py-3"
                    placeholder="Quantity"
                    aria-label="Quantity"
                    min="0.000001"
                    required
                    value={txForm.quantity}
                    onChange={(e) =>
                      setTxForm({ ...txForm, quantity: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-ink/70">
                  Price per share · USD
                  <input
                    type="number"
                    step="0.01"
                    className="rounded-2xl border border-ink/10 px-4 py-3"
                    placeholder="Price"
                    aria-label="Price per share in US dollars"
                    min="0.01"
                    required
                    value={txForm.price}
                    onChange={(e) =>
                      setTxForm({ ...txForm, price: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-ink/70">
                  Fees · USD
                  <input
                    type="number"
                    step="0.01"
                    className="rounded-2xl border border-ink/10 px-4 py-3"
                    placeholder="Fees"
                    aria-label="Fees in US dollars"
                    min="0"
                    required
                    value={txForm.fee}
                    onChange={(e) =>
                      setTxForm({ ...txForm, fee: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-ink/70">
                Transaction date
                <input
                  type="date"
                  className="rounded-2xl border border-ink/10 px-4 py-3"
                  aria-label="Transaction date"
                  required
                  value={txForm.occurredAt}
                  onChange={(e) =>
                    setTxForm({ ...txForm, occurredAt: e.target.value })
                  }
                />
              </label>
              <button
                type="submit"
                disabled={savingTransaction}
                className="rounded-full bg-ink px-6 py-3 text-sm font-semibold uppercase tracking-wide text-bone"
              >
                {savingTransaction ? "Saving…" : "Save transaction"}
              </button>
              <p role="status" className="text-sm text-ink/80">
                {transactionStatus}
              </p>
            </form>
          </div>
          <div className="rounded-3xl bg-white/80 p-6 shadow-card">
            <h2 className="font-display text-lg font-semibold">Add dividend</h2>
            <form onSubmit={submitDividend} className="mt-4 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-ink/70">
                Ticker
                <input
                  className="rounded-2xl border border-ink/10 px-4 py-3"
                  placeholder="Ticker"
                  aria-label="Dividend ticker"
                  maxLength={12}
                  list="sample-tickers"
                  value={divForm.ticker}
                  onChange={(e) =>
                    setDivForm({
                      ...divForm,
                      ticker: e.target.value.toUpperCase(),
                    })
                  }
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink/70">
                Dividend amount · USD
                <input
                  type="number"
                  step="0.01"
                  className="rounded-2xl border border-ink/10 px-4 py-3"
                  placeholder="Amount"
                  aria-label="Dividend amount in US dollars"
                  min="0.01"
                  required
                  value={divForm.amount}
                  onChange={(e) =>
                    setDivForm({ ...divForm, amount: Number(e.target.value) })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink/70">
                Dividend date
                <input
                  type="date"
                  className="rounded-2xl border border-ink/10 px-4 py-3"
                  aria-label="Dividend date"
                  required
                  value={divForm.occurredAt}
                  onChange={(e) =>
                    setDivForm({ ...divForm, occurredAt: e.target.value })
                  }
                />
              </label>
              <button
                type="submit"
                disabled={savingDividend}
                className="rounded-full bg-ink px-6 py-3 text-sm font-semibold uppercase tracking-wide text-bone"
              >
                {savingDividend ? "Saving…" : "Save dividend"}
              </button>
              <p role="status" className="text-sm text-ink/80">
                {dividendStatus}
              </p>
            </form>
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-ink/70">
                Dividend history
              </h3>
              <div className="mt-3 space-y-2 text-sm">
                {dividends.length ? (
                  dividends.map((div) => (
                    <div key={div.id} className="flex justify-between">
                      <span>{div.ticker}</span>
                      <span>{formatCurrency(div.amountCents)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-ink/70">
                    No dividends recorded yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default PortfolioPage;
