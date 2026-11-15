# Monorepo Template

A full-stack TypeScript monorepo boilerplate: a Next.js web app, a Hono API,
BullMQ workers and a backup service. It is built on Bun, Turborepo, Drizzle,
better-auth, Resend and the Astryx design system.

The convention that shapes everything else: **all business logic lives in one
package, `@repo/features`, which every app calls, and no app touches the
database, auth library, bucket or mail provider directly.** See
[Architecture](#architecture) and [docs/architecture.md](./docs/architecture.md).

> Working in this repo with an AI agent? [AGENTS.md](./AGENTS.md) is the single
> source of truth for conventions.

## Stack

- **Runtime**: [Bun](https://bun.sh) + [Node.js](https://nodejs.org)
- **Monorepo**: [Turborepo](https://turborepo.dev)
- **Frontend**: [Next.js 16](https://nextjs.org) with React 19
- **Backend API**: [Hono](https://hono.dev) (lightweight, edge-ready)
- **Background jobs**: [BullMQ](https://docs.bullmq.io) on Redis
- **Scheduled ops**: one-shot backup jobs run by the platform's cron: nightly database and bucket backups, with weekly restore checks
- **Deployment**: one Dockerfile per app; no platform lock-in
- **Database**: [PostgreSQL 17](https://www.postgresql.org) via Docker
- **ORM**: [Drizzle ORM](https://orm.drizzle.team) with migrations and RLS policies
- **Auth**: [better-auth](https://www.better-auth.com): email + password, password reset
- **Email**: [Resend](https://resend.com) + [React Email](https://react.email), with templates styled from the Astryx theme; rendered to the log instead of sent in development
- **File storage**: S3-compatible: [Silo](https://silo.pgsty.com) (MinIO-compatible) locally, any S3 API in production
- **Env validation**: [@t3-oss/env](https://env.t3.gg) + [Zod](https://zod.dev), validated at boot
- **Logging**: [pino](https://getpino.io): structured, one config, every server process
- **Testing**: `bun test`: unit, plus integration against an isolated docker stack
- **CI**: GitHub Actions: lint, typecheck, unit, integration, build, and Docker images that boot
- **UI**: [Astryx](https://astryx.atmeta.com), Meta's open source design system (150+ accessible components, token-driven theming, dark mode)
- **Linting/Formatting**: [Biome](https://biomejs.dev) (replaces ESLint + Prettier), which also enforces the package boundaries
- **Language**: TypeScript (strict mode)

## Prerequisites

Install system dependencies via Homebrew:

```sh
brew bundle
```

This installs Bun, Node.js, the PostgreSQL CLI, Docker and Git.

## Getting Started

```sh
bun install
```

```sh
docker compose up -d
```

Each app owns its own environment file. There is no root `.env`:

```sh
for d in apps/web apps/api apps/workers packages/infra/db; do cp "$d/.env.example" "$d/.env"; done
```

Then set the **same** `BETTER_AUTH_SECRET` in `apps/web/.env` and
`apps/api/.env`. Sessions minted by one service won't validate in the other
otherwise:

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
| Email template preview         | http://localhost:3030 (run `email:dev`, below)  |
| Silo console                   | http://localhost:9001 (minioadmin / minioadmin) |

Postgres listens on **5430**, not the default 5432, so it doesn't clash with a
local install.

Out of the box you can sign up, sign in, sign out and reset a password at
`/sign-up`, `/sign-in` and `/forgot-password`. Emails are not sent until you
configure Resend. Each one is rendered into the terminal instead: the welcome
email in the workers log, the reset email in the web log. That is where you
find the reset link. See [Email](#email).

## Architecture

```
apps/                 web · api · workers · cron
  │                   routes, pages, server actions, BullMQ wiring
  ▼
packages/features     @repo/features: all business logic
  │                   auth · users · email · files · system
  ▼
packages/infra/*      @repo/db · @repo/auth · @repo/storage · @repo/email
                      each owns a connection to one external system

packages/*            @repo/queues · @repo/logger · @repo/utils · @repo/env · @repo/ui
                      shared, logic-free, importable from any layer
```

Imports only point down:

- **Apps never import `packages/infra/*`.** A page calls `getSession`, a route
  calls `createUserUploadUrl`, a worker calls `processEmailJob`. There are no
  queries, SDK calls or business rules in an app.
- **`@repo/features` is the only caller of infrastructure.** Each module is its
  own subpath (`@repo/features/auth`, `/users`, `/email`, `/files`, `/system`),
  so a worker that only deletes files never loads auth or needs a database.
- **Infra packages own a connection, not behaviour.** `@repo/auth` builds the
  auth instance but doesn't decide what happens on sign-up. `@repo/storage`
  stores any key but doesn't decide who owns it. `@repo/email` sends but has no
  templates.
- **Nothing under `packages/` imports `@repo/features`.**

App source has three allowed exceptions:

- an infra package's `./env` subpath, so the app can compose and validate env
  at boot;
- `@repo/auth/client`, the browser SDK;
- anything in tests, for fixtures.

`apps/cron` deliberately doesn't depend on features: a backup must keep working
when the application is broken.

These rules are **lint errors**, not conventions: Biome's
`noRestrictedImports` fails `bun run ci` on any import that crosses a boundary.

**Where does new code go?**

| You're adding…                                                    | Put it in                        |
| ----------------------------------------------------------------- | -------------------------------- |
| A rule about the product: permissions, naming, what an email says | `packages/features/src/<module>` |
| A connection to a new external system (payments, SMS, search)     | a new `packages/infra/<name>`    |
| A table or a query                                                | `@repo/db` (schema + operation)  |
| The decision of when to run that query                            | `@repo/features`                 |
| A route, page, form or queue worker                               | the app, calling features        |
| A logic-free helper, type or queue payload                        | `packages/*`                     |

The full rules, the import matrix, how the Biome overrides work and a worked
example are in [docs/architecture.md](./docs/architecture.md).

## Project Structure

```
apps/
  web/              Next.js: public pages, auth pages, dashboard
  api/              Hono: REST endpoints, CORS, presigned uploads, /health + /ready
  workers/          BullMQ wiring for the email and file queues (job bodies live in features)
  cron/             One-shot infra jobs: database + bucket backups and restore checks
packages/
  features/         All business logic: auth, users, email, files, system
  ui/               Astryx theme layer: globals.css, providers, and the theme object
  queues/           BullMQ queue definitions and job payload types
  utils/            createError + Result: the shared error model
  logger/           pino logger used by every server process
  env/              Env-validation helpers and baseEnv
  typescript-config/ Shared TypeScript configurations
  infra/
    db/             Drizzle: schema, migrations, operations DAL
    auth/           better-auth: createAuth() and the browser client
    storage/        S3-compatible object storage
    email/          Resend: render, send, retry, log transport
docs/
  architecture.md   Layers, boundaries, and where code goes
  deployment.md     The deploy contract and per-platform recipes
  backups.md        The backup service and how to restore
```

Every package has a README with its own conventions:
[features](./packages/features/README.md), [db](./packages/infra/db/README.md),
[auth](./packages/infra/auth/README.md),
[storage](./packages/infra/storage/README.md),
[email](./packages/infra/email/README.md).

## Scripts

| Command                                     | Description                                                   |
| ------------------------------------------- | ------------------------------------------------------------- |
| `bun run dev`                               | Start all apps in dev mode                                    |
| `bun run build`                             | Build everything                                              |
| `bun run typecheck`                         | Type-check all packages                                       |
| `bun run format`                            | Apply Biome fixes and organize imports                        |
| `bun run format:check`                      | Check formatting, lint and package boundaries without writing |
| `bun run lint:ws`                           | Check dependency versions across workspaces (sherif)          |
| `bun run test`                              | Run unit tests (no Docker needed)                             |
| `bun run test:integration`                  | Run integration tests (requires the test stack)               |
| `bun run ci`                                | Everyday gate: format check + sherif + typecheck + unit tests |
| `bun run ci:full`                           | Ship gate: `ci` + knip + build + integration tests            |
| `bun run knip`                              | Find unused code and dependencies                             |
| `bun run db:up`                             | Start the dev Docker stack                                    |
| `bun run db:wait`                           | Start it and block until healthy                              |
| `bun run db:down`                           | Stop the containers                                           |
| `bun run db:reset`                          | Destroy and recreate the volumes                              |
| `bun run test-infra:up`                     | Start the test Docker stack and wait for health               |
| `bun run test-infra:down`                   | Stop it and drop its volume                                   |
| `bun run test-infra:logs`                   | Last 200 lines from the test stack                            |
| `bun run gen:package`                       | Scaffold a new workspace package                              |
| `bun run --filter @repo/features email:dev` | Preview every email template at http://localhost:3030         |

## Environment Variables

Every app owns a `.env.example` documenting what it needs and why. There is no
root `.env`: under `turbo run dev` each app runs with its own workspace as cwd
and only reads from there.

| File                                                               | Owns                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------ |
| [apps/web/.env.example](./apps/web/.env.example)                   | Database, auth, Redis, email, `NEXT_PUBLIC_APP_URL`          |
| [apps/api/.env.example](./apps/api/.env.example)                   | Database, auth, Redis, storage, email, CORS, port, log level |
| [apps/workers/.env.example](./apps/workers/.env.example)           | Redis, storage, email, concurrency, log level                |
| [packages/infra/db/.env.example](./packages/infra/db/.env.example) | `DATABASE_URL` for drizzle-kit                               |

Each infra package owns its variables (`@repo/email` owns `EMAIL_*` and
`RESEND_API_KEY`, `@repo/storage` owns `STORAGE_*`, and so on), and an app
extends the env of every package its features reach. Values are validated with
Zod at process start, so a missing or malformed variable fails immediately with
the variable named, not later mid-request. See
[AGENTS.md](./AGENTS.md#environment-variables) for the ownership rules.

## Auth

better-auth, email + password. `@repo/auth` exposes `createAuth(options)`; the
application's instance lives in `@repo/features/auth`, which wires what happens
on sign-up (create the profile row, queue the welcome email) and on a reset
request (send the reset email). Apps call `getSession`, `signInWithEmail`,
`signUpWithEmail`, `requestPasswordReset` and `resetPassword`. Each returns a
`Result` with domain codes such as `"email-taken"` or `"invalid-token"`, never
better-auth's own errors.

Password reset runs:

1. `/forgot-password`. The page gives the same answer whether or not the
   address has an account.
2. The user gets an email with a one-time link.
3. The link opens `/reset-password`.
4. The new password is saved and every existing session is signed out.
5. The user lands on `/sign-in` with a confirmation.

Expired or used links land on a "Link expired" page.

## Email

Two packages, split like everything else:

- **`@repo/email`** owns Resend. It renders React to HTML and text, sends
  with an idempotency key, retries network errors, 5xx and 429, and returns a
  `Result`. It never throws for a delivery failure.
- **`@repo/features/email`** owns what is sent and when: the templates,
  subjects and idempotency keys (`welcome-user/<id>`,
  `password-reset/<token>`).

Two emails ship:

- **Welcome** is queued at sign-up and sent by `apps/workers`, so a mail
  outage never fails a sign-up and BullMQ retries it.
- **Password reset** is sent from the reset request without being awaited,
  so a registered address doesn't answer measurably slower than an unknown one.

**Templates match the app.** Astryx components can't render in email clients,
so the templates use React Email primitives styled **only** with values that
Astryx's own resolver pulls from the theme the web app uses (`@repo/ui/theme`).
Change the theme and the emails follow. Preview them with
`bun run --filter @repo/features email:dev`.

**Sending for real.** With `EMAIL_TRANSPORT=log` (the default) every email is
rendered to the log and nothing is sent. To send through Resend:

1. Create a **sending-access** key at
   [resend.com/api-keys](https://resend.com/api-keys). Don't use a full-access
   key, and never commit it.
2. In `apps/web/.env`, `apps/api/.env` and `apps/workers/.env`, set:

   ```sh
   EMAIL_TRANSPORT=resend
   RESEND_API_KEY=re_...
   ```

3. Until a domain is verified, keep `EMAIL_FROM="Acme <onboarding@resend.dev>"`.
   Resend only delivers that sender to your own account address.
4. To send to anyone, verify a sending subdomain (e.g. `mail.example.com`) in
   the [Resend dashboard](https://resend.com/domains). Then point `EMAIL_FROM`
   at it and restrict the key to that domain.

Details are in [packages/infra/email/README.md](./packages/infra/email/README.md).

## File Storage

Uploads use presigned URLs: the browser asks the API for one and uploads
directly to the bucket, so the web app never holds bucket credentials. Keys are
derived server-side as `uploads/<userId>/<uuid><ext>`, and that prefix is the
authorization boundary.

The key and ownership policy lives in `@repo/features/files`; `@repo/storage`
just stores what it is given. Deletion is queued and performed by
`apps/workers`.

Storage is stateless. There is intentionally no `files` table, since not every
project wants file metadata in Postgres. See
[packages/infra/storage/README.md](./packages/infra/storage/README.md).

## Testing

```sh
bun run test              # unit, no Docker needed
bun run test-infra:up     # bring the test stack up and wait for health
bun run test:integration  # integration: real Postgres, Redis, MinIO
```

| Layer       | Location                      | Talks to                                    |
| ----------- | ----------------------------- | ------------------------------------------- |
| Unit        | `src/**/__tests__/*.test.ts`  | nothing                                     |
| Integration | `tests/integration/*.test.ts` | the test stack in `docker-compose.test.yml` |

Business rules are unit-tested in `packages/features`, with side effects
injected instead of mocked: a recording email sender, a recording deleter.
Apps keep only the tests of their own glue: route status codes, the queue →
worker round trip, sign-up over HTTP.

Integration tests run against a **separate docker stack** on offset ports
(54322 / 63792 / 59002), so they can drop databases and empty buckets while
`bun run dev` keeps running against the dev stack.

Each run gets its own database, its own bucket and its own Redis key prefix.
The migrations are applied once to a template database, which is keyed by a
fingerprint of the `migrations/` folder. Each run clones it, so a clone costs
milliseconds and the template is rebuilt only when a migration changes.
Nothing is shared between runs, which is why the suites run in parallel and
need no hand-written cleanup.

Run tests from a workspace or via turbo, not `bun test` at the repo root: the
per-workspace `bunfig.toml` preload doesn't apply there.

## Deployment

Platform-agnostic by design: one `Dockerfile` per app, and no `railway.json`,
`vercel.json` or `fly.toml` anywhere. The repo satisfies a deploy _contract_
and leaves the ten lines of host-specific glue to your project:

- config from env only;
- an injected port;
- JSON logs on stdout;
- `SIGTERM` draining;
- separate `/health` and `/ready`;
- migrations as a release step.

```sh
docker build -f apps/api/Dockerfile -t api .   # context is the repo ROOT
```

CI builds all four images and boots the API against the test stack until
`/ready` returns 200, so deployability is tested rather than asserted. Recipes
for Railway, Fly, Vercel, Compose and Kubernetes are in
[docs/deployment.md](./docs/deployment.md).

## Backups

`apps/cron` is four one-shot jobs, each scheduled as a cron entry on your
platform (`bun run dist/main.js <job>`):

- a nightly `pg_dump`, checked before it is uploaded;
- a nightly incremental `rclone copy` of the application's bucket into a
  versioned backup bucket, which expires noncurrent versions after 90 days;
- weekly checks that restore the dump into a throwaway database and
  re-download a sample of files to compare byte for byte.

A database backup without the files is only half a recovery: restore the rows
and every uploaded document is a dead link.

It is a separate service from `apps/workers`, and it doesn't use
`@repo/features`, on purpose: a backup must not share a failure domain with
what it backs up. A crash-looping app deploy or a Redis outage must not be able
to stop backups silently. See [docs/backups.md](./docs/backups.md) for the
full reasoning, the bucket settings the application cannot make for you, and
how to restore for real.

## Errors and Logging

`@repo/utils` holds the error model:

- `createError(message, { cause, context })` for errors with a static message
  and structured context;
- `Result<R, Code>`, plus `tryResult` / `tryAsyncResult`, for outcomes a caller
  should branch on. Features return these with domain codes, and apps map each
  code to a message or a status.

`@repo/logger` is pino with one configuration, used by every server process.
Log structured fields rather than interpolated strings; `console` is a lint
error. Errors on the `err` field keep their `context` and their whole `cause`
chain, both of which pino's default serializer drops.

## Continuous Integration

[.github/workflows/ci.yml](./.github/workflows/ci.yml) runs on every pull
request, on pushes to `main`, and in a merge group:

| Job         | What it runs                                                               |
| ----------- | -------------------------------------------------------------------------- |
| check       | `bun run ci` (including the boundary lint), then `bun run knip`            |
| integration | brings up `docker-compose.test.yml`, then `bun run test:integration`       |
| build       | copies each `.env.example` to `.env`, then `bun run build`                 |
| images      | builds all four Docker images and boots the API until `/ready` returns 200 |

CI uses the same compose file developers use, so the two cannot drift.

## Database

```sh
bun run --filter @repo/db db:generate   # generate a migration from schema changes
bun run --filter @repo/db db:migrate    # apply migrations
bun run --filter @repo/db db:push       # push schema directly (dev only)
```

Only `@repo/features` reads or writes the database, through the typed
operations in `@repo/db/operations/*`. Schema conventions, the operations DAL
and how to add a table are in
[packages/infra/db/README.md](./packages/infra/db/README.md).

## Git Hooks

Husky installs on `bun install`:

- **pre-commit** → `bun run format:check`
- **pre-push** → `bun run ci`

If pre-commit fails, `bun run format` fixes it.

## Adding New Code

New business logic is usually **a module in `@repo/features`**, not a new
package. Add `packages/features/src/<module>/index.ts` and its subpath in
`packages/features/package.json`, then call it from the app.
[docs/architecture.md](./docs/architecture.md#adding-a-features-module) has the
checklist.

A new package is for a new external system (`packages/infra/<name>`) or a
logic-free shared helper (`packages/<name>`):

```sh
bun run gen:package
```

This scaffolds the package with its tsconfig, test harness and a starter test,
and asks whether it needs environment variables. Linting and formatting are
repo-wide: there is one Biome config, at the root. A new infra package also
needs a `noRestrictedImports` entry so only it may import its SDK.

## Filtering Tasks

```sh
turbo dev --filter=web
turbo test --filter=@repo/features
```
