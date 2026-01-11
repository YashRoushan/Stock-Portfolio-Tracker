import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { priceCache } from "../services/pricing";

const router = Router();

const querySchema = z.object({
  query: z.object({
    tickers: z.string().min(1)
  })
});

router.use(requireAuth);

router.get("/", validate(querySchema), async (req, res) => {
  const tickers = (req.query.tickers as string).split(",").map((item) => item.trim());
  const quotes = await priceCache.getQuotes(tickers);
  return res.json({ prices: quotes });
});

export default router;
