# @repo/logger

Structured server-side logging: pino, one config, used by every server process.

```
src/
  index.ts        the logger and childLogger
  env.ts          owns LOG_LEVEL, exported as `loggerEnv` via @repo/logger/env
  serializers.ts  error serialization that keeps context and the cause chain
```

**Server-side only.** This is Node/Bun pino; importing it into a client
component pulls the whole thing into the browser bundle.

## Using it

Pass **structured fields, not interpolated strings**:

```ts
import { logger } from "@repo/logger";

logger.info({ userId, durationMs }, "User provisioned"); // filterable
logger.info(`provisioned ${userId} in ${durationMs}ms`); // a haystack
```

`childLogger` tags every line from one component, which is what makes a worker's
output separable from an HTTP handler's:

```ts
const log = childLogger({ worker: QUEUE_NAMES.email });
```

Errors go on the `err` field, where the serializer picks them up:

```ts
log.error({ jobId: job.id, err: error }, "Job failed");
```

## Two decisions worth knowing

**Pretty output is a stream, not a pino `transport`.** A transport runs in a
worker thread, which on Bun means the process can exit with lines still
buffered — and the last thing a crashing worker logged is exactly the line you
need. The stream is synchronous and always flushed.

**Errors are serialized by `serializers.ts`, not by pino's default.** The
default keeps `message` and `stack` but drops both things this repo puts on an
error: the `context` object from `createError`, and everything below the first
`cause`. Losing the cause chain is the expensive one, since the outermost
message is usually the least specific.

## Redaction is a backstop, not a licence

`REDACTED_PATHS` in `index.ts` replaces a fixed list of paths with
`[Redacted]`. It only covers the paths listed, so a secret nested somewhere
unanticipated still gets through. The rule stands: **do not pass a request body,
a header bag, or an env object to the logger.**

## Environment

`LOG_LEVEL` is owned here — `silent | debug | info | warn | error`, defaulting
to `info`. Apps compose it with `extends: [loggerEnv]`.

`silent` exists so a test run can go dark. It is not a level for a deployed
environment: if you want fewer logs there, raise the floor to `warn`.

## Commands

```sh
bun run --filter @repo/logger test       # no docker needed
bun run --filter @repo/logger typecheck
```
