import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useAuth } from "../hooks/useAuth";

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <Layout>
      <div className="mx-auto mt-12 grid max-w-4xl gap-10 lg:grid-cols-2">
        <div className="rounded-3xl bg-white/80 p-10 shadow-card">
          <h1 className="font-display text-3xl font-semibold text-ink">Welcome back</h1>
          <p className="mt-2 text-ink/60">Track portfolios, dividends, and daily moves in one place.</p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-semibold text-ink/70">Email</label>
              <input
                type="email"
                className="mt-2 w-full rounded-2xl border border-ink/10 px-4 py-3"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink/70">Password</label>
              <input
                type="password"
                className="mt-2 w-full rounded-2xl border border-ink/10 px-4 py-3"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              className="w-full rounded-full bg-ink px-6 py-3 text-sm font-semibold uppercase tracking-wide text-bone transition hover:bg-ink/90"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>
          <p className="mt-6 text-sm text-ink/60">
            New here? <Link to="/register" className="font-semibold text-ink">Create an account</Link>
          </p>
        </div>
        <div className="rounded-3xl bg-gradient-to-br from-copper via-clay to-mint p-10 text-bone shadow-card">
          <h2 className="font-display text-2xl font-semibold">Real-time clarity</h2>
          <ul className="mt-6 space-y-4 text-sm text-bone/90">
            <li>Live pricing with cached refreshes</li>
            <li>Holdings and allocation metrics updated per trade</li>
            <li>Dividend tracking baked into every portfolio</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default LoginPage;
