# syntax=docker/dockerfile:1
#
# Build from the REPO ROOT:
#   docker build -f apps/web/Dockerfile -t web .

# Install with Bun, because the lockfile is Bun's and the workspace links are
# its doing.
FROM oven/bun:1.3.10-alpine AS deps
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile

# Build with Node, not Bun. `next build` under Bun 1.3 fails loading Next's own
# compiled server runtime ("Expected CommonJS module to have a function
# wrapper"), and building on the runtime the app actually runs on removes a
# whole class of that. Bun installs, Node builds and serves.
FROM node:22-alpine AS build
WORKDIR /repo
COPY --from=deps /repo .

# `next build` validates env, and there is no root .env. Only NEXT_PUBLIC_* are
# baked into the client bundle; server-side values are read again at runtime.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1

WORKDIR /repo/apps/web
# Bun does not hoist `next` to the root node_modules, so resolve it from this
# workspace rather than assuming a flat layout.
RUN node node_modules/.bin/next build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The three pieces `output: "standalone"` splits across, in a workspace layout.
# `static` and `public` are deliberately left outside the standalone directory
# and have to be copied to the paths the generated server expects.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
	CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "apps/web/server.js"]
