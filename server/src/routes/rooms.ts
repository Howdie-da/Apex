import { Router, Request, Response } from 'express';
import pool from '../config/db';
import * as MessageModel from '../models/message';
import { authMiddleware } from '../middleware/authHttp';
import { logger } from '../config/logger';

const router = Router();
const log = logger.child({ module: 'routes:rooms' });

router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.* FROM rooms r 
       ORDER BY r.name ASC`
    );
    res.json(rows);
  } catch (err) {
    log.error({ err }, 'Failed to fetch rooms');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:roomId/messages', authMiddleware, async (req: Request, res: Response) => {
  try {
    const roomId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;

    const messages = await MessageModel.getMessages(roomId, limit, before);
    res.json(messages);
  } catch (err) {
    log.error({ err, roomId: req.params.roomId }, 'Failed to fetch room messages');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
export { router as roomsRouter };
