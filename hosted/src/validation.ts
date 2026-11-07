import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72, "Use a password of 8–72 characters.").refine(
    (value) => new TextEncoder().encode(value).length <= 72, "Password must be no more than 72 UTF-8 bytes.",
  ),
});

export const portfolioSchema = z.object({ name: z.string().trim().min(1).max(100) });
const ticker = z.string().trim().min(1).max(12).regex(/^[A-Za-z0-9.^=-]+$/).transform((value) => value.toUpperCase());
const date = z.string().datetime({ offset: true }).transform((value) => new Date(value).toISOString());
const price = z.number().finite().positive().max(1_000_000);
const quantity = z.number().finite().positive().max(1_000_000).refine(
  (value) => {
    const micros = value * 1_000_000;
    const rounded = Math.round(micros);
    return rounded >= 1 && Math.abs(micros - rounded) <= Number.EPSILON * Math.max(1, Math.abs(micros)) * 2;
  },
  "Use no more than six decimal places for share quantity.",
);

export const transactionSchema = z.object({
  portfolioId: z.string().uuid(),
  ticker,
  type: z.enum(["BUY", "SELL"]),
  quantity,
  price,
  fee: z.number().finite().min(0).max(1_000_000).default(0),
  occurredAt: date,
}).refine((value) => Math.round(value.price * 100) > 0, "Price must be at least $0.01.")
  .refine((value) => value.quantity * value.price * 100 <= 1_000_000_000_000, "Trade value exceeds the demo limit.");

export const dividendSchema = z.object({
  portfolioId: z.string().uuid(),
  ticker,
  amount: z.number().finite().positive().max(1_000_000_000)
    .refine((value) => Math.round(value * 100) > 0, "Dividend must be at least $0.01."),
  occurredAt: date,
});
