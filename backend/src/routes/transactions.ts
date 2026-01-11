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
    ticker: z.string().min(1),
    type: z.enum(["BUY", "SELL"]),
    quantity: z.number().positive(),
    price: z.number().positive(),
    fee: z.number().min(0).default(0),
    occurredAt: z.string().datetime()
  })
});

router.use(requireAuth);

router.post("/", validate(transactionSchema), async (req: AuthRequest, res) => {
  const { portfolioId, ticker, type, quantity, price, fee, occurredAt } = req.body;

  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId: req.user?.id }
  });
  if (!portfolio) {
    return res.status(404).json({ error: "Portfolio not found" });
  }

  const transaction = await prisma.transaction.create({
    data: {
      portfolioId,
      userId: req.user?.id || "",
      ticker: ticker.toUpperCase(),
      type,
      quantity,
      priceCents: toCents(price),
      feeCents: toCents(fee),
      occurredAt: new Date(occurredAt)
    }
  });

  return res.status(201).json({ transaction });
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
