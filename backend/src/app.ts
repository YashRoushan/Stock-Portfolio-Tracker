import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth";
import portfolioRoutes from "./routes/portfolios";
import transactionRoutes from "./routes/transactions";
import priceRoutes from "./routes/prices";
import dividendRoutes from "./routes/dividends";
import { errorHandler } from "./middleware/error";

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/portfolios", portfolioRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/prices", priceRoutes);
app.use("/api/dividends", dividendRoutes);

app.get("/api/health", (_req, res) => {
  return res.json({ status: "ok" });
});

app.use(errorHandler);

export default app;
