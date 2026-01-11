import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../prisma";
import { validate } from "../middleware/validate";

const router = Router();
const jwtSecret = process.env.JWT_SECRET || "";

const authSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8)
  })
});

router.post("/register", validate(authSchema), async (req, res) => {
  const { email, password } = req.body;
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return res.status(400).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash }
  });

  const token = jwt.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: "7d" });
  return res.json({ token, user: { id: user.id, email: user.email } });
});

router.post("/login", validate(authSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: "7d" });
  return res.json({ token, user: { id: user.id, email: user.email } });
});

export default router;
