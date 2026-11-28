import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PortfolioOverview, { type Summary } from "../components/PortfolioOverview";
import Layout from "../components/Layout";
import { apiFetch, isHostedDemo } from "../api/client";
import PriceDisclosure, { type Pricing } from "../components/PriceDisclosure";
import { formatCurrency } from "../lib/format";

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
        {summary && <PortfolioOverview summary={summary} pricing={pricing} />}

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
