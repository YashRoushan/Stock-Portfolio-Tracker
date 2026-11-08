import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { computeHoldings, summarizePortfolio } from "../../backend/src/services/portfolio";
import { authenticate, hashPassword, issueToken, limitAuthentication, passwordMatches, sessionUser, type ApiEnvironment } from "./auth";
import { configuredPricing, portfolioQuotes } from "./quotes";
import { credentialsSchema, dividendSchema, portfolioSchema, transactionSchema } from "./validation";
import type { DividendRow, PortfolioRow, SessionUser, TransactionRow, UserRow } from "./types";
import type { Context } from "hono";

const api = new Hono<ApiEnvironment>({ strict: false });
const maximumTransactions = 1_000;
const maximumDividends = 1_000;
const maximumPortfolios = 20;

api.use("/api/*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  const origin = c.req.header("Origin");
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) && origin && origin !== new URL(c.req.url).origin) {
    return c.json({ error: "Cross-origin writes are not allowed." }, 403);
  }
  return next();
});
api.use("/api/*", bodyLimit({ maxSize: 16_384, onError: (c) => c.json({ error: "Request is too large." }, 413) }));
api.use("/api/auth/*", limitAuthentication);

async function readBody<Schema extends z.ZodTypeAny>(c: Context<ApiEnvironment>, schema: Schema): Promise<z.infer<Schema>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Send a valid JSON request body." });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues[0]?.message || "Invalid input." });
  return parsed.data;
}

function publicPortfolio(row: PortfolioRow) {
  return { id: row.id, name: row.name, userId: row.user_id, createdAt: row.created_at };
}

function publicTransaction(row: TransactionRow) {
  return {
    id: row.id, portfolioId: row.portfolio_id, userId: row.user_id, ticker: row.ticker,
    type: row.type, quantity: row.quantity_micros / 1_000_000, priceCents: row.price_cents,
    feeCents: row.fee_cents, occurredAt: new Date(row.occurred_at), createdAt: new Date(row.created_at),
  };
}

function publicDividend(row: DividendRow) {
  return {
    id: row.id, portfolioId: row.portfolio_id, userId: row.user_id, ticker: row.ticker,
    amountCents: row.amount_cents, occurredAt: new Date(row.occurred_at), createdAt: new Date(row.created_at),
  };
}

async function requirePortfolio(c: Context<ApiEnvironment>, id: string) {
  if (!z.string().uuid().safeParse(id).success) throw new HTTPException(404, { message: "Portfolio not found." });
  const portfolio = await c.env.DB.prepare(
    "SELECT id, name, user_id, created_at FROM portfolios WHERE id = ? AND user_id = ?",
  ).bind(id, c.get("user").id).first<PortfolioRow>();
  if (!portfolio) throw new HTTPException(404, { message: "Portfolio not found." });
  return portfolio;
}

async function authResponse(c: Context<ApiEnvironment>, user: SessionUser) {
  return c.json({ token: await issueToken(user, c.env.JWT_SECRET), user });
}

api.get("/api/health", async (c) => {
  await c.env.DB.prepare("SELECT 1 AS healthy").first();
  return c.json({ status: "ok", database: "D1", mode: "demo", pricing: configuredPricing(c.env) });
});

api.post("/api/auth/register", async (c) => {
  const input = await readBody(c, credentialsSchema);
  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(input.email).first();
  if (existing) return c.json({ error: "Email already registered." }, 400);
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password);
  try {
    await c.env.DB.prepare(
      "INSERT INTO users (id, email, password_hash, is_demo, created_at) VALUES (?, ?, ?, 0, ?)",
    ).bind(id, input.email, passwordHash, new Date().toISOString()).run();
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed: users.email")) {
      return c.json({ error: "Email already registered." }, 400);
    }
    throw error;
  }
  return authResponse(c, { id, email: input.email, isDemo: false });
});

