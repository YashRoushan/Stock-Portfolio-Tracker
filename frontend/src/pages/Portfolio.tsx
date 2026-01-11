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
  ResponsiveContainer
} from "recharts";
import Layout from "../components/Layout";
import { apiFetch } from "../api/client";
import { formatCurrency, formatPct } from "../lib/format";

const COLORS = ["#b5694a", "#7cc6a4", "#111415", "#d7b08c", "#4a6b8a", "#9b6f4a"];

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
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof Holding>("currentValueCents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [txForm, setTxForm] = useState({
    ticker: "",
    type: "BUY",
    quantity: 1,
    price: 0,
    fee: 0,
    occurredAt: new Date().toISOString().slice(0, 10)
  });

  const [divForm, setDivForm] = useState({
    ticker: "",
    amount: 0,
    occurredAt: new Date().toISOString().slice(0, 10)
  });

  const loadSummary = async () => {
    if (!id) {
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch<{ summary: Summary }>(`/api/portfolios/${id}/summary`);
      setSummary(response.summary);
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
    const response = await apiFetch<{ dividends: Dividend[] }>(`/api/dividends?portfolioId=${id}`);
    setDividends(response.dividends);
  };

  useEffect(() => {
    loadSummary();
    loadDividends();
  }, [id]);

  const submitTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) {
      return;
    }
    await apiFetch("/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        portfolioId: id,
        ticker: txForm.ticker,
        type: txForm.type,
        quantity: Number(txForm.quantity),
        price: Number(txForm.price),
        fee: Number(txForm.fee),
        occurredAt: new Date(txForm.occurredAt).toISOString()
      })
    });
    setTxForm({ ...txForm, ticker: "", price: 0, fee: 0, quantity: 1 });
    await loadSummary();
  };

  const submitDividend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) {
      return;
    }
    await apiFetch("/api/dividends", {
      method: "POST",
      body: JSON.stringify({
        portfolioId: id,
        ticker: divForm.ticker,
        amount: Number(divForm.amount),
        occurredAt: new Date(divForm.occurredAt).toISOString()
      })
    });
    setDivForm({ ...divForm, ticker: "", amount: 0 });
    await loadSummary();
    await loadDividends();
  };

  const holdings = useMemo(() => {
    if (!summary) {
      return [];
    }
    const filtered = summary.holdings.filter((holding) =>
      holding.ticker.toLowerCase().includes(search.toLowerCase())
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

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold">Portfolio details</h1>
            <p className="text-sm text-ink/60">Holdings computed from transactions</p>
          </div>
          <Link to="/" className="text-sm font-semibold text-ink">
            Back to dashboard
          </Link>
        </div>

        {loading ? <p className="text-sm text-ink/60">Loading portfolio...</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {summary ? (
          <section className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl bg-white/80 p-6 shadow-card">
              <h2 className="font-display text-lg font-semibold">KPIs</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Total value</span>
                  <span className="font-semibold">{formatCurrency(summary.totals.totalValueCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cost basis</span>
                  <span className="font-semibold">{formatCurrency(summary.totals.totalCostBasisCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Unrealized P/L</span>
                  <span className="font-semibold">{formatCurrency(summary.totals.totalUnrealizedPlCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Realized P/L</span>
                  <span className="font-semibold">{formatCurrency(summary.totals.totalRealizedPlCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Dividends</span>
                  <span className="font-semibold">{formatCurrency(summary.totals.totalDividendsCents)}</span>
                </div>
              </div>
            </div>
            <div className="rounded-3xl bg-white/80 p-6 shadow-card lg:col-span-2">
              <h2 className="font-display text-lg font-semibold">Portfolio value trend</h2>
              <p className="text-xs text-ink/50">Simplified series based on cost basis</p>
              <div className="mt-4 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.series}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line type="monotone" dataKey="valueCents" stroke="#b5694a" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        ) : null}

        {summary ? (
          <section className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl bg-white/80 p-6 shadow-card lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Holdings</h2>
                <input
                  className="rounded-full border border-ink/10 px-4 py-2 text-sm"
                  placeholder="Search ticker"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-ink/60">
                    <tr>
                      <th className="py-2">Ticker</th>
                      <th className="py-2">Qty</th>
                      <th className="py-2 cursor-pointer" onClick={() => toggleSort("avgCostCents")}>Avg cost</th>
                      <th className="py-2 cursor-pointer" onClick={() => toggleSort("currentValueCents")}>Value</th>
                      <th className="py-2 cursor-pointer" onClick={() => toggleSort("unrealizedPlCents")}>Unrealized</th>
                      <th className="py-2">Realized</th>
                      <th className="py-2">Daily</th>
                      <th className="py-2">Dividends</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((holding) => (
                      <tr key={holding.ticker} className="border-t border-ink/5">
                        <td className="py-3 font-semibold">{holding.ticker}</td>
                        <td className="py-3">{holding.quantity.toFixed(4)}</td>
                        <td className="py-3">{formatCurrency(holding.avgCostCents)}</td>
                        <td className="py-3">{formatCurrency(holding.currentValueCents)}</td>
                        <td className="py-3">{formatCurrency(holding.unrealizedPlCents)}</td>
                        <td className="py-3">{formatCurrency(holding.realizedPlCents)}</td>
                        <td className="py-3">
                          {formatCurrency(holding.dailyChangeCents)} ({formatPct(holding.dailyChangePct)})
                        </td>
                        <td className="py-3">{formatCurrency(holding.dividendsCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!holdings.length ? (
                  <p className="mt-4 text-sm text-ink/60">No holdings yet. Add a transaction.</p>
                ) : null}
              </div>
            </div>
            <div className="rounded-3xl bg-white/80 p-6 shadow-card">
              <h2 className="font-display text-lg font-semibold">Allocation</h2>
              <div className="mt-4 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={summary.allocation} dataKey="valueCents" nameKey="ticker" outerRadius={70}>
                      {summary.allocation.map((entry, index) => (
                        <Cell key={`cell-${entry.ticker}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
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

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-white/80 p-6 shadow-card">
            <h2 className="font-display text-lg font-semibold">Add transaction</h2>
            <form onSubmit={submitTransaction} className="mt-4 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  className="rounded-2xl border border-ink/10 px-4 py-3"
                  placeholder="Ticker"
                  value={txForm.ticker}
                  onChange={(e) => setTxForm({ ...txForm, ticker: e.target.value.toUpperCase() })}
                  required
                />
                <select
                  className="rounded-2xl border border-ink/10 px-4 py-3"
                  value={txForm.type}
                  onChange={(e) => setTxForm({ ...txForm, type: e.target.value })}
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <input
                  type="number"
                  step="0.0001"
                  className="rounded-2xl border border-ink/10 px-4 py-3"
                  placeholder="Quantity"
                  value={txForm.quantity}
                  onChange={(e) => setTxForm({ ...txForm, quantity: Number(e.target.value) })}
                />
                <input
                  type="number"
                  step="0.01"
                  className="rounded-2xl border border-ink/10 px-4 py-3"
                  placeholder="Price"
                  value={txForm.price}
                  onChange={(e) => setTxForm({ ...txForm, price: Number(e.target.value) })}
                />
                <input
                  type="number"
                  step="0.01"
                  className="rounded-2xl border border-ink/10 px-4 py-3"
                  placeholder="Fees"
                  value={txForm.fee}
                  onChange={(e) => setTxForm({ ...txForm, fee: Number(e.target.value) })}
                />
              </div>
              <input
                type="date"
                className="rounded-2xl border border-ink/10 px-4 py-3"
                value={txForm.occurredAt}
                onChange={(e) => setTxForm({ ...txForm, occurredAt: e.target.value })}
              />
              <button
                type="submit"
                className="rounded-full bg-ink px-6 py-3 text-sm font-semibold uppercase tracking-wide text-bone"
              >
                Save transaction
              </button>
            </form>
          </div>
          <div className="rounded-3xl bg-white/80 p-6 shadow-card">
            <h2 className="font-display text-lg font-semibold">Add dividend</h2>
            <form onSubmit={submitDividend} className="mt-4 grid gap-4">
              <input
                className="rounded-2xl border border-ink/10 px-4 py-3"
                placeholder="Ticker"
                value={divForm.ticker}
                onChange={(e) => setDivForm({ ...divForm, ticker: e.target.value.toUpperCase() })}
                required
              />
              <input
                type="number"
                step="0.01"
                className="rounded-2xl border border-ink/10 px-4 py-3"
                placeholder="Amount"
                value={divForm.amount}
                onChange={(e) => setDivForm({ ...divForm, amount: Number(e.target.value) })}
              />
              <input
                type="date"
                className="rounded-2xl border border-ink/10 px-4 py-3"
                value={divForm.occurredAt}
                onChange={(e) => setDivForm({ ...divForm, occurredAt: e.target.value })}
              />
              <button
                type="submit"
                className="rounded-full bg-ink px-6 py-3 text-sm font-semibold uppercase tracking-wide text-bone"
              >
                Save dividend
              </button>
            </form>
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-ink/70">Dividend history</h3>
              <div className="mt-3 space-y-2 text-sm">
                {dividends.length ? (
                  dividends.map((div) => (
                    <div key={div.id} className="flex justify-between">
                      <span>{div.ticker}</span>
                      <span>{formatCurrency(div.amountCents)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-ink/50">No dividends recorded yet.</p>
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
