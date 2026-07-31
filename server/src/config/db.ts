import { Pool } from 'pg';
import { env } from './env';
import { logger } from './logger';

const log = logger.child({ module: 'database' });

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  application_name: 'apex-server',
});

pool.on('error', (err) => {
  log.error({ err }, 'Unexpected error on idle database client');
  process.exit(-1);
});

export async function initDB(): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN'); // Run all schema changes in a transaction.

    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`); // Enable UUID generation (pgcrypto extension)

    // USERS
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username      VARCHAR(50) UNIQUE NOT NULL,
        display_name  VARCHAR(100) NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url    TEXT,
        public_key    TEXT,
        is_online     BOOLEAN DEFAULT FALSE,
        last_seen     TIMESTAMPTZ DEFAULT NOW(),
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ROOMS
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) NOT NULL,
        type        VARCHAR(20) DEFAULT 'group',
        created_by  UUID REFERENCES users(id),
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        last_activity_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Ensure last_activity_at exists on older schemas
    await client.query(`
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();
    `);


    // ROOM MEMBERS
    await client.query(`
      CREATE TABLE IF NOT EXISTS room_members (
        room_id   UUID REFERENCES rooms(id) ON DELETE CASCADE,
        user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
        role      VARCHAR(20) DEFAULT 'member',
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (room_id, user_id)
      );
    `);

    // MESSAGES
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id  UUID NOT NULL REFERENCES users(id),
        room_id    UUID NOT NULL REFERENCES rooms(id),
        content    TEXT NOT NULL,
        type       VARCHAR(20) DEFAULT 'text',
        reply_to   UUID REFERENCES messages(id) ON DELETE SET NULL,
        is_read    BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Ensure is_read exists on older schemas
    await client.query(`
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
    `);

    // Complex index for efficient message retrieval per room. For cursor-based pagination:
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_room_time
        ON messages (room_id, created_at DESC);
    `);

    // MESSAGE REACTIONS (Phase 2)
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji      VARCHAR(10) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (message_id, user_id, emoji)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reactions_message
        ON message_reactions (message_id);
    `);

    // Add reply_to column to existing tables if upgrading
    await client.query(`
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES messages(id) ON DELETE SET NULL;
    `);

    // Add is_encrypted flag to rooms (Phase 2)
    await client.query(`
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;
    `);

    // REFRESH TOKENS
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        device     VARCHAR(255),
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
        ON refresh_tokens (user_id);
    `);

    await client.query('COMMIT');
    log.info('Database schema initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    log.error({ err }, 'Failed to initialize database schema');
    throw err;
  } finally {
    client.release(); // Release the connection
  }
}

process.on('SIGTERM', async () => { // SIGTERM - Graceeful Process Termination
  log.info('SIGTERM received — closing database pool');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => { // SIGINT - Signal Interrupt (Ctrl + C)
  log.info('SIGINT received — closing database pool');
  await pool.end();
  process.exit(0);
});

export default pool;
