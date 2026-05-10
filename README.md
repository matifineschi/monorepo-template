# Monorepo Template

A full-stack TypeScript monorepo boilerplate built with Turborepo, Bun, Next.js, Hono, Drizzle, and better-auth.

## Stack

- **Runtime**: [Bun](https://bun.sh) + [Node.js](https://nodejs.org)
- **Monorepo**: [Turborepo](https://turborepo.dev)
- **Frontend**: [Next.js 16](https://nextjs.org) with React 19
- **Backend API**: [Hono](https://hono.dev) (lightweight, edge-ready)
- **Database**: [PostgreSQL 17](https://www.postgresql.org) via Docker
- **ORM**: [Drizzle ORM](https://orm.drizzle.team) with migrations and RLS policies
- **Auth**: [better-auth](https://www.better-auth.com) (email + password)
- **UI**: [shadcn/ui](https://ui.shadcn.com) component library with [Tailwind CSS v4](https://tailwindcss.com)
- **Linting/Formatting**: [Biome](https://biomejs.dev) (replaces ESLint + Prettier)
- **Language**: TypeScript (strict mode)

## Prerequisites

Install system dependencies via Homebrew:

```sh
brew bundle
```

This installs Bun, Node.js, PostgreSQL CLI, Docker, and Git.

## Getting Started

```sh
# Install dependencies
bun install

# Start the database
docker compose up -d

# Set up environment variables
cp .env.example .env  # then fill in values

# Run database migrations
cd packages/infra/db && bun run db:migrate && cd -

# Start all apps
bun run dev
```

The web app runs on `http://localhost:3000` and the API on `http://localhost:3001`.

## Project Structure

```
apps/
  web/              Next.js frontend — public pages, auth flow, dashboard
  api/              Hono backend API — REST endpoints, CORS, health checks
packages/
  ui/               Shared React component library (shadcn/ui)
  biome-config/     Shared Biome lint/format configurations
  typescript-config/ Shared TypeScript configurations
  infra/
    db/             Drizzle ORM — schema, migrations, typed queries
    auth/           better-auth — authentication config and client
```

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start all apps and packages in dev mode |
| `bun run build` | Build everything |
| `bun run lint` | Lint all packages with Biome |
| `bun run typecheck` | Type-check all packages |
| `bun run format` | Format all files with Biome |
| `bun run db:up` | Start PostgreSQL container |
| `bun run db:down` | Stop PostgreSQL container |
| `bun run db:reset` | Destroy and recreate the database |
| `bun run knip` | Find unused code and dependencies |

## Environment Variables

Create a `.env` file in the project root:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5430/postgres
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=your-secret-here
CORS_ORIGIN=http://localhost:3000
```

## Database

PostgreSQL runs in Docker on port **5430** (not the default 5432, to avoid conflicts).

```sh
# Generate a migration after modifying schema
cd packages/infra/db && bun run db:generate

# Apply migrations
cd packages/infra/db && bun run db:migrate

# Push schema directly (dev only)
cd packages/infra/db && bun run db:push
```

A [Drizzle Gateway](https://github.com/drizzle-team/gateway) UI is available at `http://localhost:3002` for database inspection.

## Adding New Packages

Use the built-in Turborepo generator:

```sh
bun run gen:package
```

## Filtering Tasks

Run commands for a specific app or package:

```sh
turbo dev --filter=web
turbo dev --filter=api
turbo build --filter=@repo/db
```
