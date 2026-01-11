import { NextFunction, Request, Response } from "express";

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  return res.status(500).json({ error: "Server error", message: err.message });
};
