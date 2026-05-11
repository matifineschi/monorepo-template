# Monorepo Template

TypeScript monorepo using Turborepo, Bun, and Biome.

## Quick Start

```sh
brew bundle           # install runtime deps (bun, node, docker, psql)
bun install           # install all workspace dependencies
docker compose up -d  # start Postgres on port 5430
bun run dev           # start all apps in parallel
```

## Repository Structure

```
apps/
  web/          → Next.js 16 frontend (port 3000)
  api/          → Hono backend API (port 3001)
  workers/      → BullMQ background workers (email, data export)
packages/
  ui/           → Shared React component library (shadcn/ui + Tailwind v4)
  queues/       → Shared BullMQ queue definitions and job types
  biome-config/ → Shared Biome lint/format configs
  typescript-config/ → Shared tsconfig presets
  infra/
    db/         → Drizzle ORM schema, migrations, and operations (Postgres)
    auth/       → better-auth config (email+password, Drizzle adapter)
```

## Commands

| Command | Description |
|---|---|
| `bun run dev` | Start all apps in dev mode |
| `bun run build` | Build all apps/packages |
| `bun run lint` | Lint via Biome |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run format` | Format all files via Biome |
| `bun run db:up` | Start Postgres container |
| `bun run db:down` | Stop Postgres container |
| `bun run db:reset` | Destroy and recreate Postgres volume |
| `turbo dev --filter=web` | Dev a single app |
| `turbo dev --filter=api` | Dev the API only |

## Conventions

- **Package manager**: Bun (see `packageManager` in root package.json)
- **Linting/formatting**: Biome — no Prettier/ESLint. Use tabs, double quotes
- **TypeScript**: Strict mode. Shared base config in `packages/typescript-config/base.json`
- **Styling**: Tailwind CSS v4 with PostCSS
- **Database**: Postgres 17 via Docker on port 5430. Drizzle ORM with snake_case columns, RLS policies
- **Auth**: better-auth with Drizzle adapter, email+password flow
- **Monorepo**: Turborepo with workspace dependencies via `workspace:*`
- **Workspace layout**: `apps/*` + `packages/*` + `packages/infra/*`

## Environment Variables

Required in `.env` (or `.env.local`):

```
DATABASE_URL=postgres://postgres:postgres@localhost:5430/postgres
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<random-secret>
CORS_ORIGIN=http://localhost:3000    # for the API app
PORT=3001                            # for the API app (default: 3001)
REDIS_URL=redis://localhost:6379     # for the API app and workers
```

## Adding a New Package

Use the Turborepo generator: `bun run gen:package`

## Database Workflow

```sh
cd packages/infra/db
bun run db:generate   # generate migration from schema changes
bun run db:migrate    # apply migrations
bun run db:push       # push schema directly (dev only)
```
