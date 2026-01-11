import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET || "";

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = header.substring("Bearer ".length);
  try {
    const payload = jwt.verify(token, jwtSecret) as { id: string; email: string };
    req.user = { id: payload.id, email: payload.email };
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
};
