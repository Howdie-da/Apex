// ============================================
// server/src/models/user.ts
// ============================================

import pool from '../config/db';
import { UserRow, User, toUser } from '../types/index';
import { logger } from '../config/logger';

const log = logger.child({ module: 'model:user' });

export async function createUser(
  username: string,
  displayName: string,
  passwordHash: string
): Promise<User> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (username, display_name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [username, displayName, passwordHash]
  );
  
  log.info({ userId: rows[0].id, username }, 'User created');
  return toUser(rows[0]);
}

export async function findByUsername(username: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );
  return rows[0] || null;
}

export async function findById(id: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export async function setOnlineStatus(id: string, isOnline: boolean): Promise<void> {
  await pool.query(
    'UPDATE users SET is_online = $1, last_seen = NOW() WHERE id = $2',
    [isOnline, id]
  );
}

export async function getOnlineUsers(): Promise<User[]> {
  const { rows } = await pool.query<UserRow>(
    'SELECT * FROM users WHERE is_online = true ORDER BY username'
  );
  return rows.map(toUser);
}

/**
 * Phase 2 E2EE: Store a user's ECDH P-256 public key (Base64 encoded).
 */
export async function savePublicKey(userId: string, publicKey: string): Promise<void> {
  await pool.query(
    'UPDATE users SET public_key = $1 WHERE id = $2',
    [publicKey, userId]
  );
  log.debug({ userId }, 'Public key saved');
}

/**
 * Phase 2 E2EE: Fetch another user's public key for key exchange.
 */
export async function getPublicKey(userId: string): Promise<string | null> {
  const { rows } = await pool.query<{ public_key: string | null }>(
    'SELECT public_key FROM users WHERE id = $1',
    [userId]
  );
  return rows[0]?.public_key || null;
}

/**
 * DM: Fetch user by exact username (case-insensitive, excludes requesting user).
 */
export async function findByExactUsername(username: string, excludeUserId?: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT * FROM users
     WHERE LOWER(username) = LOWER($1)
       AND ($2::uuid IS NULL OR id != $2)`,
    [username.trim(), excludeUserId || null]
  );
  return rows[0] ? toUser(rows[0]) : null;
}

/**
 * DM: Fetch all users for the user directory (excludes the requesting user).
 */
export async function getAllUsers(excludeUserId?: string): Promise<User[]> {
  const { rows } = await pool.query<UserRow>(
    `SELECT * FROM users
     WHERE ($1::uuid IS NULL OR id != $1)
     ORDER BY is_online DESC, username ASC`,
    [excludeUserId || null]
  );
  return rows.map(toUser);
}

