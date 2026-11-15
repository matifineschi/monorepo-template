# Architecture and boundaries

This repo has three layers, and every import points down:

```
apps/                 web · api · workers · cron
  │                   framework glue: routes, pages, server actions, BullMQ wiring
  ▼
packages/features     @repo/features: the business logic, one subpath per module
  │
  ▼
packages/infra/*      @repo/db · @repo/auth · @repo/storage · @repo/email
                      each owns a connection to one external system

packages/*            @repo/queues · @repo/logger · @repo/utils · @repo/env · @repo/ui
                      shared building blocks, importable from any layer
```

The rule that holds it together:

> **Apps never touch infrastructure. They call `@repo/features`, and features
> calls infrastructure.**

`apps/web` does not know there is a Postgres. It calls `getSession`,
`signInWithEmail` and `requestPasswordReset`. `apps/workers` does not know about
Resend. It calls `processEmailJob`. Swap the database, the auth library or the
mail provider, and only `packages/features` and the one infra package change.
No app does.

The rest of this document covers each layer, the exceptions, how the rule is
enforced, and where new code goes.

## The layers

### `apps/*`: transport and framework

An app turns an outside event into a function call and the result back into a
response. That covers:

- **web**: pages, layouts, server actions, form state, cookie forwarding,
  redirects.
- **api**: Hono routes, the request parsing and status codes around them,
  middleware, CORS, and the SIGTERM drain.
