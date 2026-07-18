import type { NextFunction, Request, Response } from "express";

// Must run after requireAuth — relies on req.user already being set.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }
  next();
}
