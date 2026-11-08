import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { apiFetch } from "../api/client";
import PriceDisclosure, { type Pricing } from "../components/PriceDisclosure";
import { formatCurrency, formatPct } from "../lib/format";

type Portfolio = { id: string; name: string };

type Summary = {
  holdings: Array<{ quantity: number; currentPriceCents: number }>;
  totals: {
    totalValueCents: number;
    totalCostBasisCents: number;
    totalUnrealizedPlCents: number;
    totalRealizedPlCents: number;
    totalDividendsCents: number;
  };
};

const DashboardPage = () => {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pricing, setPricing] = useState<Pricing>();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadPortfolios = async () => {
    setLoading(true);
    try {
      const response = await apiFetch<{ portfolios: Portfolio[] }>(
        "/api/portfolios",
      );
      setPortfolios(response.portfolios);
      if (response.portfolios.length && !selectedId) {
        setSelectedId(response.portfolios[0].id);
      }
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolios();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setSummary(null);
    setPricing(undefined);
    apiFetch<{ summary: Summary; pricing?: Pricing }>(`/api/portfolios/${selectedId}/summary`)
      .then((response) => {
        if (active) {
          setSummary(response.summary);
          setPricing(response.pricing);
        }
      })
      .catch((err) => {
        if (active) setError((err as Error).message);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selectedPortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.id === selectedId),
    [portfolios, selectedId],
  );

  const createPortfolio = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const response = await apiFetch<{ portfolio: Portfolio }>(
        "/api/portfolios",
        {
          method: "POST",
          body: JSON.stringify({ name: name.trim() }),
        },
      );
      setName("");
      setPortfolios((prev) => [response.portfolio, ...prev]);
      setSelectedId(response.portfolio.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const hasMissingQuotes = summary?.holdings.some(
    (holding) => holding.quantity > 0 && holding.currentPriceCents <= 0,
  );

  return (
    <Layout>
      <div className="space-y-8">
        <h1 className="font-display text-3xl font-semibold">Your portfolios</h1>
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl bg-white/80 p-6 shadow-card">
            <h2 className="font-display text-xl font-semibold">Portfolios</h2>
            {loading ? (
              <p className="mt-4 text-sm text-ink/70">Loading portfolios...</p>
            ) : portfolios.length ? (
              <ul className="mt-4 space-y-3">
                {portfolios.map((portfolio) => (
                  <li key={portfolio.id}>
                    <button
                      onClick={() => setSelectedId(portfolio.id)}
                      className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                        selectedId === portfolio.id
                          ? "bg-ink text-bone"
                          : "border border-ink/10 bg-white"
                      }`}
                    >
                      {portfolio.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-ink/70">
                No portfolios yet. Create your first one.
              </p>
            )}
            {error ? (
              <p role="alert" className="mt-4 text-sm text-red-700">
                {error}
              </p>
            ) : null}
          </div>
          <div className="rounded-3xl bg-white/80 p-6 shadow-card lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">Overview</h2>
                <p className="text-sm text-ink/70">
                  Overview for{" "}
                  {selectedPortfolio?.name || "—"}
                </p>
              </div>
              {selectedId ? (
                <Link
                  to={`/portfolio/${selectedId}`}
                  className="rounded-full bg-ink px-4 py-2 text-xs font-semibold uppercase tracking-wide text-bone"
                >
                  View details
                </Link>
              ) : null}
            </div>
            <div className="mt-3"><PriceDisclosure pricing={pricing} /></div>
            {summary ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-fog p-4">
                  <p className="text-xs uppercase tracking-wide text-ink/70">
                    {pricing?.mode === "sample" ? "Sample valuation" : "Total value"}
                  </p>
                  <p className="mt-2 font-display text-2xl font-semibold">
                    {hasMissingQuotes
                      ? "Unavailable"
                      : formatCurrency(summary.totals.totalValueCents)}
                  </p>
                </div>
                <div className="rounded-2xl bg-fog p-4">
                  <p className="text-xs uppercase tracking-wide text-ink/70">
                    Unrealized P/L
                  </p>
                  <p className="mt-2 font-display text-2xl font-semibold">
                    {hasMissingQuotes
                      ? "Unavailable"
                      : formatCurrency(summary.totals.totalUnrealizedPlCents)}
                  </p>
                </div>
                <div className="rounded-2xl bg-fog p-4">
                  <p className="text-xs uppercase tracking-wide text-ink/70">
                    Realized P/L
                  </p>
                  <p className="mt-2 font-display text-2xl font-semibold">
                    {formatCurrency(summary.totals.totalRealizedPlCents)}
                  </p>
                </div>
                <div className="rounded-2xl bg-fog p-4">
                  <p className="text-xs uppercase tracking-wide text-ink/70">
                    Dividends
                  </p>
                  <p className="mt-2 font-display text-2xl font-semibold">
                    {formatCurrency(summary.totals.totalDividendsCents)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-6 text-sm text-ink/70">
                Select a portfolio to see metrics.
              </p>
            )}
          </div>
        </section>
        {hasMissingQuotes ? (
          <p className="text-sm text-ink/70" role="status">
            Some holdings have no available quote. Their cost basis remains
            available; valuation and unrealised return need a price.
          </p>
        ) : null}

        <section className="rounded-3xl bg-white/80 p-6 shadow-card">
          <h2 className="font-display text-xl font-semibold">
            Create portfolio
          </h2>
          <form
            onSubmit={createPortfolio}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <input
              aria-label="Portfolio name"
              maxLength={100}
              required
              className="min-w-0 flex-1 rounded-2xl border border-ink/10 px-4 py-3"
              placeholder="e.g. Long-term investing"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="submit"
              disabled={creating}
              className="rounded-full bg-ink px-6 py-3 text-sm font-semibold uppercase tracking-wide text-bone"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </form>
          {summary ? (
            <p className="mt-4 text-xs text-ink/70">
              Cost basis: {formatCurrency(summary.totals.totalCostBasisCents)} ·
              Unrealised return:{" "}
              {hasMissingQuotes
                ? "Unavailable"
                : formatPct(
                    summary.totals.totalCostBasisCents
                      ? (summary.totals.totalValueCents -
                          summary.totals.totalCostBasisCents) /
                          summary.totals.totalCostBasisCents
                      : 0,
                  )}
            </p>
          ) : null}
        </section>
      </div>
    </Layout>
  );
};

export default DashboardPage;
