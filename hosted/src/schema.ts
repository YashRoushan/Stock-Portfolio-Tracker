import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  isDemo: integer("is_demo").notNull().default(0),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("users_expiry_idx").on(table.isDemo, table.expiresAt)]);

export const portfolios = sqliteTable("portfolios", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("portfolios_user_idx").on(table.userId),
  uniqueIndex("portfolios_id_user_idx").on(table.id, table.userId),
]);

export const transactions = sqliteTable("transactions", {
  sequence: integer("sequence").primaryKey({ autoIncrement: true }),
  id: text("id").notNull().unique(),
  portfolioId: text("portfolio_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ticker: text("ticker").notNull(),
  type: text("type", { enum: ["BUY", "SELL"] }).notNull(),
  quantityMicros: integer("quantity_micros").notNull(),
  priceCents: integer("price_cents").notNull(),
  feeCents: integer("fee_cents").notNull(),
  occurredAt: text("occurred_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  foreignKey({ columns: [table.portfolioId, table.userId], foreignColumns: [portfolios.id, portfolios.userId] }).onDelete("cascade"),
  index("transactions_ledger_idx").on(table.userId, table.portfolioId, table.ticker, table.occurredAt, table.sequence),
  check("transactions_positive_quantity", sql`${table.quantityMicros} > 0`),
  check("transactions_positive_price", sql`${table.priceCents} > 0`),
  check("transactions_nonnegative_fee", sql`${table.feeCents} >= 0`),
  check("transactions_valid_type", sql`${table.type} IN ('BUY', 'SELL')`),
]);

export const dividends = sqliteTable("dividends", {
  id: text("id").primaryKey(),
  portfolioId: text("portfolio_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ticker: text("ticker").notNull(),
  amountCents: integer("amount_cents").notNull(),
  occurredAt: text("occurred_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  foreignKey({ columns: [table.portfolioId, table.userId], foreignColumns: [portfolios.id, portfolios.userId] }).onDelete("cascade"),
  index("dividends_user_portfolio_idx").on(table.userId, table.portfolioId),
  check("dividends_positive_amount", sql`${table.amountCents} > 0`),
]);

export const requestLimits = sqliteTable("request_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("request_limits_expiry_idx").on(table.expiresAt)]);

export const marketQuotes = sqliteTable("market_quotes", {
  ticker: text("ticker").primaryKey(),
  priceCents: integer("price_cents"),
  changeCents: integer("change_cents"),
  tradingDay: text("trading_day"),
  nextAttemptAt: integer("next_attempt_at").notNull(),
});
