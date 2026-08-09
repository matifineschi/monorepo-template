# @repo/storage

S3-compatible object storage. MinIO locally, any S3 API in production.

## Layout

```
src/
  env.ts      owns the STORAGE_* variables, exported as `storageEnv`
  client.ts   lazy S3Client singleton
  keys.ts     key derivation and ownership — the authorization model
  objects.ts  put / get / list / delete / createUploadUrl
```

## The upload flow

Uploads are **presigned**. The browser never receives bucket credentials:

1. Browser → `POST /files/upload-url` on the API.
2. API derives a key, presigns a `PUT`, returns `{ key, uploadUrl, expiresAt }`.
3. Browser `PUT`s the bytes **directly to the bucket**.

This is why `apps/web/env.ts` deliberately does not extend `storageEnv` — the web
server has no reason to hold credentials, and giving it any would defeat the
point of presigning.

Deletion is asynchronous: the API enqueues `delete-file` and `apps/workers`
performs it. Bucket deletes are slow and fail independently of the request, so
the response shouldn't block on one.

## Bucket layout, and why keys are derived server-side

```
uploads/<userId>/<uuid><ext>
```

**There is no metadata table.** That is deliberate — not every project built on
this template wants file records in Postgres — but it has a consequence worth
being explicit about:

> **The key prefix is the entire authorization boundary.**

With no database row to check ownership against, the key itself is the ownership
record. So:

- `uploadKey(userId, filename)` derives keys from the **session** user. The
  supplied filename only ever contributes an extension — never a path segment,
  never the name.
- `listObjects(userPrefix(userId))` scopes listing to one user. The trailing
  slash in `userPrefix` is load-bearing: without it `uploads/user-1` is a prefix
  of `uploads/user-10/secret.png`.
- `isOwnedBy(key, userId)` gates every operation that takes a caller-supplied key.

**Never build a key from a client-supplied string, and never add a route that
accepts a key without calling `isOwnedBy` first.** A caller who can choose their
own key can read or delete anyone's objects. `src/keys.ts` carries that weight
and has the most thorough unit test in the repo; treat changes to it as security
changes.

### Want a metadata table?

Add one — `@repo/db`'s README has a step-by-step checklist that uses exactly this
case as its example. Record the key returned by `POST /files/upload-url` and you
get the database as a second ownership check.

## Configuration

| Variable | Notes |
|---|---|
| `STORAGE_ENDPOINT` | `http://localhost:9000` for the local MinIO |
| `STORAGE_REGION` | Defaults to `auto` |
| `STORAGE_ACCESS_KEY_ID` | `minioadmin` locally |
| `STORAGE_SECRET_ACCESS_KEY` | `minioadmin` locally |
| `STORAGE_BUCKET` | `app-uploads` locally, created by the `minio-createbucket` job |
| `STORAGE_FORCE_PATH_STYLE` | `true` for MinIO and most S3-compatible services; **`false` for real AWS S3**, which wants virtual-hosted style |

Both `apps/api` and `apps/workers` need these, and they must match — the API
presigns uploads into the bucket the workers delete from.

### Swapping MinIO for a real bucket

Change `STORAGE_ENDPOINT`, the two credentials, `STORAGE_BUCKET`, and set
`STORAGE_FORCE_PATH_STYLE=false` for AWS S3. Nothing in the code changes.
R2, Spaces and Backblaze generally keep path-style at `true`.

### Gotcha: presigned URLs embed the endpoint

A URL signed against `http://localhost:9000` only works from the host. Under
Docker networking, containers reach MinIO at `http://minio:9000` while browsers
need `localhost:9000` — if a deployment ever needs both, that is a second
`STORAGE_PUBLIC_ENDPOINT` variable, not a code change.

## Testing

```sh
bun run --filter @repo/storage test              # keys.ts — no bucket needed
bun run db:wait
bun run --filter @repo/storage test:integration  # real MinIO
```

The integration tests run against real MinIO rather than a mocked SDK on
purpose: a stub cannot catch a path-style, region, or signing misconfiguration,
which is the class of bug actually worth catching here. The presigned-URL test
fetches its own URL with a plain `PUT`, which proves the whole chain at once.

Every test writes under a run-scoped `test-runs/<run>/` prefix and deletes what
it created. Unlike a database, **nothing ever truncates a bucket** — a leaked
object stays forever.

`deleteObject` is idempotent by contract: it swallows `NoSuchKey`. BullMQ
retries, and a delete that threw on an already-absent object would turn one
transient failure into a permanently failed job.
