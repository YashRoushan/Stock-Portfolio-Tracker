import request from "supertest";
import app from "../src/app";
import prisma from "../src/prisma";

const email = "portfolio@example.com";
const password = "password123";

const registerAndLogin = async () => {
  await prisma.transaction.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.user.deleteMany({ where: { email } });

  const register = await request(app)
    .post("/api/auth/register")
    .send({ email, password });

  return register.body.token as string;
};

afterAll(async () => {
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
        ticker: "AAPL",
        type: "BUY",
        quantity: 1,
        price: 100,
        fee: 1,
        occurredAt: new Date().toISOString()
      });

    expect(txRes.status).toBe(201);

    const summary = await request(app)
      .get(`/api/portfolios/${portfolioId}/summary`)
      .set("Authorization", `Bearer ${token}`);

    expect(summary.status).toBe(200);
    expect(summary.body.summary).toBeDefined();
  });
});