api.post("/api/auth/login", async (c) => {
  const input = await readBody(c, credentialsSchema);
  const row = await c.env.DB.prepare(
    "SELECT id, email, password_hash, is_demo, expires_at FROM users WHERE email = ? AND is_demo = 0",
  ).bind(input.email).first<UserRow>();
  // A fixed valid hash keeps the password work comparable for unknown addresses.
  const dummyHash = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
  const matches = await passwordMatches(input.password, row?.password_hash || dummyHash);
  if (!row || !matches) return c.json({ error: "Invalid credentials." }, 400);
  return authResponse(c, sessionUser(row));
});

api.post("/api/auth/demo", async (c) => {
  const id = crypto.randomUUID();
  const email = `guest-${id}@demo.invalid`;
  const portfolioId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString();
  const trades = [
    ["AAPL", "BUY", 40, 18000, "2026-01-15"],
    ["MSFT", "BUY", 20, 38000, "2026-01-20"],
    ["VTI", "BUY", 30, 25000, "2026-02-10"],
    ["GOOGL", "BUY", 20, 16000, "2026-03-01"],
    ["AAPL", "BUY", 10, 19000, "2026-03-15"],
    ["NVDA", "BUY", 40, 11000, "2026-04-10"],
    ["AAPL", "SELL", 5, 20000, "2026-06-15"],
  ] as const;
  const dividends = [["AAPL", 1250], ["MSFT", 5000], ["VTI", 7500]] as const;
  const statements = [
    c.env.DB.prepare(
      "INSERT INTO users (id, email, password_hash, is_demo, expires_at, created_at) VALUES (?, ?, NULL, 1, ?, ?)",
    ).bind(id, email, expiresAt, createdAt),
    c.env.DB.prepare("INSERT INTO portfolios (id, name, user_id, created_at) VALUES (?, ?, ?, ?)")
      .bind(portfolioId, "Sample portfolio", id, createdAt),
    ...trades.map(([ticker, type, quantity, priceCents, date]) => c.env.DB.prepare(
      `INSERT INTO transactions
        (id, portfolio_id, user_id, ticker, type, quantity_micros, price_cents, fee_cents, occurred_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    ).bind(crypto.randomUUID(), portfolioId, id, ticker, type, quantity * 1_000_000, priceCents, `${date}T00:00:00.000Z`, createdAt)),
    ...dividends.map(([ticker, amount]) => c.env.DB.prepare(
      `INSERT INTO dividends (id, portfolio_id, user_id, ticker, amount_cents, occurred_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), portfolioId, id, ticker, amount, "2026-07-01T00:00:00.000Z", createdAt)),
  ];
  // D1 batch is one atomic transaction: a visitor gets the complete seed or no account.
  await c.env.DB.batch(statements);
  await c.env.DB.prepare(
    `DELETE FROM users WHERE id IN
     (SELECT id FROM users WHERE is_demo = 1 AND expires_at < ? ORDER BY expires_at LIMIT 20)`,
  ).bind(createdAt).run();
  return authResponse(c, { id, email, isDemo: true });
});

// Authenticate the entire data API, including the exact collection URLs.
api.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/health" || c.req.path.startsWith("/api/auth/")) return next();
  return authenticate(c, next);
});

api.get("/api/auth/me", authenticate, (c) => c.json({ user: c.get("user") }));

api.get("/api/portfolios", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, name, user_id, created_at FROM portfolios WHERE user_id = ? ORDER BY created_at DESC, id",
  ).bind(c.get("user").id).all<PortfolioRow>();
  return c.json({ portfolios: rows.results.map(publicPortfolio) });
});

api.post("/api/portfolios", async (c) => {
  const input = await readBody(c, portfolioSchema);
  const userId = c.get("user").id;
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const result = await c.env.DB.prepare(
    `INSERT INTO portfolios (id, name, user_id, created_at) SELECT ?, ?, ?, ?
     WHERE (SELECT COUNT(*) FROM portfolios WHERE user_id = ?) < ?`,
  ).bind(id, input.name, userId, createdAt, userId, maximumPortfolios).run();
  if (!result.meta.changes) return c.json({ error: "This demo allows up to 20 portfolios per workspace." }, 409);
  return c.json({ portfolio: { id, name: input.name, userId, createdAt } }, 201);
});

