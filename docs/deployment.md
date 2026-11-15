# Deployment

This template is **platform-agnostic on purpose**. There is no `railway.json`,
no `vercel.json`, no `fly.toml`, and nothing reads a platform's own environment
variables. What it ships instead is a _contract_: if your host satisfies the
list below, the apps run on it.

The distinction matters because almost nothing that stops a repo deploying is a
missing platform config file. It is reading config from disk instead of the
environment, ignoring `SIGTERM`, hardcoding a port, or having no way to say
whether an instance is healthy. The template owns those. The ten lines of
platform-specific glue are yours, and they belong to the project, not here.

## The contract

| Requirement                                      | How this repo satisfies it                                           |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| Configuration comes only from the environment    | every app has an `env.ts` validated at boot; there is no root `.env` |
| The HTTP port is injected                        | `apps/api` reads `PORT`; `apps/web` reads `PORT` via Next            |
| Logs go to stdout as one JSON object per line    | `@repo/logger`                                                       |
| `SIGTERM` drains in-flight work, then exits 0    | all four apps                                                        |
| Liveness and readiness are separate endpoints    | `GET /health` and `GET /ready` on the API                            |
| Migrations run once per release, not at app boot | `bun run --filter @repo/db db:migrate`                               |
| The build artefact is reproducible               | one `Dockerfile` per app                                             |
| The container does not run as root               | `USER bun` / `USER node`                                             |

### What your platform has to do

1. **Build** each app from its Dockerfile, with the **build context at the repo
   root** — a workspace install needs the root `package.json` and `bun.lock`:

   ```sh
   docker build -f apps/api/Dockerfile -t api .
   ```

   Every host that builds Dockerfiles lets you set the Dockerfile path while
   keeping the context at the root.

2. **Run migrations once**, after the build and before the new version serves
   traffic:

   ```sh
   bun run --filter @repo/db db:migrate
   ```

   Platforms name this differently — a pre-deploy command, a release command, a
   one-shot task, a Kubernetes Job — but they all have it.

   **Do not run migrations on app boot.** With two replicas they race, and the
   loser either fails to start or applies a half-migration.

3. **Probe `/ready`** for load-balancer membership, and `/health` for liveness.
   Getting these the wrong way round is actively harmful: a liveness probe that
   checks the database gets your containers _killed_ when the database blips,
   turning a momentary hiccup into a rolling restart of every instance.

4. **Set the environment variables** each app's `.env.example` documents.

5. **Allow at least 15s between `SIGTERM` and `SIGKILL`.** The API drains for up
   to 10s; a shorter grace period means the
   drain is pointless because the process is killed mid-flight anyway.

## The four images

| App            | Port | Notes                                                           |
| -------------- | ---- | --------------------------------------------------------------- |
| `apps/web`     | 3000 | Next, `output: "standalone"`; built with Bun, run on Node       |
| `apps/api`     | 3001 | Hono on Bun, bundled to a single file                           |
| `apps/workers` | —    | BullMQ consumers; serves no traffic                             |
| `apps/cron`    | —    | one-shot jobs for platform cron; see [backups.md](./backups.md) |

`apps/web` runs on `node:22-alpine` rather than Bun because `output:
"standalone"` emits a `server.js` that Next tests against Node and ships the
exact `node_modules` it needs. Building with Bun and running on Node is fine —
the build output is plain JavaScript.

Each Dockerfile copies the whole build context in one `COPY` and then installs.
Listing every workspace manifest separately would cache the install layer
better, but it has to be edited every time a package is added, and a template
should not impose that upkeep on the projects it generates. `.dockerignore` is
what keeps the context small.

## Platform recipes

These are **documentation, not configuration**. Nothing in the repo depends on
any of them.

### Railway

