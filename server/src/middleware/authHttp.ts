import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { JwtPayload } from '../types/index';
import type { Request, Response, NextFunction } from 'express';

// 1. Client sends: Authorization: Bearer <jwt-token>
// 2. This middleware extracts the token from the header
// 3. Verifies the JWT signature using JWT_SECRET
// 4. Attaches the decoded payload to req.user
// 5. Calls next() — the route handler can now access req.user

declare global { // Adding custom property to built-in Request
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Send a Bearer token.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }
}
