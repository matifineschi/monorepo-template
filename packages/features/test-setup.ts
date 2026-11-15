/**
 * Preloaded by this workspace's bunfig.toml for every `bun test` run here.
 * See apps/api/test-setup.ts for why validation is not skipped.
 *
 * The unit tests never open a connection (postgres, BullMQ and S3 clients are
 * all lazy), but importing the modules validates every package's env.
 */
process.env.DATABASE_URL ??=
	"postgres://postgres:postgres@localhost:5430/postgres";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.BETTER_AUTH_SECRET ??= "test-secret-not-for-production";
process.env.STORAGE_ENDPOINT ??= "http://localhost:9000";
process.env.STORAGE_REGION ??= "auto";
process.env.STORAGE_ACCESS_KEY_ID ??= "minioadmin";
process.env.STORAGE_SECRET_ACCESS_KEY ??= "minioadmin";
process.env.STORAGE_BUCKET ??= "app-uploads";
process.env.STORAGE_FORCE_PATH_STYLE ??= "true";
process.env.EMAIL_TRANSPORT ??= "log";
process.env.EMAIL_FROM ??= "Acme <onboarding@resend.dev>";
process.env.LOG_LEVEL ??= "silent";
