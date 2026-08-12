# ⚡ Apex &nbsp;`v1.0.0`

**A privacy-first, high-performance, real-time chat application.**

Self-hosted. Open-source. Brutalist design aesthetics. Your data, your server, your rules.

---

## ✨ Features

| Feature | Description |
|---|---|
| ⚡ **Real-Time Messaging** | Instant WebSocket communication via Socket.io v4 with connection-state recovery |
| 🔒 **End-to-End Encryption** | ECDH P-256 key exchange + AES-GCM-256 per-message encryption for all DMs — the server never sees plaintext |
| 🔑 **Zero-Knowledge Key Backup** | Encrypted private key backup stored server-side, unlocked only with your login password (PBKDF2 + AES-GCM) |
| 👥 **Groups & DMs** | Create group rooms or direct messages, with live member lists and room management |
| 💬 **Rich Messaging** | Emoji reactions, threaded replies, typing indicators, and cursor-based infinite scroll history |
| ✅ **Read Receipts** | Per-message read status with real-time delivery to all room members |
| 🛡️ **Secure Auth** | Dual-token system: short-lived JWTs (15 min) + hashed refresh token rotation (7 days) with rate limiting |
| 📡 **Online Presence** | Live user online/offline status broadcast across all rooms |
| 🏥 **Health & Readiness Checks** | `/health` and `/ready` endpoints for load-balancer probes |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 8 |
| **State Management** | Zustand 5 |
| **Styling** | Tailwind CSS v4, Lucide Icons |
| **Encryption** | Web Crypto API (ECDH P-256 / AES-GCM-256 / PBKDF2) |
| **Key Storage** | IndexedDB via `idb` |
| **Backend API** | Node.js, Express 5, Socket.io v4 |
| **Database** | PostgreSQL 16 (via `pg` connection pool) |
| **Auth** | JWT (`jsonwebtoken`), bcrypt, refresh token rotation |
| **Infrastructure** | Docker (PostgreSQL), `concurrently` monorepo scripts |

---

## 🚀 Quickstart

### Prerequisites

- **Node.js** v20+
- **Docker** (for PostgreSQL) — or a local PostgreSQL 16 instance
- **npm** v9+

### Setup & Installation

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd Apex

# 2. Install all dependencies (monorepo — client + server)
npm install

# 3. Start PostgreSQL via Docker
docker compose up -d

# 4. Configure environment variables
cp .env.example .env
# Open .env and set strong values for JWT_SECRET and JWT_REFRESH_SECRET

# 5. Run development servers (server :3001, client :5173)
npm run dev
```

> The database schema is auto-initialized on first startup — no manual migrations needed.

### Without Docker (local PostgreSQL)

1. Create a database: `createdb apex`
2. In `.env`, set `DATABASE_URL=postgresql://<user>:<password>@localhost:5432/apex`
3. Run `npm run dev`

---

## 📁 Project Structure

```
Apex/
├── client/                     # React 19 + Vite Frontend
│   └── src/
│       ├── components/         # UI shell — ChatApp, MessageThread, panels, modals
│       ├── config/             # Socket.io singleton
│       ├── features/           # Feature-scoped modules (auth, chat hooks)
│       ├── lib/                # API client, Web Crypto helpers, IndexedDB key store
│       ├── store/              # Zustand stores: useAuthStore, useChatStore, useUIStore
│       └── types/              # TypeScript data & socket-event interfaces
├── server/                     # Node.js + Express + Socket.io Backend
│   └── src/
│       ├── config/             # DB pool, env validation, Pino logger
│       ├── middleware/         # JWT HTTP/socket auth, rate limiter
│       ├── models/             # User & message DB layer (parameterised queries only)
│       ├── routes/             # REST: auth, rooms, keys, reactions, users, health
│       ├── socket/             # Socket.io connection + chat event handler
│       └── types/              # Shared TypeScript interfaces & row mappers
├── docs/                       # Codebase manual & architecture notes
├── docker-compose.yml          # PostgreSQL 16 service
├── .env.example                # Environment variable template
└── package.json                # npm monorepo workspace root
```

---

## 🔐 Security Notes

- **Passwords** are hashed with bcrypt (cost 12) — never stored in plaintext.
- **Refresh tokens** are SHA-256 hashed before DB storage; the plaintext is client-only.
- **Private keys** never leave the client unencrypted; only a password-wrapped blob is sent to the server.
- **SQL injection** is impossible — every query uses `pg` parameterised statements (`$1`, `$2`, …).
- **Rate limiting** is enforced at the API layer (100 req/min global, 5 req/min on auth endpoints).
- **Emoji reactions** are validated against an allowlist on both the HTTP and WebSocket layers.

---

## 🗺 Roadmap

- [x] **Phase 1** — Core Architecture & Real-Time Sync
- [x] **Phase 2** — End-to-End Encryption (E2EE) Protocol
- [ ] **Phase 3** — Docker Containerisation & Cloud Deployment

---

## 🔭 Future Updates

- **Media Uploads** — Zero-knowledge file & image sharing via Cloudflare R2 (S3-compatible). Files are encrypted client-side with AES-GCM before upload; the server only stores an opaque blob.
- **Redis Pub/Sub** — Replace in-process Socket.io event routing with a Redis adapter to allow horizontal scaling across multiple server instances without sticky sessions.
- **Message Edit & Delete** — Allow senders to retract or edit messages, with real-time propagation to all room members.
- **Full-Text Message Search** — Leverage PostgreSQL `tsvector` / `to_tsquery` for server-side keyword search across chat history.
- **Web Push Notifications** — Background push delivery via the Web Push API so users receive alerts even when the tab is closed.
- **E2EE for Group Chats** — Extend end-to-end encryption beyond DMs. Group chats require a different key distribution model (e.g., sender keys or per-session group keys) which is architecturally non-trivial.

---

## 📄 License

MIT