api.get("/api/portfolios/:id", async (c) => {
  return c.json({ portfolio: publicPortfolio(await requirePortfolio(c, c.req.param("id"))) });
});

api.get("/api/portfolios/:id/summary", async (c) => {
  const portfolio = await requirePortfolio(c, c.req.param("id"));
  const userId = c.get("user").id;
  const [transactions, dividends] = await c.env.DB.batch([
    c.env.DB.prepare(
      "SELECT * FROM transactions WHERE portfolio_id = ? AND user_id = ? ORDER BY occurred_at ASC, sequence ASC",
    ).bind(portfolio.id, userId),
    c.env.DB.prepare(
      "SELECT * FROM dividends WHERE portfolio_id = ? AND user_id = ? ORDER BY occurred_at ASC, id ASC",
    ).bind(portfolio.id, userId),
  ]);
  const transactionRows = transactions.results as unknown as TransactionRow[];
  const dividendRows = dividends.results as unknown as DividendRow[];
  const tickers = transactionRows.map((row) => row.ticker);
  const { prices, pricing } = await portfolioQuotes(c.env, tickers);
  const priceMap = Object.fromEntries(prices.map((quote) => [quote.ticker, quote]));
  const result = computeHoldings(transactionRows.map(publicTransaction), dividendRows.map(publicDividend), priceMap);
  return c.json({ summary: summarizePortfolio(result.holdings, result.series), pricing });
});

api.get("/api/transactions", async (c) => {
  const portfolioId = c.req.query("portfolioId");
  if (portfolioId) await requirePortfolio(c, portfolioId);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM transactions WHERE user_id = ? ${portfolioId ? "AND portfolio_id = ?" : ""}
     ORDER BY occurred_at DESC, sequence DESC`,
  ).bind(c.get("user").id, ...(portfolioId ? [portfolioId] : [])).all<TransactionRow>();
  return c.json({ transactions: rows.results.map(publicTransaction) });
});

api.post("/api/transactions", async (c) => {
  const input = await readBody(c, transactionSchema);
  await requirePortfolio(c, input.portfolioId);
  const userId = c.get("user").id;
  const id = crypto.randomUUID();
  const quantityMicros = Math.round(input.quantity * 1_000_000);
  const priceCents = Math.round(input.price * 100);
  const feeCents = Math.round(input.fee * 100);
  const createdAt = new Date().toISOString();
  // The inventory check and insert share one SQLite statement. Concurrent sales
  // cannot spend the same shares. Future prefixes also protect backdated sales.
  const result = await c.env.DB.prepare(
    `INSERT INTO transactions
       (id, portfolio_id, user_id, ticker, type, quantity_micros, price_cents, fee_cents, occurred_at, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     WHERE EXISTS (SELECT 1 FROM portfolios WHERE id = ? AND user_id = ?)
       AND (SELECT COUNT(*) FROM transactions WHERE user_id = ?) < ?
       AND (? = 'BUY' OR (
         COALESCE((SELECT SUM(CASE WHEN type = 'BUY' THEN quantity_micros ELSE -quantity_micros END)
           FROM transactions WHERE portfolio_id = ? AND user_id = ? AND ticker = ? AND occurred_at <= ?), 0) >= ?
         AND NOT EXISTS (
           SELECT 1 FROM (
             SELECT occurred_at,
               SUM(CASE WHEN type = 'BUY' THEN quantity_micros ELSE -quantity_micros END)
                 OVER (ORDER BY occurred_at, sequence ROWS UNBOUNDED PRECEDING) AS balance
             FROM transactions WHERE portfolio_id = ? AND user_id = ? AND ticker = ?
           ) AS future_ledger WHERE occurred_at > ? AND balance < ?
         )
       ))`,
  ).bind(
    id, input.portfolioId, userId, input.ticker, input.type, quantityMicros, priceCents, feeCents, input.occurredAt, createdAt,
    input.portfolioId, userId, userId, maximumTransactions, input.type,
    input.portfolioId, userId, input.ticker, input.occurredAt, quantityMicros,
    input.portfolioId, userId, input.ticker, input.occurredAt, quantityMicros,
  ).run();
  if (!result.meta.changes) {
    const count = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM transactions WHERE user_id = ?")
      .bind(userId).first<{ count: number }>();
    if (count && count.count >= maximumTransactions) {
      return c.json({ error: "This demo allows up to 1,000 transactions per workspace." }, 409);
    }
    return c.json({ error: "This sale would exceed the shares available on that date or leave a later sale without enough shares." }, 409);
  }
  return c.json({ transaction: {
    id, portfolioId: input.portfolioId, userId, ticker: input.ticker, type: input.type,
    quantity: quantityMicros / 1_000_000, priceCents, feeCents, occurredAt: input.occurredAt, createdAt,
  } }, 201);
});

api.get("/api/dividends", async (c) => {
  const portfolioId = c.req.query("portfolioId");
  if (portfolioId) await requirePortfolio(c, portfolioId);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM dividends WHERE user_id = ? ${portfolioId ? "AND portfolio_id = ?" : ""}
     ORDER BY occurred_at DESC, id DESC`,
  ).bind(c.get("user").id, ...(portfolioId ? [portfolioId] : [])).all<DividendRow>();
  return c.json({ dividends: rows.results.map(publicDividend) });
});

