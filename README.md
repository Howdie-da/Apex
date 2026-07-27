# ⚡ Apex

**A privacy-first, high-performance, real-time workspace & chat application.**

Self-hosted. Open-source. Brutalist design aesthetics. Your data, your server, your rules.

---

## Key Features

- **⚡ Real-Time Messaging**: Instant WebSocket communication powered by Socket.io v4 with fallback support.
- **🐻 Centralized State Management**: Powered by **Zustand** for decoupled socket event listeners, zero-overhead re-renders, and persistent UI state.
- **📐 Custom Layout**: Custom brutalist multi-column shell with responsive mobile views.
- **💬 Channel & Room System**: Real-time room switching, typing indicators, member activity, and message history pagination.
- **🔒 Secure Authentication**: Dual-token system featuring JWT access tokens, refresh token rotation, and bcrypt password hashing.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Core** | React 19, TypeScript, Vite |
| **State Management** | Zustand |
| **Styling & Layout** | Tailwind CSS v4, Lucide Icons |
| **Backend API** | Node.js, Express, Socket.io v4 |
| **Database** | PostgreSQL 16 |
| **Security & Auth** | JWT, bcrypt |

---

## Quickstart

### Prerequisites

- **Node.js** v20+
- **PostgreSQL 16** (via Docker or local installation)
- **npm** (v9+)

### Setup & Installation

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd Apex

# 2. Install dependencies across client & server workspaces
npm install

# 3. Start PostgreSQL (Docker method)
docker compose up -d

# 4. Configure environment variables
cp .env.example .env
# Edit .env with your local database credentials if needed

# 5. Run development servers (Server :3001 & Client :5173)
npm run dev
```

### Manual Local Database (Without Docker)

If running PostgreSQL natively:
1. Create a local PostgreSQL database named `apex`.
2. Set `DATABASE_URL=postgres://<user>:<password>@localhost:5432/apex` in your `.env` file.
3. Run `npm run dev`.

---

## Project Structure

```
Apex/
├── client/                     # React 19 + Vite Frontend
│   ├── src/
│   │   ├── components/         # Chat UI Shell, Panels, & Rails
│   │   ├── config/             # Socket.io Client Setup
│   │   ├── features/           # Auth & Chat Feature Modules
│   │   ├── store/              # Zustand Global Stores (Auth, Chat, UI)
│   │   └── types/              # TypeScript Event & Data Interfaces
├── server/                     # Node.js + Express + Socket.io Backend
│   ├── src/
│   │   ├── controllers/        # REST API Route Handlers
│   │   ├── db/                 # Postgres Schema & Connection Pool
│   │   ├── socket/             # Real-time WebSocket Event Handlers
│   │   └── middleware/         # JWT Auth & Security Middleware
├── docs/                       # Architecture & API Specs
└── package.json                # npm Monorepo Workspaces Root
```

---

## Roadmap

- [x] **Phase 1**: Core Architecture, Real-Time Socket Messaging & Zustand Integration
- [ ] **Phase 2**: E2EE (End-to-End Encryption) & Product Polish
- [ ] **Phase 3**: Cross-Platform Desktop & Mobile Apps (Capacitor + Electron)
- [ ] **Phase 4**: DevOps, Containerization & Self-Hostable Cloud Deployment

---

## License

MIT
