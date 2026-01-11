import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-grid">
      <header className="px-6 py-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-3xl bg-white/70 px-6 py-4 shadow-card backdrop-blur">
          <div>
            <Link to="/" className="font-display text-2xl font-semibold text-ink">
              Stock Atlas
            </Link>
            <p className="text-sm text-ink/60">Portfolio tracker with live pricing</p>
          </div>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-ink/70">{user.email}</span>
              <button
                onClick={logout}
                className="rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-ink transition hover:border-ink/40"
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 pb-16">{children}</main>
    </div>
  );
};

export default Layout;
