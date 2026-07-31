// ============================================
// server/src/routes/users.ts
// User Directory: list all users for DM discovery
// ============================================

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authHttp';
import * as UserModel from '../models/user';
import { logger } from '../config/logger';
import { TypedServer } from '../types/socket';

const router = Router();
const log = logger.child({ module: 'routes:users' });

/**
 * GET /api/users
 * Search user by username or display name for DM creation.
 * Query: ?username=query
 * Returns: Array containing matching user objects.
 */
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const usernameQuery = typeof req.query.username === 'string' ? req.query.username.trim() : '';

    if (!usernameQuery) {
      // Security: Do not list all users without search query
      res.json([]);
      return;
    }

    const matches = await UserModel.searchUsers(usernameQuery, userId);
    res.json(matches);
  } catch (err) {
    log.error({ err }, 'Failed to search users');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * PATCH /api/users/me/display-name
 * Update the display name of the authenticated user.
 */
router.patch('/me/display-name', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { displayName } = req.body;

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      res.status(400).json({ error: 'Display name is required.' });
      return;
    }

    await UserModel.updateDisplayName(userId, displayName.trim());

    // Broadcast the change to all connected clients
    const io: TypedServer = req.app.get('io');
    if (io) {
      io.emit('user:display-name-changed', {
        userId,
        newDisplayName: displayName.trim(),
      });
    }

    res.json({ success: true });
  } catch (err) {
    log.error({ err }, 'Failed to update display name');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
