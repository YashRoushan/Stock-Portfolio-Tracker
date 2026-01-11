import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useAuth } from "../hooks/useAuth";

const RegisterPage = () => {
  const { register } = useAuth();
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
      await register(email, password);
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
          <h1 className="font-display text-3xl font-semibold text-ink">Create your account</h1>
          <p className="mt-2 text-ink/60">Start tracking long-term growth and income streams.</p>
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
              {loading ? "Creating..." : "Register"}
            </button>
          </form>
          <p className="mt-6 text-sm text-ink/60">
            Already have an account? <Link to="/login" className="font-semibold text-ink">Sign in</Link>
          </p>
        </div>
        <div className="rounded-3xl bg-ink p-10 text-bone shadow-card">
          <h2 className="font-display text-2xl font-semibold">What you get</h2>
          <ul className="mt-6 space-y-4 text-sm text-bone/80">
            <li>Portfolio KPI dashboard and trend charts</li>
            <li>Transaction-driven holdings calculations</li>
            <li>Allocation insights per holding</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default RegisterPage;
