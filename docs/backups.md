# Backups and restore checks

`apps/cron` is a set of **one-shot jobs**. Each run does one job and exits;
scheduling is the platform's job (Railway/Render cron, a Kubernetes CronJob, an
ECS scheduled task). There is no long-running process.

| Job                      | Suggested schedule | What it does                                              |
| ------------------------ | ------------------ | --------------------------------------------------------- |
| `postgres-backup`        | nightly            | `pg_dump` to a file, check it, upload it                  |
| `postgres-restore-check` | weekly             | restores the newest dump into a throwaway database        |
| `bucket-backup`          | nightly            | copies the app's bucket; versions keep overwrites 90 days |
| `bucket-backup-check`    | weekly             | re-downloads a sample and compares byte for byte          |

A database backup without the files is only half a recovery: restore the rows
and every uploaded document is a dead link.

## Running a job

```sh
bun run --filter cron job postgres-backup     # local, from source
bun run dist/main.js postgres-backup          # in the container
```

One image, one cron entry per job, each with its own command. Exit codes: `0`
ran (or skipped because another run held the lock), `1` failed, `2` unknown or
missing job name. A non-zero exit is what makes the platform report the run as
failed.

Platform setup — Railway step by step, plus Kubernetes, ECS and Compose — is in
[deployment.md](./deployment.md#scheduling-appscron).

## Code layout

```
apps/cron/src/
  main.ts                    entrypoint: main(argv) → runs one job, returns the exit code
  env.ts                     every variable this service reads
  jobs/
    index.ts                 the job list: name → heartbeat URL → function
    postgres-backup.ts
    postgres-restore-check.ts
    bucket-backup.ts
    bucket-backup-check.ts
  lib/
    exec.ts                  spawns pg_dump / pg_restore / rclone
    rclone.ts                remotes (src:, dst:) and rclone helpers
    postgres.ts              PG* env vars from a URL, advisory lock
    heartbeat.ts             start / success / fail pings
    sample.ts                reservoir sampling for the backup check
```

Adding a job: write it in `src/jobs/`, add it to `src/jobs/index.ts` with a
heartbeat variable, add that variable to `env.ts` and `.env.example`, and add a
cron entry on the platform.

## Why this is a separate service

A backup must not share a failure domain with the thing it backs up. A BullMQ
job in `apps/workers` would need Redis up, the workers app deployed and its
environment correct; lose any of them and backups stop silently, in exactly the
situation where you want yesterday's dump.

> Does this need the application's code, and should it stop when the
> application is unhealthy?

| Answer                                                   | Where it goes                           |
| -------------------------------------------------------- | --------------------------------------- |
| Yes — digest emails, trial expiry, dunning, re-indexing  | BullMQ repeatable job in `apps/workers` |
| No — backups, restore checks, cert renewal, log shipping | `apps/cron`                             |

`apps/cron` imports `@repo/db/env` and `@repo/logger` and nothing else from the
workspace at runtime. It never imports `@repo/db/client` or `@repo/storage`.

## Every run

`main.ts` wraps each job the same way:

1. pings `<heartbeat>/start`
2. takes a Postgres advisory lock on the job name. If another run holds it, it
   logs and exits 0. Platform cron normally prevents overlap; this also covers a
   manual run during an incident landing on a scheduled one. The lock is
   session-scoped, so Postgres releases it if the container is killed.
3. runs the job
4. pings `<heartbeat>` on success or `<heartbeat>/fail` with the error message

## postgres-backup

1. `pg_dump --format=custom --no-owner --no-privileges --file <tmp>`
2. fails if the file is under 1 KB (pg_dump can exit 0 having dumped nothing,
   e.g. a role that could read no schemas)
3. `pg_restore --list <tmp>` — the archive's table of contents must be readable
4. `rclone copyto` to `<POSTGRES_BACKUP_PREFIX>/YYYY/MM/DD/<iso>.dump`

**Dump to a file, never stream into the upload.** A pg_dump that dies halfway
closes its stdout normally, so a streaming upload completes and stores a
truncated dump that looks like a real backup. Writing to a file first means
nothing is uploaded until pg_dump has exited 0 and the archive reads back. The
cost is local disk for one compressed dump (`WORK_DIR`, default the OS temp
dir). `src/__tests__/postgres-backup.test.ts` covers this with a fake pg_dump.

**Credentials never go in argv.** pg_dump and pg_restore get their connection
through `PGHOST`/`PGUSER`/`PGPASSWORD`/… environment variables; rclone through
`RCLONE_CONFIG_*`. Anything in argv is visible in `ps` to every process on the
host.

## postgres-restore-check

A dump nobody has restored is a file, not a backup. Weekly, it:

1. finds the newest dump and **fails if it is more than 48 hours old** — this
   catches a backup job that silently stopped
2. downloads it and creates `restore_check_<id>` on the restore server
3. `pg_restore`s into it
4. fails if the restored database has no tables; logs tables that are only in
   the backup (drift) and tables only in production (a migration after the dump
   — normal)
5. drops the scratch database `WITH (FORCE)` in a `finally`

**Where it restores.** `RESTORE_CHECK_DATABASE_URL` points at a separate server
to restore into. Unset, it restores into the production server, which is fine
while the database is small and puts real load on production once it is not.
The connecting role needs `CREATEDB` there.

## bucket-backup

`rclone copy src: dst:<BUCKET_BACKUP_PREFIX>`.

**`rclone copy`, never `rclone sync`.** Sync deletes from the destination to
match the source, so an accidental or malicious deletion would propagate into
the backup. Copy is additive. A file removed from the application stays in the
backup as a current object.

**History is versioning on the backup bucket.** An overwrite uploads a new
version and leaves the previous generation in place. A lifecycle rule expires
noncurrent versions after 90 days, and drops delete markers once they are the
only version left. Current objects are not expired: a file the application
still has must not disappear from the backup on its birthday. The rule is
bucket configuration. The job never sets it.

Point-in-time bytes for an overwritten key are `rclone --s3-version-at`. A key
the application deleted is still the current object in the backup; copy it
back. It stays past 90 days, because the copy never made it noncurrent.

An object created and deleted between nightly runs was never copied. Versioning
on the source bucket is what covers that window.

**Time budget.** `BUCKET_BACKUP_MAX_DURATION` caps a run. When rclone hits it
(exit code 10) the job logs a warning and succeeds. Progress was made, and the
next run continues. A first copy of a large bucket takes several nights.

## bucket-backup-check

Lists the source, picks `BUCKET_BACKUP_CHECK_SAMPLE_SIZE` objects uniformly by
reservoir sampling, and runs `rclone check --one-way --download` over just
those — comparing content, not size and modtime.

- **Uniform**, because objects are listed in key order and the first N would
  only ever check one corner of the bucket.
- **`--one-way`**, because the backup legitimately holds objects the source has
  since deleted.
- **A sample**, because a full weekly re-read would cost more than the backup.
  It is a confidence check, not a proof.

A job that never ran is the heartbeat's job to catch. This check catches a
copy whose bytes do not match the source.

## Configure these on the bucket, not in code

- **A different account, ideally a different provider, from the database.** One
  compromised token, deleted account or billing lapse should not take the
  database and its backups together.
- **Versioning** on the backup bucket, so an overwrite does not destroy the
  previous generation.
- **This lifecycle rule**, and no expiry of current objects. Never expire
  objects from application code. `NoncurrentDays` is 90. `ExpiredObjectDeleteMarker`
  clears a marker once nothing is left behind it.

```json
{
	"Rules": [
		{
			"ID": "expire-noncurrent-90d",
			"Status": "Enabled",
			"Filter": { "Prefix": "" },
			"NoncurrentVersionExpiration": { "NoncurrentDays": 90 },
			"Expiration": { "ExpiredObjectDeleteMarker": true }
		}
	]
}
```

- **Object lock** is optional. Its default retention has to be shorter than 90
  days, or it refuses the lifecycle delete and previous generations never go.
- **Write-limited credentials** for the backup bucket (`PutObject`,
  `ListBucket`, `GetObject`) and **read-only** credentials for the source.
  Those credentials cannot enable versioning or change the lifecycle; do that
  once, with an admin key.

## The dead-man's switch

Set the four `*_HEARTBEAT_URL` variables to a cron monitor (healthchecks.io,
Better Stack, or anything using the `/start` and `/fail` suffix convention) and
alert when the success ping does not arrive. This is the only thing that catches
a job that never _ran_ — a wrong cron expression, a service scaled to zero, an
image never deployed — because those produce no logs at all.

## Restoring for real

```sh
# Postgres: find and pull the dump, then restore into the target
rclone lsf dst:$BACKUP_S3_BUCKET/postgres --recursive | sort | tail -1
rclone copyto dst:$BACKUP_S3_BUCKET/postgres/2026/11/15/....dump ./recovery.dump
PGHOST=... PGUSER=... PGPASSWORD=... \
  pg_restore --no-owner --no-privileges --dbname <target-db> recovery.dump

# Files: everything currently in the backup, including objects the app has deleted
rclone copy dst:$BACKUP_S3_BUCKET/files src:$SOURCE_S3_BUCKET

# Files: the bytes each key held at a moment in the last 90 days
rclone copy dst:$BACKUP_S3_BUCKET/files src:$SOURCE_S3_BUCKET \
  --s3-version-at 2026-11-03T00:00:00Z
```

The first file form is the one to use after an accidental mass deletion: the
copy never removed those objects, so they are still current in the backup.
`--s3-version-at` is for a key that was overwritten.

The client's major version must match the server's. The cron image pins
`postgresql17-client` to match `postgres:17` in `docker-compose.yml`; keep them
in step.

## Testing

- `bun run --filter cron test` — unit tests. Fake `pg_dump` / `pg_restore` /
  `rclone` scripts on PATH cover the failure paths: a pg_dump that dies
  mid-dump uploads nothing, rclone's time-budget exit is partial progress, and
  no credential ever reaches argv.
- `bun run --filter cron test:integration` — the real round trips against the
  test stack. They need `pg_dump` (server's major version) and `rclone` on PATH.
  A laptop without them skips; when `CI` is set the run fails instead, and the
  workflow installs both.

## Where this stops scaling

`rclone copy` lists both sides every run. Past a few hundred thousand objects
the listing itself becomes the cost; switch to **provider-side replication**,
which is continuous and does not scan.

## Deliberately not here

- **Managed snapshots / PITR** should be your primary database copy. This
  service adds an independent second copy that survives losing the provider
  account, and the checks that prove either is real.
- **Provider-side bucket replication** — bucket configuration, not code.
- **Continuous capture.** Both backups are periodic. Versioning on the backup
  bucket covers an overwrite between runs. An object created and deleted
  between runs was never copied; versioning on the source bucket covers that.
