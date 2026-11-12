# AGENTS.md

Operating guide for AI coding agents working in this repo. Keep changes small and
focused, follow the conventions below rather than inventing new ones, and run the
verification commands in [Before declaring a change done](#before-declaring-a-change-done)
before you claim anything works.

## What this repo is

A full-stack TypeScript monorepo **template**: Next.js web app, Hono API, BullMQ
workers, Drizzle/Postgres, better-auth, and S3-compatible file storage.

It is a starting point, not a product. That makes the conventions the actual
deliverable — a feature added the wrong way costs more here than it would in an
application, because every project generated from this repo inherits it.

See [README.md](./README.md) for the human-facing overview.

## Quick start

```sh
brew bundle                       # bun, node, docker, psql
bun install                       # also installs the husky git hooks
docker compose up -d              # postgres, redis, minio, drizzle-gateway
bun run test-infra:up             # the separate stack the test suites use

cp apps/web/.env.example          apps/web/.env
cp apps/api/.env.example          apps/api/.env
cp apps/workers/.env.example      apps/workers/.env
cp packages/infra/db/.env.example packages/infra/db/.env
# then set the SAME BETTER_AUTH_SECRET in apps/web/.env and apps/api/.env:
#   openssl rand -base64 32

bun run --filter @repo/db db:migrate
bun run dev
```

| Service | Port | Notes |
|---|---|---|
| web | 3000 | Next.js |
| api | 3001 | Hono on Bun |
| drizzle-gateway | 3002 | DB inspector UI |
| postgres | 5430 | Host mapping; container is on 5432 |
| redis | 6379 | |
| minio | 9000 | S3 API. Image is `pgsty/silo`, not `minio/minio` |
| minio console | 9001 | minioadmin / minioadmin |

Postgres is on **5430, not 5432**, deliberately, so it doesn't clash with a
locally-installed Postgres.

The test stack in `docker-compose.test.yml` is separate and runs at the same
time, on offset ports:

| Service | Port |
|---|---|
| test postgres | 54322 |
| test redis | 63792 |
| test minio | 59002 (console 59003) |

Two stacks because integration suites drop databases and empty buckets — which
is correct there and destructive against the stack `bun run dev` is using. See
[Testing](#testing).

## Repository layout

```
apps/
  web/          Next.js 16 frontend
  api/          Hono backend API
  workers/      BullMQ background workers
packages/
  ui/           Astryx theme layer: globals.css + the Theme/Link providers
  queues/       BullMQ queue definitions and job payload types
  utils/        createError + Result — the error model, used everywhere
  logger/       pino, one config, every server process
  env/          shouldSkipEnvValidation(), booleanFlag(), baseEnv
  typescript-config/ Shared tsconfig presets
  infra/
    db/         Drizzle schema, migrations, and the operations DAL
    auth/       better-auth config
    storage/    S3-compatible object storage
```

Workspaces are `apps/*`, `packages/*`, and `packages/infra/*`. Internal packages
are named `@repo/*` and referenced as `"workspace:*"`.

`packages/infra/*` means "owns a connection to an external system" — Postgres,
better-auth, a bucket. Everything else goes in `packages/*`.

## Tooling

- **Bun 1.3.10**, pinned via `packageManager`. Do not use `npm` or `pnpm`.
  Add dependencies with `bun add <pkg> --filter=<workspace>`.
- **Biome 2.3** is the only linter and formatter, configured in **one file at the
  repo root**. **Tabs for indentation, double quotes for strings.** Packages do
  not carry their own `biome.json` and there are no per-package `lint` scripts —
  there were, with a second rule set that disagreed with the root one, which is
  how the repo ended up formatting package files at 80 columns and root files at
  120. Do not reintroduce ESLint or Prettier.
- **TypeScript 5.9**, strict, with `noUncheckedIndexedAccess`. Shared config in
  `packages/typescript-config`.
- **Turborepo 2.9** for task orchestration.
- **sherif** (`bun run lint:ws`) checks dependency versions across workspaces.
  It runs inside `bun run ci`. The one rule it is told to skip is
  `packages-without-package-json`, because `packages/infra` is a grouping
  directory that the `packages/*` glob matches and which has no package of its
  own.
- **Astryx** (`@astryxdesign/core`) is the design system — Meta's open source
  component library, built on React 19 and StyleX. It ships **pre-built CSS and
  JS**: there is no Tailwind, no PostCSS, no Babel and no build plugin.
  `@astryxdesign/core` and `@astryxdesign/theme-neutral` are pinned to the **same
  exact version** and must be bumped together — the theme peer-depends on core
  at an exact version, not a range.

Every dependency version lives in the root `package.json` `catalog` block and is
referenced as `"catalog:"` from workspaces. Bump it in one place, not nine. This
matters most for `zod` and the two `@aws-sdk/*` packages, which break in
confusing ways if two versions end up in the tree.

## Daily commands

| Command | What it does |
|---|---|
| `bun run dev` | All apps in parallel |
| `bun run build` | Build all apps |
| `bun run format` | `biome check --write .` — applies fixes and organizes imports |
| `bun run format:check` | Same checks, no writes (what pre-commit runs) |
| `bun run lint:ws` | sherif — dependency versions across workspaces |
| `bun run typecheck` | `tsc --noEmit` everywhere |
| `bun run test` | Unit tests. No docker needed |
| `bun run test:integration` | Integration tests (needs `test-infra:up`) |
| `bun run ci` | `biome check .` + sherif + typecheck + unit tests |
| `bun run ci:full` | `ci` + knip + build + integration tests |
| `bun run knip` | Unused files, exports, and dependencies |
| `bun run db:up` / `db:wait` / `db:down` / `db:reset` | Dev docker stack |
| `bun run test-infra:up` / `test-infra:down` / `test-infra:logs` | Test docker stack |
| `bun run gen:package` | Scaffold a new workspace package |

`db:wait` blocks on the postgres, redis and minio healthchecks. `test-infra:up`
passes `--wait`, which does the same for the test stack — that is what makes
`ci:full` deterministic instead of racy.

## Database

Migrations and schema work run from `packages/infra/db`:

```sh
bun run --filter @repo/db db:generate   # generate a migration from schema changes
bun run --filter @repo/db db:migrate    # apply migrations
```

Conventions, in full, live in [packages/infra/db/README.md](./packages/infra/db/README.md).
The short version:

- **One file per table** in `src/schema/`, kebab-case, matching the table name.
- Foreign keys inline via `.references()`. There is **no** `relations.ts`.
- RLS policies are declared in the same file as the table they guard.
- `src/schema/index.ts` is a barrel composing `publicSchema` + `userAuth`.
- Columns are snake_case, set by `casing: "snake_case"` in **both**
  `drizzle.config.ts` and the runtime `drizzle()` call. Both are required.
- **Apps import `@repo/db/operations/*`, never `@repo/db/client`.** Every
  operations file is its own subpath export. The raw drizzle client is internal
  to the package — including in tests. Biome's `noRestrictedImports` enforces
  this; `@repo/auth` is the single exception, because better-auth's Drizzle
  adapter needs the client itself.
- **Every operation takes `executor: DbOrTx = db` as its last parameter.** The
  usual call site passes nothing. Two operations share a transaction via
  `withTransaction` from `@repo/db/transaction`, which is the only sanctioned
  door to `db.transaction`:

  ```ts
  await withTransaction(async (tx) => {
    await createUser(input, tx);
    await recordSignup(input.id, tx);
  });
  ```

  An operation you forget to pass `tx` to runs on the pool, outside the
  transaction, and will not roll back with it. That is this pattern's one
  failure mode. And a transaction holds a connection for its whole duration —
  never await an HTTP call inside one.
- **Distinguish failures with `@repo/db/errors`**, not by matching on message
  text. `isUniqueViolation(error)` and friends walk the `cause` chain, because
  drizzle wraps the driver error and the Postgres code is never on the error you
  caught. Pass a constraint name when a table has more than one unique index.
- **The pool is cached on `globalThis`.** Module identity is not stable under
  Next HMR or `bun --hot`, so a module-level `postgres(...)` opens a fresh pool
  on every save until the connection limit is gone. Do not "simplify" that away.

## Auth

`@repo/auth` wraps better-auth with the Drizzle adapter. Its tables live in a
separate Postgres schema, `user_auth`, so they don't collide with the domain
`users` table.

`packages/infra/db/src/schema/user-auth.ts` is **generated** — do not hand-edit
it. Regenerate with `bun run --filter @repo/auth gen:schema`, which runs
better-auth's generator and then `patch-schema.sh` to re-apply the
`pgSchema("user_auth")` wrapper and drop the unique constraint on email.

Those patches are `sed` expressions. If better-auth changes its output shape they
silently no-op and you get tables in the wrong Postgres namespace. **After
`gen:schema`, always run `db:generate` and read the diff.**

A new better-auth user is provisioned into `public.users` by the
`databaseHooks.user.create.after` hook. That hook can fire more than once for the
same id across retries, which is why `createUser` uses `onConflictDoNothing`.

## Errors and logging

Two packages, `@repo/utils` and `@repo/logger`, and the rules are short.

**Build errors with `createError`**, from `@repo/utils/error`:

```ts
throw createError("Upload is not durable", {
  cause: error,
  context: { bucket, key },
});
```

The message is **static** for a given failure class, so a log search groups
every occurrence of it; incident detail goes in `context`. A message with an id
interpolated into it is a message that matches nothing but itself.

`ensureError` normalizes a caught `unknown` — JavaScript lets you throw a
string, and everything downstream assumes an `Error`.

**Return a `Result` for an outcome the caller should branch on**, from
`@repo/utils/result`; throw for a broken assumption. "This email is taken" is a
`Result`; "Postgres is unreachable" is a throw. Getting this backwards is the
usual mistake: the first modelled as a throw disappears into a 500 handler, and
the second modelled as a `Result` makes every caller carry a branch it can do
nothing about.

`tryResult` and `tryAsyncResult` wrap throwing code. They are separate functions
because `tryResult` does not await: handing it an async callback would let the
rejection escape while the caller saw `{ ok: true }`, so doing that is a compile
error pointing at the other one.

**Log with `@repo/logger`, never `console`.** `suspicious/noConsole` is an error,
with the generator templates and `scripts/` the only exceptions.

```ts
const log = childLogger({ worker: QUEUE_NAMES.email });
log.info({ jobId, durationMs }, "Job completed");
log.error({ jobId, err: error }, "Job failed");
```

Structured fields, not interpolated strings — the first is filterable, the
second is a haystack. Errors go on `err`, which is where the serializer looks;
it keeps `context` and the whole `cause` chain, both of which pino's default
serializer drops.

The logger is **server-side only**. Importing it into a client component pulls
pino into the browser bundle. Its redaction list is a backstop for a fixed set
of paths, not a licence — do not pass a request body, a header bag or an env
object to it.

## Background jobs

Queue names and job payload types live in `packages/queues/src/jobs.ts`. Always
reference `QUEUE_NAMES.<queue>` rather than writing the string literal — the name
is baked into Redis keys, so renaming one orphans every job already enqueued.

One worker file per queue, named `<queue>.worker.ts`. Each splits into two parts:

- `processXJob(data, deps)` — the job body, with no BullMQ or Redis anywhere near
  it, and its side effects injected as parameters.
- `startXWorker(options)` — constructs the `Worker` and wires the connection.

That split exists so the job body is testable without a live Redis, and so the
place to plug in a real provider is a typed seam rather than a `// TODO`. See
`apps/workers/src/workers/email.worker.ts` for the shape.

To add a queue: add the name to `QUEUE_NAMES` and a payload type to `jobs.ts`,
add a `createXQueue()` in `queues.ts`, export both from `src/index.ts`, then add
the worker file and register it in `apps/workers/src/index.ts`. The files queue is
the worked example.

## File storage

`@repo/storage` is the only place allowed to import `@aws-sdk/*`; a route that
reaches for the SDK directly bypasses `isOwnedBy`, so `noRestrictedImports`
makes that a build failure rather than a review comment.

It fronts any S3-compatible bucket — Silo (MinIO-compatible) locally, S3/R2/Spaces
in production. Swapping providers is an env change, not a code change. The
compose image is `pgsty/silo` because Docker Hub removed `minio/minio` and
`minio/mc`.

The upload flow is **presigned**:

1. The browser asks the API for an upload URL (`POST /files/upload-url`).
2. The API derives a key, presigns a `PUT`, and returns the URL.
3. The browser uploads **directly to the bucket**.

The web app therefore never holds bucket credentials — that is the entire point,
and why `apps/web/env.ts` deliberately does not extend `storageEnv`.

**Storage is stateless: there is no `files` table.** Not every project built on
this template wants file metadata in Postgres, so recording uploads is the
application's decision. Add a table via the checklist in the db README if you
need one.

The consequence is important: **the key prefix is the authorization boundary.**
Keys are always `uploads/<userId>/<uuid><ext>`, derived server-side from the
session user. Listing is scoped to `userPrefix(userId)`; deletion is gated on
`isOwnedBy(key, userId)`. With no metadata row there is no second place to check
ownership, so:

- **Never build a key from a client-supplied string.**
- **Never add a route that takes a key without calling `isOwnedBy` first.**

`packages/infra/storage/src/keys.ts` carries that weight and has the most
thorough unit test in the repo. Treat changes to it as security changes.

The client sets `requestChecksumCalculation: "WHEN_REQUIRED"` whenever
`STORAGE_ENDPOINT` is not AWS. Recent AWS SDK versions attach a trailing CRC32
checksum to every upload, which real S3 accepts and MinIO rejects with an error
that says nothing about checksums. Scoped to a custom endpoint so a deployment
against real S3 keeps the stricter default.

Object deletion is asynchronous: the API enqueues `delete-file` and
`apps/workers` performs it, because bucket deletes are slow and fail
independently of the request. `deleteObject` is idempotent by contract —
BullMQ retries, and a delete that threw on an already-absent object would turn
one transient failure into a permanent one.

## Environment variables

**There is no root `.env`.** Each app runs with its own workspace as cwd and only
reads from there, so every app owns a `.env.example`:

| File | Owner |
|---|---|
| `apps/web/.env.example` | the web app |
| `apps/api/.env.example` | the API |
| `apps/workers/.env.example` | the workers |
| `packages/infra/db/.env.example` | drizzle-kit, which runs with that package as cwd |

The ownership rule:

- **Integration packages own their variables.** `@repo/db` owns `DATABASE_URL`
  and the `DATABASE_*` pool settings, `@repo/auth` owns the `BETTER_AUTH_*` pair,
  `@repo/queues` owns `REDIS_URL` and `QUEUE_PREFIX`, `@repo/storage` owns the
  `STORAGE_*` set, `@repo/logger` owns `LOG_LEVEL`. Each declares them in
  `src/env.ts` with `createEnv` and exposes them through a `"./env"` subpath.
- **`NODE_ENV` is declared once**, in `baseEnv` (`@repo/env/base`), which every
  app extends. It used to be redeclared identically in all three apps. It sits
  in its own subpath so that importing `shouldSkipEnvValidation` — which every
  `src/env.ts` in the repo does — stays free of `createEnv`'s import-time
  validation.
- **Apps compose** with `extends: [...]` and declare only what they alone use.
- **Validation is forced at boot** by importing `env` from the process
  entrypoint: `src/index.ts` for api and workers, `instrumentation.ts` for web
  (Next has no other server-start hook — the `void env` there is load-bearing).

`shouldSkipEnvValidation()` from `@repo/env` skips validation when
`SKIP_ENV_VALIDATION=1` or when `npm_lifecycle_event` is one of a small
allowlist (format, lint, typecheck, knip, gen:schema). `db:generate`,
`db:migrate`, `db:push` and `build` are deliberately **not** on it — those need
real values, and a named validation error beats a connection error.

**The standing rule:** a new variable for an integration goes into that package's
`src/env.ts` *and* every consuming app's `.env.example`, in the same commit.

**Never read `process.env` outside a `src/env.ts`.** `style/noProcessEnv` is an
error. The exceptions, and the only ones, are the `env.ts` files themselves,
`drizzle.config.ts`, the test setups, the generator, and the `testing/*`
provisioning modules — which exist precisely to set env vars before anything
parses them.

Client variables are a special case. Next inlines `NEXT_PUBLIC_*` at build time
and can only do so from a literal `process.env.NEXT_PUBLIC_X` reference, which is
why `clientEnv` in `apps/web/env.ts` uses an explicit `runtimeEnv` map. Changing
one requires a rebuild, not a restart.

## Testing

`bun test` only. No vitest, no jest, no playwright.

| Layer | Location | Script | Talks to |
|---|---|---|---|
| Unit | `src/**/__tests__/*.test.ts` | `bun test src` | nothing |
| Integration | `tests/integration/*.test.ts` | `bun test --preload ./test-setup.integration.ts tests/integration` | the test stack in `docker-compose.test.yml` |

The two directories **must stay disjoint**: `bun test <arg>` filters by path
substring, so an integration test under `src/` would be swept into the unit run.

Each workspace with tests has a `bunfig.toml` preloading `test-setup.ts`, which
supplies local docker defaults with `??=`. That is why a fresh clone can run the
whole suite with no env files, and why `cd apps/api && bun test src` works
standalone.

**Do not run `bun test` from the repo root.** No bunfig applies there, and it
would sweep the integration suites into a run with no docker guarantee.

### Every integration run gets its own everything

`test:integration` adds a second preload, `test-setup.integration.ts`, which is
wired with `--preload` rather than `bunfig.toml` so that `bun test src` still
needs no docker at all. It points the run at the **test** stack and provisions
the external state it needs:

| What | From | Isolation |
|---|---|---|
| Postgres | `@repo/db/testing/database` | a database cloned from a migrated template, dropped at the end |
| Bucket | `@repo/storage/testing/bucket` | a bucket of its own, emptied and removed at the end |
| Redis | `@repo/queues/testing/prefix` | a BullMQ key prefix of its own, unlinked at the end |

The database trick is worth understanding. Migrations are applied **once** into
a template database named after a fingerprint of `migrations/`, and each run
clones it: `CREATE DATABASE ... TEMPLATE` is a file copy inside Postgres, so a
clone is tens of milliseconds, and the template is rebuilt only when a migration
changes, because that changes its name.

Three consequences:

- **Integration suites run in parallel.** There is no `--concurrency=1` and
  nothing shared to race over. Do not add the flag back; fix the isolation
  instead.
- **Suites need no run-scoped ids and no hand-written cleanup.** The existing
  suites still carry some from before; new ones should not add more.
- **Queue names stay real.** A test cannot rename a queue — the name is baked
  into Redis keys — so isolation is on the prefix, which is the seam BullMQ
  provides for exactly this.

A `testing/*` module must **never** import its own package's `env.ts` or
`client.ts`. Those validate env and open connections at import time, which
captures the old value before the provisioning has pointed it anywhere new. Each
one builds a throwaway client from `process.env` instead, and that is why
`noProcessEnv` is switched off for those paths and nowhere else.

Logs during an integration run are `warn` and above. `TEST_LOG_LEVEL=info`
turns the request and job lines back on when a failure needs them.

Rules for integration tests:

- **Mock the external SDKs you cannot run locally; use the real datastore for
  everything you can.** Postgres, Redis and MinIO all run in docker, so use them.
  A stubbed S3 client cannot catch a path-style or presigning misconfiguration,
  which is exactly the class of bug worth catching.
- **Prefer dependency injection over `mock.module`.** See `EmailSender` in
  `email.worker.ts`. If you genuinely need `mock.module`, put every registration
  for a suite in one `tests/integration/helpers/stubs.ts` imported for its side
  effect — it is process-wide and shared by every file in a run, so per-file
  registration is last-writer-wins.
- **Do not reintroduce run-scoped ids or hand-written cleanup.** The run owns its
  database, bucket and queue prefix, and all three are torn down for it. Some
  existing suites still carry a `const RUN = Date.now().toString(36)` from before
  that was true; leave them, but write new suites plainly.
- **FK delete order**, where a suite does delete rows: `public.users` before
  `user_auth.users`. The FK is `ON DELETE RESTRICT` and deleting the other way
  fails and leaves the run dirty.
- **Wait for a specific job, not the next `completed` event.** Isolation means
  nobody else's job can resolve it now, but a suite that enqueues two jobs can
  still resolve on the wrong one. Match on the job id you enqueued (see
  `apps/workers/tests/integration/file-cleanup-worker.test.ts`).
- **A suite that needs serial execution has an isolation bug.** Find the shared
  state and give the run its own, the way the three provisioning helpers do.
  Do not reach for `--concurrency=1`.

**RLS caveat:** the connection is the `postgres` superuser *and* the table owner,
so `users_all_own` is bypassed entirely and integration tests do not exercise it.
A green suite is not evidence that RLS works.

Component tests for `packages/ui` are deliberately absent — it is a theme
layer, not a component library, so there is nothing there to assert that isn't
Astryx's own behavior. That is also why the package declares **no `test`
script**: `bun test` exits non-zero when no files match, which would red
`turbo run test`. Do not add one back. If you ever need a component test, `@happy-dom/global-registrator` in a bunfig preload plus
`@testing-library/react` works, but `GlobalRegistrator.register()` must run
before React is imported anywhere, so preload order becomes load-bearing.

## Styling and UI

Astryx is the design system. Read its component index at the bottom of this file,
and **read a component's docs before using it** — props are not guessable:

```sh
bun run astryx search <query>       # find a component, hook, doc or template
bun run astryx component <Name>     # full props, variants and examples
bun run astryx docs tokens          # every design token
bun run astryx build "<idea>"       # the template to start a new page from
bun run astryx doctor               # check the installation
```

Always the **scoped** package when invoking without the script
(`bunx @astryxdesign/cli`): bare `astryx` on a runner is an unrelated npm package.

The rules, in priority order:

- **Apps import components directly from `@astryxdesign/core`.** `@repo/ui` is a
  theme layer, not a facade — it owns `globals.css` and `Providers`, nothing else.
- **Layout comes from layout components**, not utility classes: `VStack`, `HStack`,
  `Grid`, `Center`, `Section`, `Layout`, `AppShell`. `Grid columns={{minWidth, max}}`
  is how you get responsive columns without breakpoints.
- **Appearance comes from component props**, then design tokens. Never a literal
  hex, px or rem value.
- **There are no utility classes.** Tailwind was removed deliberately; do not
  reintroduce it or hand-roll a utility layer.
- **The one escape hatch is a CSS Module** colocated with the page, and it may
  reference **only** Astryx token custom properties (`var(--color-text-primary)`,
  `var(--spacing-4)`). `apps/web/app/(public)/home.module.css` is the worked
  example and should stay roughly the size it is. CSS Modules are unlayered, so
  they win over Astryx's cascade layers without `!important`.
- **`xstyle` needs a StyleX compiler**, which this repo does not install. Use
  component props, tokens, or a CSS Module instead. The same applies to any
  Astryx page template that uses StyleX — prefer the block templates, which do not.
- **`globals.css` must be the first stylesheet the page loads.** It names the
  cascade layers (`reset` → `astryx-base` → `astryx-theme`), and a stylesheet that
  loads before it silently inverts the cascade with a clean build and console.
- **Astryx's `Icon` is a client component, and an icon *component* cannot cross
  the server/client boundary as a prop.** A server component that wants icons puts
  them in a small `"use client"` child that imports them itself —
  `app/(dashboard)/_components/dashboard-overview.tsx` is the worked example.
  Most Astryx components (`Card`, `Grid`, `Stack`, `Badge`, `EmptyState`) render
  fine in server components; do not add blanket `"use client"` directives.
- **Dark mode is automatic.** `Theme` defaults to `mode="system"`; there is no
  `next-themes` and no `.dark` class. Check both modes when you touch UI.
- **Form inputs are controlled, and the form attribute is `htmlName`, not `name`.**
  `TextInput` requires `value`/`onChange`; `htmlName` is what puts the field into
  the `FormData` a server action reads. Getting this wrong fails validation
  silently rather than crashing.
- **After any `astryx` codegen** (`init`, `template`, `swizzle`, `upgrade`), run
  `bun run format` before reading the diff — Astryx emits single quotes and
  2-space indent, the repo is tabs and double quotes.
- **To own a component locally**, `bun run astryx swizzle <Name>` — deliberately,
  with a comment saying why. Its output lands in `packages/ui/src/components/`,
  which is the one circumstance under which that directory comes back.

Astryx is in **beta (0.7.x)**. On a version bump, run
`bun run astryx upgrade --from <old> --apply` and read the diff.

## Conventions

- **File names** are kebab-case. React components are PascalCase exports inside
  kebab-case files.
- **Named imports** over default imports.
- **Comments explain _why_**, only where the why is non-obvious. Do not restate
  what the code does.
- **No ad-hoc scripts in `apps/`** — one-off scripts go in their package's
  `scripts/` folder or become a workspace script.
- **Never read `process.env` outside a `src/env.ts`.**

## Before declaring a change done

```sh
bun run format      # applies fixes; do this first
bun run ci          # biome + sherif + typecheck + unit tests
```

Before shipping:

```sh
bun run ci:full     # adds knip, build, and integration tests
```

`ci:full` brings the test stack up itself (`test-infra:up --wait`), so it needs
docker running but no other preparation. It does **not** touch the dev stack or
apply migrations to it — the integration suites migrate their own template
database.

- If you touched the schema: `bun run --filter @repo/db db:generate` and commit
  the generated SQL **and** the snapshot.
- If you touched UI: actually open `http://localhost:3000` and exercise the
  change. A passing typecheck is not feature verification.
- `ci:full` presupposes the four `.env` files exist, because `next build`
  validates env. That is intended — do not "fix" it by adding `build` to the
  skip allowlist. CI copies each `.env.example` over instead.

Husky runs `format:check` on pre-commit and the full `bun run ci` on pre-push.
**Do not bypass either with `--no-verify`.**

## CI

`.github/workflows/ci.yml` runs on every pull request, on pushes to `main`, and
in a merge group. Three jobs:

- **check** — `bun run ci` then `bun run knip`. No services, so a formatting
  mistake fails in under a minute rather than after docker has come up.
- **integration** — brings up `docker-compose.test.yml` with the same
  `bun run test-infra:up` a developer runs, then `bun run test:integration`.
  It is the same compose file on purpose: GitHub `services:` blocks cannot take
  a `command`, which MinIO needs, and a second copy of the stack in workflow
  YAML is a copy that drifts.
- **build** — copies each `.env.example` to `.env` and runs `bun run build`,
  because `next build` validates env.

`.github/actions/setup` reads the Bun version out of `packageManager` rather
than pinning it a second time, caches `~/.bun/install/cache` against `bun.lock`,
and installs with `--frozen-lockfile` so a lockfile someone forgot to commit
fails instead of silently resolving.

## Things to avoid

- Adding ESLint or Prettier.
- Reintroducing Tailwind, PostCSS, or any utility-class layer.
- Writing a literal color, px or rem value instead of an Astryx design token.
- Guessing an Astryx component's props instead of running `bun run astryx component <Name>`.
- Hand-editing the generated Astryx block at the bottom of this file.
- `npm install` or `pnpm install`.
- Reading `process.env` directly outside a `src/env.ts`.
- Importing `@repo/db/client` from an app — use `@repo/db/operations/*`, and
  `@repo/db/transaction` to compose them.
- Importing `@aws-sdk/*` outside `@repo/storage`.
- `console.log` — use `@repo/logger`.
- Adding a per-package `biome.json` or a per-package `lint` script back.
- Adding `--concurrency=1` to `test:integration`.
- Pointing an integration test at the dev stack (5430 / 6379 / 9000) instead of
  the test stack (54322 / 63792 / 59002).
- Hand-editing `packages/infra/db/src/schema/user-auth.ts`.
- Accepting a storage key from a request without `isOwnedBy`.
- Committing a `.env`.
- Force-pushing, `--no-verify`, or skipping migrations.

## Astryx component index

Everything below this line is **generated** by `bun run astryx init` and refreshed by
`astryx upgrade`. Do not hand-edit it — edits are lost on the next refresh, and the
`ASTRYX:START`/`ASTRYX:END` markers are what the CLI anchors to. Everything *above*
this line is hand-written.

<!-- ASTRYX:START -->
Astryx v0.7.14 · 174 components
CLI: run every command as `bunx astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — start every page from a template, never from scratch:
1. `astryx build "<idea>"` — names the template to scaffold from and the parts it lacks.
2. `astryx template <name> <path>` — scaffold it; keep its frame, gap and padding; replace the content.
3. `astryx template <Block>` for parts it lacks; `astryx component <Name>` to read props before using one.
Changing an existing page? Keep it: skip step 2 and add blocks/components inside its sections.
Before you deliver a build, run `astryx doctor --built <dir>`; don't deliver it if it fails.

RULES:
- No <div> — components handle all layout and spacing.
- Read `astryx docs layout` before changing a template's frame.
- Dense data = rows (Table, List/Item), not Card-wrapped lists. Badge = counts only.
- Style with component props first, then tokens (var(--color-*|--spacing-*|--radius-*)). No raw hex/px. No StyleX/Tailwind compiler here — don't use xstyle/utility classes directly. Some templates use StyleX and need a compiler plugin; see `astryx docs styling-overview`.
- Palettes and custom colors go through the theme, never :root overrides. Run `astryx theme add <slug>` to import; `theme eject <slug>` only forks source. See `astryx docs theme`.
- SELF-CHECK: re-read the file; replace any raw <div>/<span>, imported .css/@apply, or hardcoded #hex/px with the component or a token.

`astryx help` lists every command. Key ones beyond the workflow:
  search "<query>"   find any component / hook / doc / template
  discover <words>   integrations you could add
  docs <topic>       getting-started, principles, tokens, theme … (`astryx docs` lists all)
  docs cli           commands and API reference
  docs authoring     build an integration package, and every field it holds
  upgrade --from <old version> --apply   run after a dependency bump
<!-- ASTRYX:END -->
