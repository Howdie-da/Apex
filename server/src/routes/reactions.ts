// ============================================
// server/src/routes/reactions.ts
// Phase 2: Emoji Reactions on Messages
// ============================================

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authHttp';
import * as MessageModel from '../models/message';
import { logger } from '../config/logger';

const router = Router();
const log = logger.child({ module: 'routes:reactions' });

const ALLOWED_EMOJIS = new Set(['👍', '❤️', '😂', '😮', '😢', '🔥', '👎', '🎉', '🤔', '💯']);

/**
 * POST /api/messages/:messageId/reactions
 * Body: { emoji: string }
 * Toggle a reaction on a message (add if not present).
 */
router.post('/:messageId/reactions', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const messageId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;
    const { emoji } = req.body;

    if (!emoji || !ALLOWED_EMOJIS.has(emoji)) {
      res.status(400).json({ error: 'Invalid or unsupported emoji.' });
      return;
    }

    await MessageModel.addReaction(messageId, userId, emoji);
    const reactions = await MessageModel.getReactions(messageId);

    log.debug({ messageId, userId, emoji }, 'Reaction added via REST');
    res.json({ messageId, reactions });
  } catch (err) {
    log.error({ err }, 'Failed to add reaction');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * DELETE /api/messages/:messageId/reactions/:emoji
 * Remove a reaction from a message.
 */
router.delete('/:messageId/reactions/:emoji', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const messageId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;
    const emoji = Array.isArray(req.params.emoji) ? req.params.emoji[0] : req.params.emoji;

    await MessageModel.removeReaction(messageId, userId, decodeURIComponent(emoji));
    const reactions = await MessageModel.getReactions(messageId);

    log.debug({ messageId, userId, emoji }, 'Reaction removed via REST');
    res.json({ messageId, reactions });
  } catch (err) {
    log.error({ err }, 'Failed to remove reaction');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