api.post("/api/dividends", async (c) => {
  const input = await readBody(c, dividendSchema);
  await requirePortfolio(c, input.portfolioId);
  const userId = c.get("user").id;
  const id = crypto.randomUUID();
  const amountCents = Math.round(input.amount * 100);
  const createdAt = new Date().toISOString();
  const result = await c.env.DB.prepare(
    `INSERT INTO dividends (id, portfolio_id, user_id, ticker, amount_cents, occurred_at, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ?
     WHERE EXISTS (SELECT 1 FROM portfolios WHERE id = ? AND user_id = ?)
       AND (SELECT COUNT(*) FROM dividends WHERE user_id = ?) < ?`,
  ).bind(id, input.portfolioId, userId, input.ticker, amountCents, input.occurredAt, createdAt,
    input.portfolioId, userId, userId, maximumDividends).run();
  if (!result.meta.changes) return c.json({ error: "This demo allows up to 1,000 dividend entries per workspace." }, 409);
  return c.json({ dividend: {
    id, portfolioId: input.portfolioId, userId, ticker: input.ticker, amountCents, occurredAt: input.occurredAt, createdAt,
  } }, 201);
});

api.get("/api/dividends/:ticker", (c) => {
  return c.json({ dividends: [], pricing: configuredPricing(c.env) });
});

api.get("/api/prices", async (c) => {
  const query = c.req.query("tickers");
  if (!query || query.length > 500) return c.json({ error: "Provide a comma-separated ticker list." }, 400);
  const tickers = query.split(",").map((ticker) => ticker.trim().toUpperCase());
  if (tickers.length > 25 || tickers.some((ticker) => !/^[A-Z0-9.^=-]{1,12}$/.test(ticker))) {
    return c.json({ error: "Provide up to 25 valid ticker symbols." }, 400);
  }
  return c.json(await portfolioQuotes(c.env, tickers));
});

api.notFound((c) => c.json({ error: "API route not found." }, 404));
api.onError((error, c) => {
  if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
  console.error("Portfolio API request failed", error instanceof Error ? error.name : "UnknownError");
  return c.json({ error: "The request could not be completed. Please try again." }, 500);
});

export default api;
