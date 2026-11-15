# syntax=docker/dockerfile:1
#
# Build from the REPO ROOT:
#   docker build -f apps/workers/Dockerfile -t workers .

FROM oven/bun:1.3.10-alpine AS build
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile
RUN bun run --filter workers build

FROM oven/bun:1.3.10-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/workers/dist ./dist
USER bun

# No port and no HEALTHCHECK: this process serves no traffic. Liveness is the
# platform noticing the process exited, and whether it is *working* is a
# question about queue depth, which belongs in monitoring rather than here.
CMD ["bun", "run", "dist/index.js"]
