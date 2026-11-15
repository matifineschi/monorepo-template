# Monorepo Template

A full-stack TypeScript monorepo boilerplate built with Turborepo, Bun, Next.js, Hono, Drizzle, better-auth and Resend. All business logic lives in one package, `@repo/features`, which every app calls — see [docs/architecture.md](./docs/architecture.md).

> Working in this repo with an AI agent? [AGENTS.md](./AGENTS.md) is the single source of truth for conventions.

## Stack

- **Runtime**: [Bun](https://bun.sh) + [Node.js](https://nodejs.org)
- **Monorepo**: [Turborepo](https://turborepo.dev)
- **Frontend**: [Next.js 16](https://nextjs.org) with React 19
- **Backend API**: [Hono](https://hono.dev) (lightweight, edge-ready)
- **Background jobs**: [BullMQ](https://docs.bullmq.io) on Redis
- **Scheduled ops**: one-shot backup jobs run by the platform's cron — nightly database and bucket backups, with weekly restore checks
- **Deployment**: one Dockerfile per app; no platform lock-in
- **Database**: [PostgreSQL 17](https://www.postgresql.org) via Docker
- **ORM**: [Drizzle ORM](https://orm.drizzle.team) with migrations and RLS policies
- **Auth**: [better-auth](https://www.better-auth.com) (email + password, password reset)
- **Email**: [Resend](https://resend.com) with [React Email](https://react.email) templates styled from the Astryx theme; logs instead of sending in development
- **File storage**: S3-compatible — [Silo](https://silo.pgsty.com) (MinIO-compatible) locally, any S3 API in production
- **Env validation**: [@t3-oss/env](https://env.t3.gg) + [Zod](https://zod.dev), validated at boot
- **Logging**: [pino](https://getpino.io) — structured, one config, every server process
- **Testing**: `bun test` — unit, plus integration against an isolated docker stack
- **CI**: GitHub Actions — lint, typecheck, unit, integration, build
- **UI**: [Astryx](https://astryx.atmeta.com) — Meta's open source design system (150+ accessible components, token-driven theming, dark mode)
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
bun install
```

```sh
docker compose up -d
```

Each app owns its own environment file — there is no root `.env`:

```sh
for d in apps/web apps/api apps/workers packages/infra/db; do cp "$d/.env.example" "$d/.env"; done
```

Then set the **same** `BETTER_AUTH_SECRET` in `apps/web/.env` and `apps/api/.env`
(sessions minted by one service won't validate in the other otherwise):

```sh
openssl rand -base64 32
```

Run the migrations and start everything:

```sh
bun run --filter @repo/db db:migrate && bun run dev
```

| Service                        | URL                                             |
| ------------------------------ | ----------------------------------------------- |
| Web                            | http://localhost:3000                           |
| API                            | http://localhost:3001                           |
| Drizzle Gateway (DB inspector) | http://localhost:3002                           |
| Silo console                   | http://localhost:9001 (minioadmin / minioadmin) |

Postgres listens on **5430**, not the default 5432, to avoid clashing with a local install.

## Project Structure

```
apps/
  web/              Next.js frontend — public pages, auth flow, dashboard
  api/              Hono backend API — REST endpoints, CORS, presigned uploads
  workers/          BullMQ workers — wiring for the email and file queues
  cron/             One-shot infra jobs — database + bucket backups and restore checks
packages/
  features/         All business logic — auth, users, email, files, system
  ui/               Astryx theme layer (globals.css, providers, theme)
  queues/           BullMQ queue definitions and job payload types
  utils/            createError + Result — the shared error model
  logger/           pino logger used by every server process
  env/              Env-validation helpers and baseEnv
  typescript-config/ Shared TypeScript configurations
  infra/
    db/             Drizzle ORM — schema, migrations, operations DAL
    auth/           better-auth — createAuth() and the browser client
    storage/        S3-compatible object storage
    email/          Resend — render, send, retry
```

Imports point down: **apps → `@repo/features` → `packages/infra/*`**. Apps never
import an infra package (Biome enforces it), so the database, auth library, bucket
and mail provider are each one package's concern. The full rules, the
exceptions and "where does this code go?" are in
[docs/architecture.md](./docs/architecture.md).

## Scripts

| Command                    | Description                                                   |
| -------------------------- | ------------------------------------------------------------- |
| `bun run dev`              | Start all apps in dev mode                                    |
| `bun run build`            | Build everything                                              |
| `bun run typecheck`        | Type-check all packages                                       |
| `bun run format`           | Apply Biome fixes and organize imports                        |
| `bun run format:check`     | Check formatting and lint without writing                     |
| `bun run lint:ws`          | Check dependency versions across workspaces (sherif)          |
| `bun run test`             | Run unit tests — no Docker needed                             |
| `bun run test:integration` | Run integration tests (requires the test stack)               |
| `bun run ci`               | Everyday gate: format check + sherif + typecheck + unit tests |
| `bun run ci:full`          | Ship gate: `ci` + knip + build + integration tests            |
| `bun run knip`             | Find unused code and dependencies                             |
| `bun run db:up`            | Start the dev Docker stack                                    |
| `bun run db:wait`          | Start it and block until healthy                              |
| `bun run db:down`          | Stop the containers                                           |
| `bun run db:reset`         | Destroy and recreate the volumes                              |
| `bun run test-infra:up`    | Start the test Docker stack and wait for health               |
| `bun run test-infra:down`  | Stop it and drop its volume                                   |
| `bun run test-infra:logs`  | Last 200 lines from the test stack                            |
| `bun run gen:package`      | Scaffold a new workspace package                              |

## Environment Variables

Every app owns a `.env.example` documenting what it needs and why. There is no
root `.env` — under `turbo run dev` each app runs with its own workspace as cwd
and only reads from there.

| File                                                               | Owns                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------ |
| [apps/web/.env.example](./apps/web/.env.example)                   | Database, auth, Redis, email, `NEXT_PUBLIC_APP_URL`          |
| [apps/api/.env.example](./apps/api/.env.example)                   | Database, auth, Redis, storage, email, CORS, port, log level |
| [apps/workers/.env.example](./apps/workers/.env.example)           | Redis, storage, email, concurrency, log level                |
| [packages/infra/db/.env.example](./packages/infra/db/.env.example) | `DATABASE_URL` for drizzle-kit                               |

Values are validated with Zod at process start, so a missing or malformed
variable fails immediately with the variable named — not later, mid-request.
See [AGENTS.md](./AGENTS.md#environment-variables) for the ownership rules.

## Testing

```sh
bun run test              # unit — no Docker needed
bun run test-infra:up     # bring the test stack up and wait for health
bun run test:integration  # integration — real Postgres, Redis, MinIO
```

| Layer       | Location                      | Talks to                                    |
| ----------- | ----------------------------- | ------------------------------------------- |
| Unit        | `src/**/__tests__/*.test.ts`  | nothing                                     |
| Integration | `tests/integration/*.test.ts` | the test stack in `docker-compose.test.yml` |

Integration tests run against a **separate docker stack** on offset ports
(54322 / 63792 / 59002), so they can drop databases and empty buckets while
`bun run dev` keeps running against the dev stack.

Each run gets its own database, its own bucket and its own Redis key prefix.
The database is cloned from a template that the migrations are applied to once
and keyed by a fingerprint of the `migrations/` folder, so a clone costs
milliseconds and the template is rebuilt only when a migration changes. Nothing
is shared between runs, which is why the suites run in parallel and need no
hand-written cleanup.

Run tests from a workspace or via turbo, not `bun test` at the repo root — the
per-workspace `bunfig.toml` preload doesn't apply there.

## File Storage

Uploads use presigned URLs: the browser asks the API for one and uploads
directly to the bucket, so the web app never holds bucket credentials. Keys are
derived server-side as `uploads/<userId>/<uuid><ext>` and that prefix is the
authorization boundary. Deletion is queued and performed by `apps/workers`.

Storage is stateless — there is intentionally no `files` table, since not every
project wants file metadata in Postgres. See
[packages/infra/storage/README.md](./packages/infra/storage/README.md).

## Email

`@repo/email` sends through [Resend](https://resend.com); `@repo/features/email`
decides what is sent. Two emails ship: **welcome** (queued at sign-up, sent by
`apps/workers`) and **password reset** (`/forgot-password` → emailed one-time
link → `/reset-password`). Templates are React Email components styled only
from the resolved Astryx theme, so they match the app.

With `EMAIL_TRANSPORT=log` (the default) every email is rendered to the log
instead of sent — no account needed. To send for real, create a
**sending-access** key at [resend.com/api-keys](https://resend.com/api-keys),
then in `apps/{web,api,workers}/.env` set `EMAIL_TRANSPORT=resend` and
`RESEND_API_KEY`. Until you verify a domain, `EMAIL_FROM` must stay
`onboarding@resend.dev`, which only delivers to your own Resend address.

```sh
bun run --filter @repo/features email:dev   # preview templates at :3030
```

## Deployment

Platform-agnostic by design: one `Dockerfile` per app, and no `railway.json`,
`vercel.json` or `fly.toml` anywhere. The repo satisfies a deploy _contract_ —
env-only config, injected port, JSON logs on stdout, `SIGTERM` draining,
separate `/health` and `/ready`, migrations as a release step — and the ten
lines of host-specific glue belong to your project.

```sh
docker build -f apps/api/Dockerfile -t api .   # context is the repo ROOT
```

CI builds all four images and boots the API against the test stack until
`/ready` returns 200, so deployability is tested rather than asserted. Recipes
for Railway, Fly, Vercel, Compose and Kubernetes are in
[docs/deployment.md](./docs/deployment.md).

## Backups

`apps/cron` is four one-shot jobs, each scheduled as a cron entry on your
platform (`bun run dist/main.js <job>`): a nightly `pg_dump`, checked before it
is uploaded; a nightly incremental `rclone copy` of the application's bucket
into a versioned backup bucket that expires noncurrent versions after 90 days;
and weekly checks that restore the dump into a
throwaway database and re-download a sample of files to compare byte for byte.

A database backup without the files is only half a recovery — restore the rows
and every uploaded document is a dead link.

It is a separate service from `apps/workers` on purpose: a backup must not share
a failure domain with what it backs up. A crash-looping app deploy or a Redis
outage must not be able to stop backups silently. See
[docs/backups.md](./docs/backups.md) for the full reasoning, the bucket settings
the application cannot make for you, and how to restore for real.

## Errors and Logging

`@repo/utils` holds the error model: `createError(message, { cause, context })`
for errors with a static message and structured context, and `Result<R, Code>`
plus `tryResult` / `tryAsyncResult` for outcomes a caller should branch on.

`@repo/logger` is pino with one configuration, used by every server process.
Log structured fields rather than interpolated strings; `console` is a lint
error. Errors on the `err` field keep their `context` and their whole `cause`
chain, both of which pino's default serializer drops.

## Continuous Integration

[.github/workflows/ci.yml](./.github/workflows/ci.yml) runs on every pull
request, on pushes to `main`, and in a merge group:

| Job         | What it runs                                                         |
| ----------- | -------------------------------------------------------------------- |
| check       | `bun run ci`, then `bun run knip`                                    |
| integration | brings up `docker-compose.test.yml`, then `bun run test:integration` |
| build       | copies each `.env.example` to `.env`, then `bun run build`           |

CI uses the same compose file developers use, so the two cannot drift.

## Database

```sh
bun run --filter @repo/db db:generate   # generate a migration from schema changes
bun run --filter @repo/db db:migrate    # apply migrations
bun run --filter @repo/db db:push       # push schema directly (dev only)
```

Schema conventions — one file per table, the operations DAL, and how to add a
table — are documented in
[packages/infra/db/README.md](./packages/infra/db/README.md).

## Git Hooks

Husky installs on `bun install`:

- **pre-commit** → `bun run format:check`
- **pre-push** → `bun run ci`

If pre-commit fails, `bun run format` fixes it.

## Adding New Packages

```sh
bun run gen:package
```

Scaffolds the package with its tsconfig, test harness, and a starter test, and
asks whether it needs environment variables. Linting and formatting are
repo-wide — there is one Biome config, at the root.

## Filtering Tasks

```sh
turbo dev --filter=web
turbo test --filter=@repo/storage
```
