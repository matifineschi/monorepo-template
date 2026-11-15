# syntax=docker/dockerfile:1
#
# Build from the REPO ROOT, not this directory:
#   docker build -f apps/api/Dockerfile -t api .
#
# Every platform that builds from a Dockerfile lets you set its path while
# keeping the context at the root, which is what a workspace install needs.

FROM oven/bun:1.3.10-alpine AS build
WORKDIR /repo

# The whole context in one COPY. Listing each workspace manifest separately
# would cache the install layer better, but it has to be edited every time a
# package is added — upkeep a template should not impose on the projects that
# inherit it. `.dockerignore` is what keeps this cheap.
COPY . .

RUN bun install --frozen-lockfile
RUN bun run --filter api build

FROM oven/bun:1.3.10-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# `bun build --target bun` bundles the workspace packages and dependencies into
# one file, so the runtime image needs no node_modules at all.
COPY --from=build /repo/apps/api/dist ./dist

# Never root. Most platforms do not enforce this, and the one that does will
# fail at deploy time rather than in review.
USER bun

EXPOSE 3001

# Uses the readiness endpoint, so an instance that cannot reach Postgres,
# Redis or the bucket reports unhealthy instead of serving errors.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD ["bun", "-e", "const r = await fetch('http://127.0.0.1:3001/ready'); if (!r.ok) process.exit(1)"]

CMD ["bun", "run", "dist/index.js"]
