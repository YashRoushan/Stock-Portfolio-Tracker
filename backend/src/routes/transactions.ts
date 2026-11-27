import { Router } from "express";
import { z } from "zod";
import prisma from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { toCents } from "../utils/money";

const router = Router();

const transactionSchema = z.object({
  body: z.object({
    portfolioId: z.string().uuid(),
    ticker: z.string().trim().min(1),
    type: z.enum(["BUY", "SELL"]),
    quantity: z.number().positive().min(0.000001).multipleOf(0.000001),
    price: z.number().positive(),
    fee: z.number().min(0).default(0),
    occurredAt: z.string().datetime()
  })
});

router.use(requireAuth);

class InsufficientShares extends Error {}

router.post("/", validate(transactionSchema), async (req: AuthRequest, res, next) => {
  const { portfolioId, ticker, type, quantity, price, fee = 0, occurredAt } = req.body;
  const userId = req.user!.id;
  const symbol = ticker.trim().toUpperCase();
  try {
    const transaction = await prisma.$transaction(async db => {
      // Every ledger writer takes this lock before reading or appending trades.
      const owned = await db.$queryRaw<{ id: string }[]>`SELECT id FROM "Portfolio"
        WHERE id = ${portfolioId} AND "userId" = ${userId} FOR UPDATE`;
      if (!owned.length) return null;
      const trade = await db.transaction.create({ data: {
        portfolioId, userId, ticker: symbol, type, quantity, priceCents: toCents(price),
        feeCents: toCents(fee), occurredAt: new Date(occurredAt)
      } });
      if (type === "SELL") {
        // A backdated sale must leave enough shares for every later sale.
        const deficits = await db.$queryRaw<{ deficit: boolean }[]>`SELECT EXISTS (
          SELECT 1 FROM (
            SELECT SUM(CASE WHEN type = 'BUY' THEN quantity ELSE -quantity END)
              OVER (ORDER BY "occurredAt", "createdAt", id ROWS UNBOUNDED PRECEDING) AS balance
            FROM "Transaction" WHERE "portfolioId" = ${portfolioId} AND ticker = ${symbol}
          ) ledger WHERE balance < 0
        ) AS deficit`;
        if (deficits[0].deficit) throw new InsufficientShares();
      }
      return trade;
    }, { isolationLevel: "ReadCommitted" });
    if (!transaction) return res.status(404).json({ error: "Portfolio not found" });
    return res.status(201).json({ transaction });
  } catch (err) {
    if (err instanceof InsufficientShares) return res.status(409).json({ error: "Insufficient shares on this or a later trade date." });
    return next(err);
  }
});

router.get("/", async (req: AuthRequest, res) => {
  const portfolioId = req.query.portfolioId as string | undefined;
  const transactions = await prisma.transaction.findMany({
    where: {
      userId: req.user?.id,
      ...(portfolioId ? { portfolioId } : {})
    },
    orderBy: { occurredAt: "desc" }
  });
  return res.json({ transactions });
});

export default router;
