# @repo/auth

[better-auth](https://www.better-auth.com) with the Drizzle adapter, configured
for email + password sign-in.

## Layout

```
src/
  auth.ts        createAuth(options) — better-auth + the Drizzle adapter, server side
  cli-config.ts  a hook-less instance for better-auth's CLI (gen:schema) only
  client.ts      the browser client
  env.ts         owns BETTER_AUTH_URL and BETTER_AUTH_SECRET, exported as `authEnv`
patch-schema.sh
```

**This package owns the connection, not the behaviour.** `createAuth` takes
the hooks (`onUserCreated`, `sendResetPassword`) and the reset-link lifetime as
options. The application's one instance is built in `@repo/features/auth`,
which is also the only thing apps import for server-side auth. Apps may import
`@repo/auth/client` (browser) and `@repo/auth/env` (env composition), and nothing
else from here. See [docs/architecture.md](../../../docs/architecture.md).

## The `user_auth` Postgres schema

better-auth's tables live in a separate Postgres schema, `user_auth`, so its
`users` table doesn't collide with the domain `users` table in `public`.

That separation is applied by `patch-schema.sh` after code generation:

```sh
bun run --filter @repo/auth gen:schema
```

This runs better-auth's generator, writing
`packages/infra/db/src/schema/user-auth.ts`, then patches it to wrap the tables in
`pgSchema("user_auth")` and drop the unique constraint on email.

**That generated file must not be hand-edited.** And because the patches are
`sed` expressions, they silently no-op if better-auth changes its output shape —
so after `gen:schema`, always run `db:generate` and read the diff. Tables landing
in the wrong Postgres namespace is the failure mode.

## User provisioning

`databaseHooks.user.create.after` calls the `onUserCreated` option. The
application passes `provisionUser` from `@repo/features/users`, which splits the
sign-up name and creates the matching `public.users` row, then enqueues the
welcome email.

The hook can fire more than once for the same id across retries, which is why
`createUser` uses `onConflictDoNothing` — the idempotency is load-bearing, and
`packages/features/tests/integration/accounts.test.ts` covers it.

## Password reset

`emailAndPassword.sendResetPassword` is the `sendResetPassword` option, and
`revokeSessionsOnPasswordReset` is always on: a reset is how someone recovers a
compromised account, so every session dies with the old password.

## Environment

`BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` are owned here, declared in
`src/env.ts` and exposed through the `@repo/auth/env` subpath.

Both **must hold identical values in `apps/web/.env` and `apps/api/.env`** —
sessions minted by one service will not validate in the other otherwise.
`BETTER_AUTH_URL` is the origin that _issues_ the cookie, i.e. the web app.

## Commands

| Command              | What it does                                                                  |
| -------------------- | ----------------------------------------------------------------------------- |
| `bun run typecheck`  | `tsc --noEmit`                                                                |
| `bun run test`       | Unit tests                                                                    |
| `bun run gen:schema` | Regenerate and patch the better-auth Drizzle schema (via `src/cli-config.ts`) |

Run `bun run format` from the repo root to apply fixes across the monorepo.
