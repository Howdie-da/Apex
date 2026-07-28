// ============================================
// server/src/routes/users.ts
// User Directory: list all users for DM discovery
// ============================================

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authHttp';
import * as UserModel from '../models/user';
import { logger } from '../config/logger';

const router = Router();
const log = logger.child({ module: 'routes:users' });

/**
 * GET /api/users
 * Search user by exact username for DM creation.
 * Query: ?username=exact_name
 * Returns: Array containing matching user object if exact match exists, or [] if none found.
 */
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const usernameQuery = typeof req.query.username === 'string' ? req.query.username.trim() : '';

    if (!usernameQuery) {
      // Security: Do not list all users without exact username search
      res.json([]);
      return;
    }

    const exactMatch = await UserModel.findByExactUsername(usernameQuery, userId);
    res.json(exactMatch ? [exactMatch] : []);
  } catch (err) {
    log.error({ err }, 'Failed to search user by username');
    res.status(500).json({ error: 'Internal server error.' });
  }
});
export default router;
