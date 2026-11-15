# syntax=docker/dockerfile:1
#
# Build from the REPO ROOT:
#   docker build -f apps/cron/Dockerfile -t cron .
#
# One image, four jobs. Each platform cron entry runs the same image with a
# different job name and exits when done:
#
#   bun run dist/main.js postgres-backup
#   bun run dist/main.js postgres-restore-check
#   bun run dist/main.js bucket-backup
#   bun run dist/main.js bucket-backup-check

FROM oven/bun:1.3.10-alpine AS build
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile
RUN bun run --filter cron build

FROM oven/bun:1.3.10-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# postgresql17-client: pg_dump refuses to dump a server newer than itself, so
# keep this major in step with the postgres image in docker-compose.yml and
# your managed instance.
# rclone: all object-storage access, for both buckets.
RUN apk add --no-cache postgresql17-client rclone

COPY --from=build /repo/apps/cron/dist ./dist
USER bun

# No job name here on purpose: with none, main.ts prints usage and exits 2.
# Set the full command per cron entry, e.g. `bun run dist/main.js postgres-backup`.
CMD ["bun", "run", "dist/main.js"]
