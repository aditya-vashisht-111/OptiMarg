# FleetPulse Monorepo

[![Status](https://img.shields.io/badge/Status-Active-brightgreen)](https://fleetpulse-monorepo.onrender.com/docs)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

FleetPulse is a real-time fleet management and logistics tracking platform designed for high-concurrency event processing, route optimization, and telemetry monitoring.

📖 **API Documentation:** https://fleetpulse-monorepo.onrender.com/docs

---

## 📂 Repository Structure

```text
fleetpulse-monorepo/
├── apps/
│   ├── api/            # REST & WebSocket API services
│   ├── dashboard/      # Web management dashboard (Next.js / React)
│   └── mobile-web/     # Driver & agent interface
├── packages/
│   ├── ui/             # Shared UI components & design system
│   ├── database/       # ORM client, schemas, and migrations
│   ├── config/         # Shared TypeScript, ESLint, & Tailwind configs
│   └── utils/          # Core utilities & shared types
├── docker-compose.yml  # Local services infrastructure
├── package.json        # Root workspace configuration
└── turbo.json          # Build pipeline orchestration
```

---

## 🛠️ Tech Stack

* **Language:** TypeScript
* **Frontend:** Next.js, React, Tailwind CSS
* **Backend:** Node.js (Express / NestJS), WebSockets
* **Database & Caching:** PostgreSQL, Redis, Prisma ORM
* **Monorepo Tools:** Turborepo, pnpm workspaces
* **Deployment:** Render

---

## ⚡ Quick Start

### Prerequisites

* **Node.js** `>= 18.0.0`
* **pnpm** `>= 8.0.0`
* **Docker Desktop** (for local databases)

### Setup

#### 1. Clone the repository

```bash
git clone https://github.com/your-username/fleetpulse-monorepo.git
cd fleetpulse-monorepo
```

#### 2. Install dependencies

```bash
pnpm install
```

#### 3. Set up environment variables

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

#### 4. Spin up local infrastructure

```bash
docker-compose up -d
```

#### 5. Run database migrations

```bash
pnpm db:migrate
```

#### 6. Start development servers

```bash
pnpm dev
```

---

## 📜 Workspaces & Scripts

| Command          | Action                                                 |
| ---------------- | ------------------------------------------------------ |
| `pnpm dev`       | Start all applications concurrently in watch mode      |
| `pnpm build`     | Build all projects and shared packages for production  |
| `pnpm test`      | Execute unit and integration tests across the monorepo |
| `pnpm lint`      | Run linter and type-checking checks                    |
| `pnpm db:studio` | Open interactive database UI                           |

---

## 🤝 Contributing

1. Create a branch:

```bash
git checkout -b feature/amazing-feature
```

2. Commit your changes:

```bash
git commit -m "feat: add amazing feature"
```

3. Push to the branch:

```bash
git push origin feature/amazing-feature
```

4. Open a **Pull Request**.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