- **workers**: one `Worker` per queue, wired to a job body in features.
- **cron**: one-shot infrastructure jobs. It is a special case (see
  [The cron exception](#the-cron-exception)).

What an app must **not** contain: a database query, an S3 call, a Resend call,
a rule about who may do what, or a decision about what an email says. If you
are about to write one in an app, it belongs in features.

App code may still validate its _transport_. Parsing a JSON body or a form with
a Zod schema is fine. When the schema encodes a business rule, such as allowed
upload types or a size limit, features owns the schema
(`uploadUrlSchema` in `@repo/features/files`) and the app only calls
`.safeParse` on it.

### `packages/features`: business logic

`@repo/features` exposes one subpath per module. There is no root export.
Importing `@repo/features/files` therefore never drags in auth, and a worker
that only processes files never needs `DATABASE_URL`.

| Subpath                 | What it owns                                                                                                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@repo/features/auth`   | The better-auth **instance** and its hooks (provision on sign-up, enqueue the welcome email, send the reset email). Also `authHandler`, `getSession`, `signInWithEmail`, `signUpWithEmail`, `requestPasswordReset` and `resetPassword` |
| `@repo/features/users`  | `provisionUser`, `getUserProfile`, `findAccountByEmail`, `deleteAccount`, and the naming rule (`getNameParts`, `displayNameFromEmail`)                                                                                                 |
| `@repo/features/email`  | What each email says and when it is sent: `sendPasswordResetEmail`, `sendWelcomeEmail`, `enqueueWelcomeEmail`, `processEmailJob`, and the React Email templates styled from the Astryx theme                                           |
| `@repo/features/files`  | Upload rules, the key and ownership policy (`keys.ts`), `createUserUploadUrl`, `listUserFiles`, `requestFileDeletion` and `processFileJob`                                                                                             |
| `@repo/features/system` | `checkReadiness` (what `/ready` means) and `closeFeatureConnections` (shutdown)                                                                                                                                                        |

Conventions inside features:

- **Database access only through `@repo/db/operations/*`**, composed with
  `withTransaction` from `@repo/db/transaction`. The raw client is off-limits
  here too.
- **Expected failures are `Result`s** with domain codes (`"email-taken"`,
  `"invalid-token"`, `"forbidden"`), never a library's error type. The app maps
  each code to a message or a status. `@repo/features/auth`, for example,
  translates better-auth's `USER_ALREADY_EXISTS` into `"email-taken"`, so no
  app ever matches on a better-auth string.
- **Side effects are injectable.** A function that sends, deletes or enqueues
  takes its dependency as an optional last parameter, defaulting to the real
  one, for example `processEmailJob(data, deliver = sendEmail)`. Tests pass a
  recorder, and there is no module mocking.
- **Job bodies live here, workers don't.** `processEmailJob` and
  `processFileJob` are plain functions with no BullMQ in them. `apps/workers`
  only wires them to a queue.
- **Queue producers are lazy singletons** (`src/shared/queues.ts`), so
  importing a feature never opens a Redis connection. Each app calls
  `closeFeatureConnections()` on shutdown.
- A module may import another module's internals (`auth` uses `../users` and
  `../email/messages`). Apps may only use the public subpaths.

### `packages/infra/*`: one external system each

An infra package owns a connection, its credentials (`./env`), and the thin
operations that wrap it. It has **no opinions about the business**:

| Package         | Owns                                                                                                                 | Does not own                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `@repo/db`      | Drizzle client, schema, migrations, `operations/*`, `withTransaction`, error predicates                              | What a user's name is, or who may delete what             |
| `@repo/auth`    | `createAuth(options)`: better-auth with the Drizzle adapter and the `user_auth` schema. The browser client           | What happens on sign-up, or what the reset email says     |
| `@repo/storage` | The S3 client, presigning, list, get, put and delete                                                                 | Key layout and ownership, which is `@repo/features/files` |
| `@repo/email`   | The Resend client, rendering React to HTML and text, retries with backoff, idempotency keys, and the `log` transport | Any template, subject or recipient                        |

The "does not own" column is the important one. Before this layer split,
`@repo/auth` provisioned users itself and `@repo/storage` decided key
ownership. Both were business rules living inside infrastructure, so you could
not read the product's behaviour without reading every infra package.

### `packages/*`: shared building blocks

`@repo/queues` (queue names and payload contracts), `@repo/logger`,
`@repo/utils` (`createError`, `Result`, `withTimeout`), `@repo/env` and
`@repo/ui` hold no business logic and no connection of their own (the queues
package's connections are created on demand). Any layer may import them.

`@repo/ui/theme` is the single place the Astryx theme is chosen. The web app
mounts it and `@repo/features/email` resolves its tokens for email. See
[Email follows the design system](#email-follows-the-design-system).

## Who may import whom

|                       | `@repo/features/*` | `packages/infra/*`                                      | `packages/*` (shared) |
| --------------------- | ------------------ | ------------------------------------------------------- | --------------------- |
| `apps/*` source       | ✅                 | ❌ except the exceptions below                          | ✅                    |
| `apps/*` tests        | ✅                 | ✅ for fixtures and assertions                          | ✅                    |
| `packages/features`   | ✅ (itself)        | ✅ `@repo/db` only via `operations/*` and `transaction` | ✅                    |
| `packages/infra/*`    | ❌                 | ✅ (auth → db only)                                     | ✅                    |
| `packages/*` (shared) | ❌                 | ❌ (by review, not lint)                                | ✅                    |

### The three exceptions for app source

1. **`@repo/<infra>/env`.** Each app composes its env from the packages it
   runs (`extends: [databaseEnv, authEnv, emailEnv, …]`), so a missing
   variable fails the app at boot and not on first use. An `env.ts` imports a
   schema, not a connection.
2. **`@repo/auth/client`.** The better-auth browser SDK (`useSession`,
   `signOut`). It runs in the browser and talks HTTP to `/api/auth/*`, so it
   never touches the database.
3. **Tests**, meaning `tests/**`, `__tests__/**` and `test-setup*.ts`. They may
   import infra for fixtures (seeding a bucket object) and for the
   `testing/*` provisioners (a per-run database, bucket or queue prefix). Assert
   through features where a function exists. The api suites clean up with
   `deleteAccount`, not with two raw deletes in FK order.

### The cron exception

`apps/cron` runs backups and restore drills. It deliberately does **not**
depend on `@repo/features`, because that would give it the application's
database pool, storage credentials and Redis. A backup must keep working when
the application is broken. It imports `@repo/db/env` (exception 1) for
`DATABASE_URL` and talks to Postgres and buckets through `pg_dump` and
`rclone`. See [backups.md](./backups.md). Business scheduled work (digests,
trial expiry, dunning) is a BullMQ repeatable job in `apps/workers` whose body
lives in features.

## How it's enforced

The boundary is a lint error, not a convention. `biome.json` configures
`style/noRestrictedImports` in four layers:

1. **Everywhere:** `@repo/db/client`, `@aws-sdk/*` and `resend` are restricted,
   each with a message naming the package that owns it.
2. **`packages/**` except features:** also restricts `@repo/features/**`. The
   graph only points down.
3. **Each infra package** gets its own override, which lifts only _its own_
   import (`@repo/auth` → `@repo/db/client`, `@repo/storage` → `@aws-sdk/*`,
   `@repo/email` → `resend`) and keeps every other restriction.
4. **`apps/**` source** (tests excluded) also restricts `@repo/db/**`,
   `@repo/auth/**`, `@repo/storage/**` and `@repo/email/**`, with negations for
   `@repo/*/env` and `@repo/auth/client`.

Biome overrides **replace** a rule's options rather than merging them, so each
override above repeats the global `paths`. When you add a global restriction,
add it to every override too, or it silently stops applying inside that scope.

`bun run ci` runs Biome with `--error-on-warnings`, as do the pre-push hook and
CI, so a boundary break never reaches `main`.

## Where does this code go?

Work down the list and stop at the first yes:

1. **Does it talk to a new external system** (a payment provider, an SMS API, a
   search index)? Create `packages/infra/<name>`: its client, its `./env`, thin
   operations, and a Biome restriction so only it may import the SDK. No
   business rules.
2. **Is it a rule about the product**: who may do what, what something is
   called, what a message says, what happens after something else happens? Put
   it in `packages/features/src/<module>`.
3. **Is it a new table or query?** The schema and an operation go in
   `@repo/db`. The function that decides _when_ to call it goes in features.
4. **Is it how a request, page, form or job reaches that logic?** Put it in the
   app.
5. **Is it shared and logic-free** (a type, a helper, a queue contract)? Put it
   in `packages/*`.

### Worked example: "email the user when their upload is deleted"

- `@repo/features/email`: a `file-deleted.tsx` template and a
  `sendFileDeletedEmail(input, deliver = sendEmail)` function.
- `@repo/features/files`: `processFileJob` calls it after `remove(key)`
  succeeds. The job payload in `@repo/queues/jobs.ts` gains whatever the email
  needs (the user's address), because the worker has no database.
- Unit tests in features use a recording `deliver` and a recording `remove`.
- **No app changes.** The API route and the worker already call the
  functions that now do more.

If your change touches an app and an infra package but not features, stop and
re-read this section.

## Adding a features module

1. Create `packages/features/src/<module>/index.ts`. It is the module's public
   API, and everything else in the folder is internal.
2. Add the subpath to `packages/features/package.json` `exports`, in the same
   shape as the others.
3. Unit tests go in `src/<module>/__tests__/`, with dependencies injected.
   Integration tests go in `packages/features/tests/integration/` and run
   against the test stack with their own database and queue prefix.
4. If it needs a new infra package's env, add that package's `./env` to the
   `extends` of every app that imports the module, and its variables to each of
   those apps' `.env.example`, `test-setup.ts` and `turbo.json`'s `env` and
   `passThroughEnv` lists.

## Email follows the design system

Email templates live in `packages/features/src/email/templates/` and use the
app's Astryx theme. Astryx's own components can't render in an email client:
they style through StyleX classes and CSS custom properties with
`light-dark()`, and clients strip `<style>` and ignore `var()`. So:

- Templates are built from React Email primitives (`react-email`) wrapped in
  `components/`: `EmailLayout` (the sign-in page frame and card),
  `EmailHeading`, `EmailText` and `EmailButton`. The names and variants mirror
  Astryx's `Heading`, `Text` and `Button variant="primary"`.
- Every style value comes from `emailTheme` in `src/email/theme.ts`. That
  object is filled by Astryx's own `resolveThemeTokens(theme, { mode: "light" })`
  from the theme `@repo/ui/theme` exports, then made email-safe (rem becomes px,
  8-digit hex becomes `rgba()`). **No hex or px literal goes in a template.** If
  a value is missing, add the token to `emailTheme`.
- A unit test fails if any resolved value is still a `var()`, `light-dark()`,
  `rem` or 8-digit hex. Another checks that a rendered template carries the
  theme's accent and background.

Preview the templates with `bun run --filter @repo/features email:dev`
(http://localhost:3030).

## Email delivery

`@repo/email` sends through Resend when `EMAIL_TRANSPORT=resend`. With `log`,
the default, it renders each email and writes it to the logger, so local
development and every test suite run without a Resend account.

- **Idempotency keys** are `<event>/<id>`: `welcome-user/<userId>` and
  `password-reset/<token>`. Resend drops a repeat within 24 hours, so a
  retried job or a double-submitted form sends one email.
- **Retries** happen in the transport: network errors, 5xx and 429 (honouring
  `retry-after`), three attempts. Any other 4xx is a `"rejected"` result, which
  is logged with Resend's reason and not retried.
- **The welcome email is queued, not sent inline.** Sign-up enqueues it with
  job id `welcome-<userId>` and `apps/workers` sends it. A Resend outage then
  never fails a sign-up, and BullMQ retries it.
- **The reset email is not awaited.** Otherwise a request for a registered
  address would take measurably longer than one for an unknown address.
- **Readiness does not check Resend.** A mail outage must not pull every
  instance out of rotation.
