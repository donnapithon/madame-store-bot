# Madame Store - Telegram Bot Digital Store

## Overview

This is a Telegram bot-based digital store ("Madame Store") that sells digital products/accounts. Users interact entirely through a Telegram bot to browse categories, purchase products, recharge their balance via PIX payments (Brazilian payment method), and redeem gift codes. The system includes an admin panel (via Telegram) for managing products, stock, categories, gifts, and user balances.

The project uses a full-stack TypeScript architecture with an Express backend, React frontend (minimal, mostly for health/status), SQLite database with Drizzle ORM, Telegraf for the Telegram bot, and VizzionPay for PIX payment processing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Overall Structure

The project follows a monorepo layout with three main directories:

- **`server/`** — Express backend + Telegram bot logic
- **`client/`** — React frontend (Vite-based, minimal role — the primary interface is the Telegram bot)
- **`shared/`** — Shared schema definitions and route contracts used by both server and client

### Backend (`server/`)

- **`server/index.ts`** — Entry point. Creates Express app and HTTP server, registers routes, listens on port 5000.
- **`server/bot.ts`** — Core Telegram bot logic using Telegraf. Handles all user interactions: welcome messages, balance display, product browsing, purchasing flow, PIX recharge, gift redemption, and admin commands. The bot is the primary user interface.
- **`server/routes.ts`** — Express route registration. Starts the bot, provides a health check endpoint, and handles VizzionPay webhook callbacks for payment confirmation at `/api/webhook/vizzionpay`.
- **`server/mercadopago.ts`** — VizzionPay integration for creating PIX payments and checking payment status. Uses VizzionPay REST API with `x-public-key` and `x-secret-key` headers. API base: `https://app.vizzionpay.com/api/v1`.
- **`server/storage.ts`** — Data access layer implementing `IStorage` interface with `SQLiteStorage` class. Handles all CRUD operations for users, products, stock, payments, gifts, categories, and settings.
- **`server/db.ts`** — Database connection using `better-sqlite3` with Drizzle ORM. Database file is `sqlite.db`.
- **`server/vite.ts`** — Vite dev server middleware for development mode.
- **`server/static.ts`** — Static file serving for production builds.

### Frontend (`client/`)

- Built with React + Vite + TypeScript
- Uses shadcn/ui component library (new-york style) with Tailwind CSS
- Uses TanStack React Query for data fetching
- The frontend plays a minimal role — the main user interface is the Telegram bot
- Path aliases: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Database

- **SQLite** via `better-sqlite3` — the active database connection
- **Drizzle ORM** for schema definition and queries
- Schema defined in `shared/schema.ts` using SQLite column types (`sqliteTable`, `text`, `integer`, `real`)
- There is also a `drizzle.config.ts` for PostgreSQL (uses `DATABASE_URL` env var) — this exists for potential migration to Postgres but is **not actively used**
- The active Drizzle config for the project is `drizzle.sqlite.config.ts`

**Database Tables:**
- `users` — Telegram user ID as primary key, balance, blocked status
- `categories` — Product categories
- `products` — Products with category reference, name, price, description
- `stock` — Individual stock items (digital content) linked to products, tracking sold status
- `gifts` — Gift codes with values, redemption tracking
- `payments` — PIX payment records with VizzionPay transaction ID and status
- `settings` — Key-value settings store (e.g., PIX bonus percentage)

### Key Design Decisions

1. **Telegram Bot as Primary UI**: All user interaction happens via Telegram bot rather than a web interface. This simplifies the UX for the target Brazilian market.

2. **SQLite over PostgreSQL**: The project currently uses SQLite for simplicity and zero-configuration. There's a PostgreSQL config available if scaling is needed. When running `db:push`, use the appropriate config flag.

3. **PIX Payment Flow**: Users request a recharge amount → system creates a VizzionPay PIX payment → user pays → webhook or polling confirms payment → balance is credited with optional bonus.

4. **Bonus System**: Recharges of R$20+ receive a configurable bonus percentage (default 100%), stored in the settings table.

5. **Stock-based Product Delivery**: Products are delivered as individual stock items (text content). When purchased, a stock item is marked as sold and its content is delivered to the buyer.

### Build & Run

- **Dev**: `npm run dev` — runs with tsx, Vite dev server for HMR
- **Build**: `npm run build` — builds client with Vite, bundles server with esbuild
- **Start**: `npm start` — runs production build
- **DB Push**: `npm run db:push` — pushes schema to database (defaults to PostgreSQL config; for SQLite use `drizzle-kit push --config=drizzle.sqlite.config.ts`)

## External Dependencies

### Telegram Bot API (via Telegraf)
- Bot token is hardcoded in `server/bot.ts`
- Bot handles all user-facing interactions
- Admin commands restricted to a specific Telegram user ID

### VizzionPay Payment Gateway
- API credentials stored as environment secrets (VIZZION_PAY_PUBLIC, VIZZION_PAY_SECRET)
- Used for PIX payment generation and status checking
- Webhook endpoint at `/api/webhook/vizzionpay` for payment notifications
- 10-minute payment expiration

### Database
- SQLite file (`sqlite.db`) — local file-based database
- Drizzle ORM for schema management and queries
- PostgreSQL config exists but is not the active database

### Key NPM Dependencies
- `telegraf` — Telegram bot framework
- `node-fetch` — Used for VizzionPay API calls and Telegram API messages
- `better-sqlite3` — SQLite driver
- `drizzle-orm` / `drizzle-kit` — ORM and migration tooling
- `express` v5 — HTTP server
- `react` / `vite` — Frontend (minimal usage)
- `@tanstack/react-query` — Data fetching on frontend
- `shadcn/ui` + `tailwindcss` — UI component library
- `node-fetch` — Used for sending Telegram API messages directly in webhook handler