import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { isHostedDemo } from "../api/client";

const LoginPage = () => {
  const { login, demo } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const startDemo = async () => {
    setError(null);
    setDemoLoading(true);
    try {
      await demo();
      navigate("/");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not start the demo. Try again.",
      );
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto mt-6 grid max-w-4xl gap-6 sm:mt-10 sm:gap-10 lg:grid-cols-2">
        <div className="rounded-3xl bg-white/80 p-6 sm:p-10 shadow-card">
          <h1 className="font-display text-3xl font-semibold text-ink">
            Explore your portfolio
          </h1>
          <p className="mt-2 text-ink/70">
            Track holdings, trades and dividend income in one place.
          </p>
          {isHostedDemo ? (
            <div className="mt-6 rounded-2xl border border-copper/20 bg-bone p-4">
              <button
                type="button"
                onClick={startDemo}
                disabled={loading || demoLoading}
                className="w-full rounded-full bg-ink px-6 py-3 text-sm font-semibold text-bone transition hover:bg-ink/90"
              >
                {demoLoading ? "Preparing your workspace…" : "Try the demo"}
              </button>
              <p className="mt-3 text-sm text-ink/70">
                Open a sample portfolio and add your own trades. No email
                address needed.
              </p>
            </div>
          ) : null}
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="text-sm font-semibold text-ink/70"
              >
                Email
              </label>
              <input
                id="login-email"
                autoComplete="email"
                type="email"
                className="mt-2 w-full rounded-2xl border border-ink/10 px-4 py-3"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="text-sm font-semibold text-ink/70"
              >
                Password
              </label>
              <input
                id="login-password"
                autoComplete="current-password"
                type="password"
                className="mt-2 w-full rounded-2xl border border-ink/10 px-4 py-3"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              className="w-full rounded-full bg-ink px-6 py-3 text-sm font-semibold uppercase tracking-wide text-bone transition hover:bg-ink/90"
              disabled={loading || demoLoading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="mt-6 text-sm text-ink/70">
            New here?{" "}
            <Link to="/register" className="font-semibold text-ink">
              Create an account
            </Link>
          </p>
        </div>
        <div className="rounded-3xl bg-ink p-6 sm:p-10 text-bone shadow-card">
          <h2 className="font-display text-2xl font-semibold">
            See the whole portfolio
          </h2>
          <ul className="mt-6 space-y-4 text-sm text-bone/90">
            <li>Buy and sell transactions with average-cost accounting</li>
            <li>Holdings and allocation metrics updated per trade</li>
            <li>Manual dividend records and cost-basis charts</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default LoginPage;