Three long-running services from one repo (web, api, workers), plus one cron
service per `apps/cron` job — see [Railway cron](#railway-cron) below. Per
service, set the Dockerfile path (`apps/api/Dockerfile`), leave the root directory at `/`, add a pre-deploy
command of `bun run --filter @repo/db db:migrate` on exactly one of them, and
point the healthcheck at `/ready`. Map the platform's own variables onto the
generic ones, for example `DATABASE_APP_NAME=${{RAILWAY_SERVICE_NAME}}`.

### Fly.io

One app per service, each with its own `fly.toml` _in your project, not here_.
Use `release_command = "bun run --filter @repo/db db:migrate"`, an
`http_service` check against `/ready`, and `kill_timeout` of at least 15s.

### Vercel + a managed Postgres

`apps/web` deploys to Vercel with no configuration at all — it autodetects Next
and ignores the Dockerfile. The API, workers and cron need somewhere that runs
containers; Vercel is not that, so they go elsewhere and `CORS_ORIGIN` plus
`NEXT_PUBLIC_APP_URL` tie the two halves together.

### Docker Compose on a single host

The images, a Postgres, a Redis and a bucket. Use the `HEALTHCHECK` already
baked into the web and API images, `depends_on: { condition: service_healthy }`,
and a one-shot migrate service that the apps depend on.

### Kubernetes

Liveness probe on `/health`, readiness probe on `/ready`, migrations as a Job
with a `helm.sh/hook: pre-upgrade` annotation or an init container on a single
pod, and `terminationGracePeriodSeconds: 30`.

## Scheduling apps/cron

`apps/cron` has no scheduler of its own. Deploy the one image as **one cron
entry per job**, each running `bun run dist/main.js <job>` and exiting. Suggested
schedules (UTC): `postgres-backup` `0 3 * * *`, `bucket-backup` `30 3 * * *`,
`postgres-restore-check` `0 4 * * 0`, `bucket-backup-check` `30 4 * * 0`.

- **Railway**: one cron service per job — see [Railway cron](#railway-cron).
- **Render**: one cron job per job, with the schedule in its settings and the
  command set to the job.
- **Kubernetes**: one `CronJob` per job, `concurrencyPolicy: Forbid`,
  `restartPolicy: Never`, and `args` naming the job.
- **ECS**: an EventBridge Scheduler rule per job running the task with the job
  in `command`.
- **Compose on a single host**: host crontab entries running
  `docker compose run --rm cron bun run dist/main.js <job>`.

Give `postgres-backup` and `postgres-restore-check` disk for one full dump
(`WORK_DIR`). Wire each job's `*_HEARTBEAT_URL` to a cron monitor — see
[backups.md](./backups.md#the-dead-mans-switch).

### Railway cron

One Railway service per job, all from the same repo and Dockerfile. They differ
only in start command and schedule:

| Service                       | Start command                                 | Cron schedule (UTC) |
| ----------------------------- | --------------------------------------------- | ------------------- |
| `cron-postgres-backup`        | `bun run dist/main.js postgres-backup`        | `0 3 * * *`         |
| `cron-bucket-backup`          | `bun run dist/main.js bucket-backup`          | `30 3 * * *`        |
| `cron-postgres-restore-check` | `bun run dist/main.js postgres-restore-check` | `0 4 * * 0`         |
| `cron-bucket-backup-check`    | `bun run dist/main.js bucket-backup-check`    | `30 4 * * 0`        |

**What picks the job.** At the scheduled time Railway starts a container from
the image and runs that service's start command. The last argument is the job
name; `main.ts` runs that one job and exits. Nothing in the code chooses.

**Railway schedules are UTC.** Convert from local time, and remember that a
weekly run early on a Monday in Australia is still Sunday in UTC. `0 17 * * *`
is 03:00 in Brisbane (UTC+10, no daylight saving).

Per service:

1. **New service → GitHub repo**, the same repo each time.
2. **Build**: Dockerfile path `apps/cron/Dockerfile`, root directory `/`. Set
   watch paths to `apps/cron/**` and `packages/**` so a web or API change does
   not rebuild the cron services.
3. **Deploy**: the start command and cron schedule from the table.
4. **Restart policy: Never.** A failed backup should alert through its
   heartbeat, not retry half-finished on a loop.
5. **Variables**: put `DATABASE_URL`, `BACKUP_S3_*` and `SOURCE_S3_*` in
   project-level shared variables and reference them from all four services.
   Give each service only its own `*_HEARTBEAT_URL`.
6. **Disk**: `postgres-backup` and `postgres-restore-check` write one full dump
   locally. Once the database is non-trivial, attach a volume to those two and
   set `WORK_DIR` to its mount path.

The same settings as config-as-code, one file per service (for example
`apps/cron/railway/postgres-backup.json`), with each service's config file path
pointing at its own file:

```json
{
	"$schema": "https://railway.com/railway.schema.json",
	"build": { "dockerfilePath": "apps/cron/Dockerfile" },
	"deploy": {
		"startCommand": "bun run dist/main.js postgres-backup",
		"cronSchedule": "0 3 * * *",
		"restartPolicyType": "NEVER"
	}
}
```

**The jobs do not run in sequence.** Each service is independent; two
schedules on the same minute run at the same time, which is why the table
staggers them. Nothing depends on order: the restore check takes the newest
dump and fails if it is over 48 hours old. The bucket check re-downloads a
sample and compares it to the source. A job that never ran is caught by its
heartbeat.

**Overlap.** If a run is still going when the same service is next due, Railway
skips the new run. A run stuck in `Active` long after it should have finished is
hung; the missing heartbeat ping is what alerts you. The advisory lock in
`main.ts` covers a manual run landing on a scheduled one.

**Before relying on it**, trigger each service once — from the dashboard or
with `railway cron run` — and confirm the heartbeat monitor received the success
ping and the dump or copied objects appeared in the backup bucket. Railway
requires runs to be at least 5 minutes apart, which nightly and weekly schedules
are far from.

## Mapping platform variables

Never read a platform's variables directly. Take a generic one and let the
platform map onto it:

```sh
# Railway
DATABASE_APP_NAME=${{RAILWAY_SERVICE_NAME}}
# Fly
DATABASE_APP_NAME=$FLY_APP_NAME
```

`DATABASE_APP_NAME` is the worked example — it tags connections in
`pg_stat_activity` so you can tell which service is holding one. Reading
`RAILWAY_SERVICE_NAME` in `@repo/db` would have been one line shorter and would
have made the package undeployable anywhere else.

The same reasoning rules out `@t3-oss/env-core`'s platform presets: they bake a
vendor's variable names into the env schema.

## Verifying it

CI builds all four images, boots the API against the test stack, and polls
`/ready` until it returns 200. That makes "this deploys" a tested property
rather than a claim, and it tests it without naming a platform.

Locally:

```sh
docker build -f apps/api/Dockerfile -t api .
bun run test-infra:up
docker run --rm --network host \
  -e DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres \
  -e REDIS_URL=redis://localhost:63792 \
  -e BETTER_AUTH_URL=http://localhost:3000 \
  -e BETTER_AUTH_SECRET=local-only \
  -e CORS_ORIGIN=http://localhost:3000 \
  -e STORAGE_ENDPOINT=http://localhost:59002 \
  -e STORAGE_ACCESS_KEY_ID=minioadmin \
  -e STORAGE_SECRET_ACCESS_KEY=minioadmin \
  -e STORAGE_BUCKET=app-uploads \
  api
```

`--network host` is what lets the container reach the test stack on localhost;
it works on Linux, and on macOS use `host.docker.internal` instead.
