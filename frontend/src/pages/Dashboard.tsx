import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { apiFetch } from "../api/client";
import { formatCurrency, formatPct } from "../lib/format";

type Portfolio = { id: string; name: string };

type Summary = {
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
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPortfolios = async () => {
    setLoading(true);
    try {
      const response = await apiFetch<{ portfolios: Portfolio[] }>("/api/portfolios");
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

  const loadSummary = async (portfolioId: string) => {
    const response = await apiFetch<{ summary: Summary }>(`/api/portfolios/${portfolioId}/summary`);
    setSummary(response.summary);
  };

  useEffect(() => {
    loadPortfolios();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadSummary(selectedId).catch(() => null);
    }
  }, [selectedId]);

  const selectedPortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.id === selectedId),
    [portfolios, selectedId]
  );

  const createPortfolio = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    const response = await apiFetch<{ portfolio: Portfolio }>("/api/portfolios", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    setName("");
    setPortfolios((prev) => [response.portfolio, ...prev]);
    setSelectedId(response.portfolio.id);
  };

  return (
    <Layout>
      <div className="space-y-8">
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl bg-white/80 p-6 shadow-card">
            <h2 className="font-display text-xl font-semibold">Portfolios</h2>
            {loading ? (
              <p className="mt-4 text-sm text-ink/60">Loading portfolios...</p>
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
              <p className="mt-4 text-sm text-ink/60">No portfolios yet. Create your first one.</p>
            )}
            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
          </div>
          <div className="rounded-3xl bg-white/80 p-6 shadow-card lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-semibold">Overview</h2>
                <p className="text-sm text-ink/60">Live snapshot for {selectedPortfolio?.name || "-"}</p>
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
            {summary ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-fog p-4">
                  <p className="text-xs uppercase tracking-wide text-ink/50">Total value</p>
                  <p className="mt-2 font-display text-2xl font-semibold">
                    {formatCurrency(summary.totals.totalValueCents)}
                  </p>
                </div>
                <div className="rounded-2xl bg-fog p-4">
                  <p className="text-xs uppercase tracking-wide text-ink/50">Unrealized P/L</p>
                  <p className="mt-2 font-display text-2xl font-semibold">
                    {formatCurrency(summary.totals.totalUnrealizedPlCents)}
                  </p>
                </div>
                <div className="rounded-2xl bg-fog p-4">
                  <p className="text-xs uppercase tracking-wide text-ink/50">Realized P/L</p>
                  <p className="mt-2 font-display text-2xl font-semibold">
                    {formatCurrency(summary.totals.totalRealizedPlCents)}
                  </p>
                </div>
                <div className="rounded-2xl bg-fog p-4">
                  <p className="text-xs uppercase tracking-wide text-ink/50">Dividends</p>
                  <p className="mt-2 font-display text-2xl font-semibold">
                    {formatCurrency(summary.totals.totalDividendsCents)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-6 text-sm text-ink/60">Select a portfolio to see metrics.</p>
            )}
          </div>
        </section>

        <section className="rounded-3xl bg-white/80 p-6 shadow-card">
          <h2 className="font-display text-xl font-semibold">Create portfolio</h2>
          <form onSubmit={createPortfolio} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              className="flex-1 rounded-2xl border border-ink/10 px-4 py-3"
              placeholder="TFSA, Long term, Crypto..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-full bg-ink px-6 py-3 text-sm font-semibold uppercase tracking-wide text-bone"
            >
              Create
            </button>
          </form>
          {summary ? (
            <p className="mt-4 text-xs text-ink/50">
              Cost basis: {formatCurrency(summary.totals.totalCostBasisCents)} · Total return: {formatPct(
                summary.totals.totalCostBasisCents
                  ? (summary.totals.totalValueCents - summary.totals.totalCostBasisCents) /
                      summary.totals.totalCostBasisCents
                  : 0
              )}
            </p>
          ) : null}
        </section>
      </div>
    </Layout>
  );
};

export default DashboardPage;
