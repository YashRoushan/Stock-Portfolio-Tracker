import request from "supertest";
import app from "../src/app";
import prisma from "../src/prisma";

const ticker = "TESTHISTORY";
const email = `portfolio-${Date.now()}@example.com`;
const password = "password123";

const registerAndLogin = async () => {

  const register = await request(app)
    .post("/api/auth/register")
    .send({ email, password });

  return register.body.token as string;
};

afterAll(async () => {
  await prisma.dailyClose.deleteMany({ where: { ticker } });
  await prisma.transaction.deleteMany({ where: { user: { email } } });
  await prisma.portfolio.deleteMany({ where: { user: { email } } });
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe("portfolio summary", () => {
  it("creates portfolio, adds transaction, returns summary", async () => {
    const token = await registerAndLogin();
    const portfolioRes = await request(app)
      .post("/api/portfolios")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Long Term" });

    const portfolioId = portfolioRes.body.portfolio.id as string;

    const txRes = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        portfolioId,
        ticker,
        type: "BUY",
        quantity: 5,
        price: 100,
        fee: 1,
        occurredAt: "2026-01-05T12:00:00Z"
      });

    expect(txRes.status).toBe(201);

    const sell = (quantity: number, occurredAt: string) => request(app)
      .post("/api/transactions").set("Authorization", `Bearer ${token}`)
      .send({ portfolioId, ticker, type: "SELL", quantity, price: 110, occurredAt });
    const competing = await Promise.all([sell(4, "2026-01-09T12:00:00Z"), sell(4, "2026-01-09T12:00:00Z")]);
    expect(competing.map(r => r.status).sort()).toEqual([201, 409]);
    expect((await sell(2, "2026-01-08T12:00:00Z")).status).toBe(409);
    await prisma.dailyClose.create({ data: { ticker, date: "2026-01-12", priceCents: 12_000 } });
    const summary = await request(app)
      .get(`/api/portfolios/${portfolioId}/summary`)
      .set("Authorization", `Bearer ${token}`);

    expect(summary.status).toBe(200);
    expect(summary.body.summary.holdings[0].quantity).toBe(1);
    expect(summary.body.summary.holdings[0].currentValueCents).toBeNull();
    expect(summary.body.summary.series.slice(-1)[0]).toEqual({
      date: "2026-01-12", valueCents: 10_020, marketValueCents: 12_000
    });
    expect(summary.body.summary.coverage).toEqual({ priced: 0, open: 1 });
  });
});
