# web

Next.js 16 frontend: public marketing pages, the better-auth sign-in/sign-up
flow, and a session-guarded dashboard.

Run it from the repo root — this app needs Postgres up and its sibling services
running:

```sh
bun run dev
```

Or on its own, once `apps/web/.env` exists:

```sh
turbo dev --filter=web
```

Serves on http://localhost:3000.

## Notes

- **Bun only.** Do not use `npm`, `yarn`, or `pnpm` in this repo.
- **Environment variables** are validated at boot. `instrumentation.ts` imports
  `env.ts` purely to force that — the `void env` in it is load-bearing, not dead
  code. Copy `.env.example` to `.env` before starting.
- `NEXT_PUBLIC_APP_URL` is inlined into the client bundle at build time, so
  changing it needs a rebuild rather than a restart.
- **No bucket credentials here.** File uploads go through a presigned URL issued
  by the API, so the web server never holds `STORAGE_*` values.
- `middleware.ts` is kept env-free deliberately: it runs on the edge runtime, and
  importing `env.ts` would drag `postgres` into that bundle.

See the [root README](../../README.md) and [AGENTS.md](../../AGENTS.md).
