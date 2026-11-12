# @repo/db

Drizzle ORM over Postgres: schema, migrations, and the typed data-access layer.

## Layout

```
src/
  client.ts       the drizzle client and the executor types — internal
  transaction.ts  withTransaction, the only public door to the client
  env.ts          owns DATABASE_URL and the pool settings, via @repo/db/env
  errors.ts       Postgres error-code predicates, via @repo/db/errors
  schema/         one file per table, plus the index.ts barrel
  operations/     hand-written typed DAL, one file per domain
  testing/        per-run test databases, via @repo/db/testing/database
migrations/       generated SQL + snapshots — never hand-edited
drizzle.config.ts
```

## Schema convention

**One file per table**, in `src/schema/`, kebab-case, named after the table
(`users.ts` → `users`). The schema is small today — `users.ts` and the generated
`user-auth.ts` — so the convention is documented here rather than demonstrated at
scale. Follow it from table three onward.

- **Foreign keys are declared inline** via `.references(() => otherTable.id, …)`.
  There is deliberately **no** `relations.ts`; a table's relationships live with
  the table.
- **RLS policies live in the same file as the table** they guard, via `pgPolicy`
  plus `.enableRLS()`.
- **Columns are snake_case**, produced by `casing: "snake_case"`. That option is
  set in **both** `drizzle.config.ts` and the runtime `drizzle()` call in
  `client.ts`. Both are required, and it is easy to miss one.
- `src/schema/index.ts` is a barrel composing `publicSchema` and `userAuth` into
  the single `schema` object the client is typed against.

### `user-auth.ts` is generated

It comes from `bun run --filter @repo/auth gen:schema`, which runs better-auth's
generator and then `patch-schema.sh` to wrap the tables in `pgSchema("user_auth")`
and drop the unique constraint on email. **Do not hand-edit it** — and after
regenerating, always run `db:generate` and read the diff, because those patches
are `sed` expressions that silently no-op if better-auth changes its output.

The separate `user_auth` Postgres schema exists so better-auth's `users` table
doesn't collide with the domain `users` table.

## The operations DAL

`src/operations/` is a hand-written typed data-access layer, one file per domain,
each its own subpath export.

**Apps import `@repo/db/operations/*`. Apps never import `@repo/db/client`.**
The drizzle client is internal — that rule is what keeps query shapes in one
reviewable place instead of spread across route handlers. It applies to tests
too: the integration tests here go through operations like everyone else, and
`createAuthUser` exists precisely so they can arrange fixtures without the raw
client.

Operations return plain shapes, not drizzle row types.

### Every operation takes an executor

The last parameter of every operation is `executor: DbOrTx = db`. The common
call site passes nothing and runs on the pool. Passing something else is how two
operations end up in one transaction:

```ts
import { withTransaction } from "@repo/db/transaction";
import { createUser } from "@repo/db/operations/users";
import { recordSignup } from "@repo/db/operations/signups";

await withTransaction(async (tx) => {
	await createUser(input, tx);
	await recordSignup(input.id, tx);
});
```

`withTransaction` is the only sanctioned way to reach `db.transaction`, which is
why it lives in its own subpath rather than forcing apps to import the client.

Two things to keep in mind. An operation you forget to pass `tx` to silently
runs on the pool instead, outside the transaction, and will not roll back with
it — that is the one failure mode of this pattern. And a transaction holds a
connection for its whole duration, so never await an HTTP call inside one.

### Distinguishing failures

`@repo/db/errors` turns a driver error into something branchable. Drizzle wraps
the driver error, so the Postgres code is down the `cause` chain rather than on
the error you caught; everything in that module walks the chain for you.

```ts
import { isUniqueViolation } from "@repo/db/errors";
import { tryAsyncResult } from "@repo/utils/result";
import { err, ok } from "@repo/utils/result";

const saved = await tryAsyncResult(() => createUser(input));
if (!saved.ok) {
  if (isUniqueViolation(saved.error)) return err("email-taken");
  throw saved.error;
}
return ok(saved.value);
```

Pass a constraint name when a table has more than one unique index, or every one
of them reports "already taken".

## Adding a table

Say you want a `files` table to record uploads (the most likely first addition,
since `@repo/storage` is deliberately stateless):

1. **`src/schema/files.ts`** — define `filesTable` with `pgTable`. Declare columns
   without explicit names so `casing` derives snake_case. Foreign keys inline.
   Add `pgPolicy` + `.enableRLS()` if it holds user data.
2. **`src/schema/index.ts`** — import it and add it to `publicSchema`, and to the
   convenience re-export list at the bottom.
3. **`src/operations/files.ts`** — the typed DAL for it.
4. **`package.json`** — add `"./operations/files"` to `exports`. Every operations
   file is its own subpath export.
5. **Generate and apply**:

   ```sh
   bun run --filter @repo/db db:generate
   bun run --filter @repo/db db:migrate
   ```

   Commit the generated SQL **and** the snapshot in `migrations/meta/`.
6. **Test it** — a unit test for any pure helper in `src/**/__tests__/`, and an
   integration test for the operations in `tests/integration/`.

## Environment

`DATABASE_URL` is owned here: declared in `src/env.ts` and exported as
`databaseEnv` through the `@repo/db/env` subpath. Apps compose it with
`extends: [databaseEnv]`.

This package has its own `.env` because drizzle-kit runs with it as the working
directory. Copy `.env.example` to `.env`.

## Tests get a database of their own

`test:integration` here preloads `test-setup.integration.ts`, which calls
`provisionTestDatabase` from `src/testing/database.ts`. That applies the
migrations once into a template database named after a fingerprint of the
`migrations/` folder, then clones a database per run from it and points
`DATABASE_URL` at the clone. `CREATE DATABASE ... TEMPLATE` is a file copy
inside Postgres, so a clone is tens of milliseconds; the template is rebuilt
only when a migration changes, because that changes its name.

The consequences worth knowing:

- Suites need no run-scoped ids and no hand-written cleanup. The database goes
  away at the end of the run, and a run killed before that is swept after 24h.
- Integration suites run **in parallel**. Nothing is shared to race over.
- It runs against the stack in `docker-compose.test.yml`, never the dev stack —
  these suites drop databases, which must never be the one `bun run dev` uses.
- `src/testing/database.ts` deliberately does not import `./client`: that module
  validates env and opens its pool at import time, which would capture the old
  `DATABASE_URL` before the new database existed.

## Known gap: RLS is not exercised by tests

`public.users` has RLS enabled with a `users_all_own` policy keyed on
`current_setting('app.user_id')`. But the local Docker connection is the
`postgres` superuser _and_ the table owner, so **RLS is bypassed entirely** and
the integration tests do not exercise the policy. A green suite is not evidence
that RLS works.

Testing it properly needs a second, non-owner database role that `SET app.user_id`
before querying. Until then, authorization is enforced in the application layer.

## Commands

```sh
bun run --filter @repo/db db:generate   # generate a migration from schema changes
bun run --filter @repo/db db:migrate    # apply migrations
bun run --filter @repo/db db:push       # push schema directly (dev only)
bun run --filter @repo/db test          # unit tests, no docker needed
bun run --filter @repo/db test:integration  # needs `bun run test-infra:up`
```

Linting and formatting are repo-wide: one Biome config at the root, run with
`bun run format`. There is no Prettier and no per-package config.
