import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { authLimiter } from '../middleware/rateLimiter';
import * as UserModel from '../models/user';
import type { JwtPayload } from '../types/index';

const router = Router();
const log = logger.child({ module: 'auth' });

function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
}

function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

router.post('/register', authLimiter, async (req: Request, res: Response): Promise<void> => {
  // 1. Input Validation
  // 2. Check if Username is taken
  // 3. Check if Password is correct, if yes, hash it
  // 4. Create user
  // 5. Generate and Store tokens

  try {
    const { username, displayName, password } = req.body;

    if (!username || !displayName || !password) {
      res.status(400).json({ error: 'Username, display name, and password are required.' });
      return;
    }

    if (username.length < 3 || username.length > 50) {
      res.status(400).json({ error: 'Username must be 3-50 characters.' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }

    const existing = await UserModel.findByUsername(username);
    if (existing) {
      res.status(409).json({ error: 'Username already taken.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await UserModel.createUser(username, displayName, passwordHash);

    const jwtPayload: JwtPayload = { userId: user.id, username: user.username };
    const accessToken = generateAccessToken(jwtPayload);
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, refreshToken);

    log.info({ userId: user.id, username }, 'User registered');

    res.status(201).json({
      user,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    log.error({ err }, 'Registration failed');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  // 1. Find User
  // 2. Verify Password (* make sure both have same error message.)
  // 3. Generate and Store tokens
  // 4. SetOnline

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const userRow = await UserModel.findByUsername(username);
    if (!userRow) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, userRow.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const jwtPayload: JwtPayload = { userId: userRow.id, username: userRow.username };
    const accessToken = generateAccessToken(jwtPayload);
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(userRow.id, refreshToken);

    await UserModel.setOnlineStatus(userRow.id, true);

    log.info({ userId: userRow.id, username }, 'User logged in');

    res.json({
      user: {
        id: userRow.id,
        username: userRow.username,
        displayName: userRow.display_name,
        avatarUrl: userRow.avatar_url,
        publicKey: userRow.public_key,
        encryptedPrivateKey: userRow.encrypted_private_key || null,
        isOnline: true,
        lastSeen: userRow.last_seen,
        createdAt: userRow.created_at,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    log.error({ err }, 'Login failed');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  // 1. Find refresh token in db
  // 2. Delete the token
  // 3. Look up the user
  // 4. Issue new token pair

  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required.' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const { rows } = await pool.query(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = $1 AND expires_at > NOW()`,
      [tokenHash]
    );

    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid or expired refresh token.' });
      return;
    }

    const storedToken = rows[0];

    await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [storedToken.id]);

    const user = await UserModel.findById(storedToken.user_id);
    if (!user) {
      res.status(401).json({ error: 'User not found.' });
      return;
    }

    const jwtPayload: JwtPayload = { userId: user.id, username: user.username };
    const newAccessToken = generateAccessToken(jwtPayload);
    const newRefreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, newRefreshToken);

    log.debug({ userId: user.id }, 'Token refreshed');

    res.json({
      user,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    log.error({ err }, 'Token refresh failed');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
