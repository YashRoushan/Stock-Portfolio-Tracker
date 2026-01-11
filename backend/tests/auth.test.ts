import request from "supertest";
import app from "../src/app";
import prisma from "../src/prisma";

const testEmail = "test@example.com";

beforeAll(async () => {
  await prisma.transaction.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.user.deleteMany({ where: { email: testEmail } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: testEmail } });
  await prisma.$disconnect();
});

describe("auth", () => {
  it("registers and logs in", async () => {
    const register = await request(app)
      .post("/api/auth/register")
      .send({ email: testEmail, password: "password123" });

    expect(register.status).toBe(200);
    expect(register.body.token).toBeDefined();

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: "password123" });

    expect(login.status).toBe(200);
    expect(login.body.token).toBeDefined();
  });
});
