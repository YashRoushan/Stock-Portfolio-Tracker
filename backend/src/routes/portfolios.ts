import { Router } from "express";
import { z } from "zod";
import prisma from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { priceCache } from "../services/pricing";
import { computeHoldings, summarizePortfolio } from "../services/portfolio";

const router = Router();

const createSchema = z.object({
  body: z.object({
    name: z.string().min(1)
  })
});

router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  const portfolios = await prisma.portfolio.findMany({
    where: { userId: req.user?.id },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ portfolios });
});

router.post("/", validate(createSchema), async (req: AuthRequest, res) => {
  const { name } = req.body;
  const portfolio = await prisma.portfolio.create({
    data: {
      name,
      userId: req.user?.id || ""
    }
  });
  return res.status(201).json({ portfolio });
});

router.get("/:id", async (req: AuthRequest, res) => {
  const portfolio = await prisma.portfolio.findFirst({
    where: { id: req.params.id, userId: req.user?.id }
  });
  if (!portfolio) {
    return res.status(404).json({ error: "Not found" });
  }
  return res.json({ portfolio });
});

router.get("/:id/summary", async (req: AuthRequest, res) => {
  const portfolio = await prisma.portfolio.findFirst({
    where: { id: req.params.id, userId: req.user?.id }
  });
  if (!portfolio) {
    return res.status(404).json({ error: "Not found" });
  }

  const transactions = await prisma.transaction.findMany({
    where: { portfolioId: portfolio.id, userId: req.user?.id },
    orderBy: { occurredAt: "asc" }
  });

  const dividends = await prisma.dividend.findMany({
    where: { portfolioId: portfolio.id, userId: req.user?.id },
    orderBy: { occurredAt: "asc" }
  });

  const tickers = Array.from(new Set(transactions.map((tx) => tx.ticker)));
  const prices = await priceCache.getQuotes(tickers);
  const priceMap = prices.reduce<Record<string, { priceCents: number; changeCents: number }>>(
    (acc, quote) => {
      acc[quote.ticker] = { priceCents: quote.priceCents, changeCents: quote.changeCents };
      return acc;
    },
    {}
  );

  const { holdings, series } = computeHoldings(transactions, dividends, priceMap);
  const summary = summarizePortfolio(holdings, series);

  return res.json({ summary });
 });

export default router;
