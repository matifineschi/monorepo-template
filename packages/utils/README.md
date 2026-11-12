# @repo/utils

Error construction and explicit success/failure, used everywhere.

```
src/
  error.ts   createError, ensureError, errorContext, errorChain
  result.ts  Result, TryResult, ok, err, tryResult, tryAsyncResult, unwrap
```

No env, no connections, no dependencies beyond TypeScript. Imported as
`@repo/utils/error` and `@repo/utils/result` — there is no barrel, so nothing
pulls in more than it uses.

## Errors

`createError(message, { cause, context })`. Two rules make errors useful when
you have thousands of them rather than one:

- **`message` is static** for a given failure class, so a log search groups
  every occurrence. `"Upload is not durable"`, never
  `` `Upload ${key} is not durable` ``.
- **Incident detail goes in `context`**, as fields a human can read and a tool
  can filter on.

`cause` takes anything throwable and normalizes it through `ensureError`, so the
chain stays walkable even when what you caught was a string. `@repo/logger`
serializes `context` and the whole `cause` chain; pino's default serializer
drops both.

```ts
throw createError("Presign failed", {
	cause: error,
	context: { bucket, key },
});
```

## Results

`Result<R, C extends string>` is for an outcome the caller is **expected to
branch on**; a thrown error is for a broken assumption.

The distinction is worth holding onto. "This email is already taken" modelled as
a throw gets lost in a generic 500 handler. "The database is unreachable"
modelled as a `Result` makes every caller carry a branch it can do nothing
about.

```ts
type SignUpResult = Result<User, "email-taken" | "password-too-weak">;

if (await emailExists(input.email)) return err("email-taken");
return ok(user);
```

The second type parameter narrows the code to string literals, so a `switch` on
`result.code` is exhaustively checked.

`tryResult` / `tryAsyncResult` turn throwing code into a `TryResult`. They are
two functions rather than one on purpose: `tryResult` does not await, so a
promise-returning callback would have its rejection escape unhandled while the
caller was handed `{ ok: true }`. Passing one is a **compile error** that points
you at `tryAsyncResult`.

```ts
const parsed = tryResult(() => JSON.parse(raw));
if (!parsed.ok) return err("malformed-payload", parsed.error);
```

## Commands

```sh
bun run --filter @repo/utils test       # no docker needed
bun run --filter @repo/utils typecheck
```
