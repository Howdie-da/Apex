import jwt from "jsonwebtoken";
import { env } from "../config/env";

import type { JwtPayload } from "../types/index";
import type { Request, Response, NextFunction } from "express";

// Extend the global Express Request interface to include our injected user payload
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Bypasses DB lookups on every HTTP request by strictly relying on stateless JWT verification.
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ error: "Authentication required. Send a Bearer token." });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = decoded;
    
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token." });
    return;
  }
}