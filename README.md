# Apex

**A privacy-first, high-performance, real-time chat application.**

Self-hosted. Open-source. Brutalist design aesthetics. Your data, your server, your rules.

[![Live Demo](https://img.shields.io/badge/Live_Demo-apex--client--8kib.onrender.com-000000?style=for-the-badge&logo=render&logoColor=46E3B7)](https://apex-client-8kib.onrender.com)
[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js_20-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

> 🔗 **Live Demo**: [https://apex-client-8kib.onrender.com](https://apex-client-8kib.onrender.com)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quickstart](#quickstart)
- [Project Structure](#project-structure)
- [Security Notes](#security-notes)
- [Author](#author)
- [License](#license)

---

## Features

| Feature | Description |
|---|---|
| **Real-Time Messaging** | Instant WebSocket communication via Socket.io v4 with connection-state recovery |
| **End-to-End Encryption** | ECDH P-256 key exchange + AES-GCM-256 per-message encryption for all DMs — the server never sees plaintext |
| **Zero-Knowledge Key Backup** | Encrypted private key backup stored server-side, unlocked only with your login password (PBKDF2 + AES-GCM) |
| **Groups & DMs** | Create group rooms or direct messages, with live member lists and room management |
| **Rich Messaging** | Threaded replies, typing indicators, and cursor-based infinite scroll history |
| **Read Receipts** | Per-message read status with real-time delivery to all room members |
| **Secure Auth** | Dual-token system: short-lived JWTs (15 min) + hashed refresh token rotation (7 days) with rate limiting |
| **Online Presence** | Live user online/offline status broadcast across all rooms |

---

## Tech Stack

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

## Quickstart

### Prerequisites

- **Node.js** v20+
- **Docker** (for PostgreSQL) — or a local PostgreSQL 16 instance
- **npm** v9+

### Setup & Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Howdie-da/Apex.git
   cd Apex
   ```

2. **Install dependencies**

   This is a monorepo — one command installs both client and server packages.
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and set strong, unique values for `JWT_SECRET` and `JWT_REFRESH_SECRET`.

4. **Start the database**

   Ensure Docker is running, then spin up PostgreSQL:
   ```bash
   docker compose up -d
   ```
   > The schema is auto-initialized on first startup — no manual migrations needed.

5. **Run the development servers**

   Starts both the backend (`:3001`) and frontend (`:5173`) in parallel:
   ```bash
   npm run dev
   ```

### Without Docker (local PostgreSQL)

1. Create the database: `createdb apex`
2. In `.env`, set `DATABASE_URL=postgresql://<user>:<password>@localhost:5432/apex`
3. Run `npm run dev`

---

## Project Structure

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

## Security Notes

- **Passwords** are hashed with bcrypt (cost 12) — never stored in plaintext.
- **Refresh tokens** are SHA-256 hashed before DB storage; the plaintext is client-only.
- **Private keys** never leave the client unencrypted; only a password-wrapped blob is sent to the server.
- **SQL injection** is impossible — every query uses `pg` parameterised statements (`$1`, `$2`, …).
- **Rate limiting** is enforced at the API layer (100 req/min global, 5 req/min on auth endpoints).

---

## Author

Akshat Nagar

---

## License

MIT
