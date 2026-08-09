/**
 * Preloaded by this workspace's bunfig.toml for every `bun test` run here.
 *
 * These are local docker-compose defaults, applied with `??=` so a real value in
 * the environment always wins. They exist so a fresh clone can run the suite
 * with no .env files at all.
 *
 * Note what is deliberately NOT here: `SKIP_ENV_VALIDATION`. Skipping makes
 * t3-env return `runtimeEnv` raw, so zod defaults and transforms never run and a
 * value typed `boolean` is really the string "true". Supplying defaults instead
 * means tests parse env exactly the way production does.
 */
process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5430/postgres";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.BETTER_AUTH_SECRET ??= "test-secret-not-for-production";
process.env.CORS_ORIGIN ??= "http://localhost:3000";
process.env.STORAGE_ENDPOINT ??= "http://localhost:9000";
process.env.STORAGE_REGION ??= "auto";
process.env.STORAGE_ACCESS_KEY_ID ??= "minioadmin";
process.env.STORAGE_SECRET_ACCESS_KEY ??= "minioadmin";
process.env.STORAGE_BUCKET ??= "app-uploads";
process.env.STORAGE_FORCE_PATH_STYLE ??= "true";
