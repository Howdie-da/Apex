import pool from "../config/db";
import { logger } from "../config/logger";
import { UserRow, User, toUser } from "../types/index";

const log = logger.child({ module: "model:user" });

export async function createUser(
  username: string,
  displayName: string,
  passwordHash: string,
): Promise<User> {

  const { rows } = await pool.query<UserRow>(
    `
    INSERT INTO users (username, display_name, password_hash)
    VALUES ($1, $2, $3)
    RETURNING *
    `,
    [username, displayName, passwordHash],
  );

  log.info({ userId: rows[0].id, username }, "User created");
  
  return toUser(rows[0]);
}

export async function findByUsername(
  username: string,
): Promise<UserRow | null> {

  const { rows } = await pool.query<UserRow>(
    "SELECT * FROM users WHERE username = $1",
    [username],
  );
  
  return rows[0] || null;
}

export async function findById(id: string): Promise<User | null> {

  const { rows } = await pool.query<UserRow>(
    "SELECT * FROM users WHERE id = $1",
    [id],
  );
  
  return rows[0] ? toUser(rows[0]) : null;
}

export async function setOnlineStatus(
  id: string,
  isOnline: boolean,
): Promise<void> {

  await pool.query(
    "UPDATE users SET is_online = $1, last_seen = NOW() WHERE id = $2",
    [isOnline, id],
  );
}

// Bypasses sending the encrypted private key down to clients searching for a user.
// This mitigates the risk of the client downloading the entire DB's private key blobs over time.
function toPublicUser(row: UserRow): User {
  const user = toUser(row);
  delete user.encryptedPrivateKey;
  return user;
}

export async function getOnlineUsers(): Promise<User[]> {

  const { rows } = await pool.query<UserRow>(
    "SELECT * FROM users WHERE is_online = true ORDER BY username",
  );
  
  return rows.map(toPublicUser);
}

export async function saveE2EEKeys(
  userId: string,
  publicKey: string,
  encryptedPrivateKey?: string | null,
): Promise<void> {

  if (encryptedPrivateKey) {
    await pool.query(
      "UPDATE users SET public_key = $1, encrypted_private_key = $2 WHERE id = $3",
      [publicKey, encryptedPrivateKey, userId],
    );
  } else {
    await pool.query(
      "UPDATE users SET public_key = $1 WHERE id = $2", 
      [publicKey, userId]
    );
  }
  
  log.debug({ userId, hasBackup: !!encryptedPrivateKey }, "E2EE keys saved");
}

export async function savePublicKey(
  userId: string,
  publicKey: string,
): Promise<void> {
  return saveE2EEKeys(userId, publicKey);
}

export async function getPublicKey(userId: string): Promise<string | null> {

  const { rows } = await pool.query<{ public_key: string | null }>(
    "SELECT public_key FROM users WHERE id = $1",
    [userId],
  );
  
  return rows[0]?.public_key || null;
}

export async function findByExactUsername(
  username: string,
  excludeUserId?: string,
): Promise<User | null> {

  const { rows } = await pool.query<UserRow>(
    `
    SELECT * FROM users
    WHERE LOWER(username) = LOWER($1)
      AND ($2::uuid IS NULL OR id != $2)
    `,
    [username.trim(), excludeUserId || null],
  );
  
  return rows[0] ? toPublicUser(rows[0]) : null;
}

// Uses exact match for user search, returning at most one user in an array.
export async function searchUsers(
  query: string,
  excludeUserId?: string,
): Promise<User[]> {
  const match = await findByExactUsername(query, excludeUserId);
  return match ? [match] : [];
}

export async function getAllUsers(excludeUserId?: string): Promise<User[]> {

  const { rows } = await pool.query<UserRow>(
    `
    SELECT * FROM users
    WHERE ($1::uuid IS NULL OR id != $1)
    ORDER BY is_online DESC, username ASC
    `,
    [excludeUserId || null],
  );
  
  return rows.map(toPublicUser);
}

export async function updateDisplayName(
  userId: string,
  newDisplayName: string,
): Promise<void> {

  await pool.query(
    "UPDATE users SET display_name = $1 WHERE id = $2", 
    [newDisplayName, userId]
  );
  
  log.info({ userId }, "Display name updated");
}