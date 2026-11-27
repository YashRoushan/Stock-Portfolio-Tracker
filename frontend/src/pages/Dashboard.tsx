import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PerformanceChart, {
  type HistoryPoint,
} from "../components/PerformanceChart";
import Layout from "../components/Layout";
import { apiFetch } from "../api/client";
import PriceDisclosure, { type Pricing } from "../components/PriceDisclosure";
import { formatCurrency } from "../lib/format";

type Portfolio = { id: string; name: string };

type Summary = {
  series: HistoryPoint[];
  coverage: { priced: number; open: number };
  holdings: Array<{ quantity: number; currentPriceCents: number | null }>;
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
    apiFetch<{ summary: Summary; pricing?: Pricing }>(
      `/api/portfolios/${selectedId}/summary`,
    )
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

  const partial = summary && summary.coverage.priced < summary.coverage.open;
  const unpriced = partial && summary.coverage.priced === 0;
  const coverage = partial
    ? `Partial · ${summary.coverage.priced} of ${summary.coverage.open} open holdings priced`
    : "";

  return (
    <Layout>
      <div className="space-y-8">
        <div className="workspace-heading">
          <div>
            <h1>Portfolio overview</h1>
            <p>Holdings, income and performance in USD</p>
          </div>
          {portfolios.length > 0 && (
            <label>
              Portfolio
              <select
                aria-label="Select portfolio"
                value={selectedId ?? ""}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {summary ? (
          <>
            <section className="value-panel">
              <div>
                <p className="value-label">
                  {pricing?.mode === "sample"
                    ? "Illustrative holdings value"
                    : "Holdings value"}
                </p>
                <p className="portfolio-value">
                  {formatCurrency(
                    unpriced ? null : summary.totals.totalValueCents,
                  )}
                </p>
                <p>{coverage || selectedPortfolio?.name}</p>
              </div>
              <Link className="details-link" to={`/portfolio/${selectedId}`}>
                View holdings <span aria-hidden="true">→</span>
              </Link>
            </section>
            <div className="dashboard-metrics">
              {(
                [
                  ["Cost basis", summary.totals.totalCostBasisCents],
                  [
                    partial ? "Unrealised P/L · partial" : "Unrealised P/L",
                    unpriced ? null : summary.totals.totalUnrealizedPlCents,
                  ],
                  ["Realised P/L", summary.totals.totalRealizedPlCents],
                  ["Dividend income", summary.totals.totalDividendsCents],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <p>{label}</p>
                  <strong>{formatCurrency(value)}</strong>
                </div>
              ))}
            </div>
            <PerformanceChart
              series={summary.series}
              sample={pricing?.mode === "sample"}
            />
            <PriceDisclosure pricing={pricing} />
          </>
        ) : (
          <p className="text-sm text-ink/70">
            {loading || (selectedId && !error)
              ? "Loading portfolio…"
              : "Create a portfolio to get started."}
          </p>
        )}
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
        </section>
      </div>
    </Layout>
  );
};

export default DashboardPage;
