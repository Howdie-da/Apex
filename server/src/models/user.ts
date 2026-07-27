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
