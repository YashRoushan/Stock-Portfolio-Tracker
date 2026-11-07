import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { isHostedDemo } from "../api/client";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const guest = user?.email.endsWith("@demo.invalid");

  return (
    <div className="min-h-screen bg-grid">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 rounded-3xl bg-white/80 px-5 py-4 shadow-card sm:px-6">
          <div>
            <Link
              to="/"
              className="font-display text-2xl font-semibold text-ink"
            >
              Stock Atlas
            </Link>
            <p className="text-sm text-ink/70">
              Stock Portfolio Tracker · Yash Roushan
            </p>
          </div>
          {user ? (
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="max-w-[13rem] truncate text-sm text-ink/70"
                title={guest ? undefined : user.email}
              >
                {guest ? "Your demo workspace" : user.email}
              </span>
              <button
                onClick={logout}
                className="shrink-0 rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold text-ink transition hover:border-ink/40"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>
      {isHostedDemo ? (
        <aside
          aria-label="Demo information"
          className="mx-auto mb-6 w-[calc(100%_-_2rem)] max-w-6xl rounded-2xl border border-copper/25 bg-white/80 px-5 py-4 text-sm text-ink/80 sm:w-[calc(100%_-_3rem)]"
        >
          <p>
            <strong className="font-semibold text-ink">
              Interactive demo · Sample prices in USD
            </strong>
          </p>
          <p className="mt-1">
            Portfolios, trades and dividends are saved in your own workspace.
            Use example data while exploring.
          </p>
          {guest ? <p className="mt-1">This browser remembers your demo for up to seven days. Signing out starts fresh.</p> : null}
        </aside>
      ) : null}
      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6"
        tabIndex={-1}
      >
        {children}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-sm text-ink/70 sm:px-6">
        <a
          className="font-semibold underline underline-offset-4"
          href="https://yashroushan.github.io/portfolio-website/engineering/"
        >
          Yash Roushan’s portfolio
        </a>
        <span aria-hidden="true"> · </span>
        <a
          className="underline underline-offset-4"
          href="https://github.com/YashRoushan/Stock-Portfolio-Tracker"
        >
          Project source
        </a>
      </footer>
    </div>
  );
};

export default Layout;
