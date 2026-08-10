import { Pool } from "pg";
import { env } from "./env";
import { logger } from "./logger";

const log = logger.child({ module: "database" });

// Capping the pool at 20 max connections to avoid overwhelming Postgres under high concurrent load.
// This handles roughly 2000 active WebSocket clients assuming a 1% DB active request rate.
// TODO(perf): Evaluate pgBouncer if we scale beyond 5 Node instances, as direct connections will quickly saturate the DB limit.
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,      // Releases inactive connections after 30s to mitigate connection starvation.
  connectionTimeoutMillis: 5000, // Bypasses hanging processes if DB DNS resolution stalls.
  application_name: "apex-server",
});

pool.on("error", (err) => {
  log.error({ err }, "Unexpected error on idle database client");
  process.exit(-1);
});

export async function initDB(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // Storing public/private keys directly in the user row.
    // Note: We pull keys almost every time we query a user for E2EE chats.
    // Splitting keys into a separate table would force an expensive JOIN on every lookup.
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username              VARCHAR(50) UNIQUE NOT NULL,
        display_name          VARCHAR(100) NOT NULL,
        password_hash         TEXT NOT NULL,
        avatar_url            TEXT,
        public_key            TEXT,
        encrypted_private_key TEXT,
        is_online             BOOLEAN DEFAULT FALSE,
        last_seen             TIMESTAMPTZ DEFAULT NOW(),
        created_at            TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name             VARCHAR(100) NOT NULL,
        type             VARCHAR(20) DEFAULT 'group' CHECK (type IN ('direct', 'group')),
        created_by       UUID REFERENCES users(id),
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        last_activity_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // PRIMARY KEY (room_id, user_id) buffers against duplicate membership inserts.
    await client.query(`
      CREATE TABLE IF NOT EXISTS room_members (
        room_id   UUID REFERENCES rooms(id) ON DELETE CASCADE,
        user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
        role      VARCHAR(20) DEFAULT 'member',
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (room_id, user_id)
      );
    `);

    // Explicit index on user_id since Postgres only uses the left-most column of the composite PK.
    // We scan this constantly to load the conversation list for a client.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_room_members_user
        ON room_members (user_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id  UUID NOT NULL REFERENCES users(id),
        room_id    UUID NOT NULL REFERENCES rooms(id),
        content    TEXT NOT NULL,
        type       VARCHAR(20) DEFAULT 'text' CHECK (type IN ('text', 'image', 'system', 'encrypted')),
        reply_to   UUID REFERENCES messages(id) ON DELETE SET NULL,
        is_read    BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
    `);

    // Composite index on (room_id, created_at) forces Postgres to avoid a full table scan
    // when fetching chat history, bypassing massive I/O spikes in large group chats.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_room_time
        ON messages (room_id, created_at DESC);
    `);

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
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES messages(id) ON DELETE SET NULL;
    `);

    await client.query(`
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT;
    `);

    // HACK: We use token_hash instead of plaintext tokens in the DB to mitigate the blast radius if a dump occurs.
    // UNIQUE automatically creates an index, speeding up the WHERE token_hash = $1 lookup.
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT UNIQUE NOT NULL,
        device     VARCHAR(255),
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
        ON refresh_tokens (user_id);
    `);

    await client.query("COMMIT");
    log.info("Database schema initialized successfully");

  } catch (err) {
    await client.query("ROLLBACK");
    log.error({ err }, "Failed to initialize database schema");
    throw err;

  } finally {
    client.release();
  }
}

process.on("SIGTERM", async () => {
  log.info("SIGTERM received — closing database pool");
  await pool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  log.info("SIGINT received — closing database pool");
  await pool.end();
  process.exit(0);
});

export default pool;