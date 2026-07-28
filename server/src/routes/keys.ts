// ============================================
// server/src/routes/keys.ts
// Phase 2 E2EE: Public Key Exchange Endpoints
// ============================================

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authHttp';
import * as UserModel from '../models/user';
import { logger } from '../config/logger';

const router = Router();
const log = logger.child({ module: 'routes:keys' });

/**
 * PUT /api/keys/public
 * Upload or replace the authenticated user's ECDH P-256 public key.
 * Body: { publicKey: string } — Base64-encoded SubjectPublicKeyInfo (SPKI) export
 */
router.put('/public', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { publicKey } = req.body;

    if (!publicKey || typeof publicKey !== 'string') {
      res.status(400).json({ error: 'publicKey (Base64 string) is required.' });
      return;
    }

    // Basic length sanity: SPKI-encoded P-256 public key is ~124 bytes, Base64 ≈ 165 chars
    if (publicKey.length < 100 || publicKey.length > 512) {
      res.status(400).json({ error: 'Invalid public key format.' });
      return;
    }

    await UserModel.savePublicKey(userId, publicKey);
    log.debug({ userId }, 'Public key uploaded');
    res.json({ ok: true });
  } catch (err) {
    log.error({ err }, 'Failed to save public key');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /api/keys/:userId
 * Fetch any user's public key for ECDH derivation.
 * Returns: { userId, publicKey }
 */
router.get('/:userId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const targetUserId = Array.isArray(req.params.userId)
      ? req.params.userId[0]
      : req.params.userId;

    if (!targetUserId) {
      res.status(400).json({ error: 'userId is required.' });
      return;
    }

    const publicKey = await UserModel.getPublicKey(targetUserId);
    if (!publicKey) {
      res.status(404).json({ error: 'Public key not found for user.' });
      return;
    }

    res.json({ userId: targetUserId, publicKey });
  } catch (err) {
    log.error({ err }, 'Failed to fetch public key');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
