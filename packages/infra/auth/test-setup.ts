/**
 * Preloaded by this workspace's bunfig.toml for every `bun test` run here.
 * See apps/api/test-setup.ts for why validation is not skipped.
 */
process.env.DATABASE_URL ??=
	"postgres://postgres:postgres@localhost:5430/postgres";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.BETTER_AUTH_SECRET ??= "test-secret-not-for-production";
