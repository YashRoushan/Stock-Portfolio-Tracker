import { Router } from "express";
import { z } from "zod";
import prisma from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { provider } from "../services/pricing";
import { toCents } from "../utils/money";

const router = Router();

const createSchema = z.object({
  body: z.object({
    portfolioId: z.string().uuid(),
    ticker: z.string().min(1),
    amount: z.number().positive(),
    occurredAt: z.string().datetime()
  })
});

router.use(requireAuth);

router.get("/:ticker", async (req: AuthRequest, res) => {
  const ticker = req.params.ticker.toUpperCase();
  if (!provider.getDividends) {
    return res.json({ dividends: [] });
  }
  const dividends = await provider.getDividends(ticker);
  return res.json({ dividends });
});

router.post("/", validate(createSchema), async (req: AuthRequest, res) => {
  const { portfolioId, ticker, amount, occurredAt } = req.body;
  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId: req.user?.id }
  });
  if (!portfolio) {
    return res.status(404).json({ error: "Portfolio not found" });
  }

  const dividend = await prisma.dividend.create({
    data: {
      portfolioId,
      userId: req.user?.id || "",
      ticker: ticker.toUpperCase(),
      amountCents: toCents(amount),
      occurredAt: new Date(occurredAt)
    }
  });

  return res.status(201).json({ dividend });
});

router.get("/", async (req: AuthRequest, res) => {
  const portfolioId = req.query.portfolioId as string | undefined;
  const dividends = await prisma.dividend.findMany({
    where: {
      userId: req.user?.id,
      ...(portfolioId ? { portfolioId } : {})
    },
    orderBy: { occurredAt: "desc" }
  });
  return res.json({ dividends });
});

export default router;
