/**
 * Preloaded by this workspace's bunfig.toml for every `bun test` run here.
 * See apps/api/test-setup.ts for why validation is not skipped.
 */
process.env.DATABASE_URL ??=
	"postgres://postgres:postgres@localhost:5430/postgres";
process.env.BACKUP_S3_ENDPOINT ??= "http://localhost:9000";
process.env.BACKUP_S3_BUCKET ??= "app-backups";
process.env.BACKUP_S3_ACCESS_KEY_ID ??= "minioadmin";
process.env.BACKUP_S3_SECRET_ACCESS_KEY ??= "minioadmin";
process.env.SOURCE_S3_ENDPOINT ??= "http://localhost:9000";
process.env.SOURCE_S3_BUCKET ??= "app-uploads";
process.env.SOURCE_S3_ACCESS_KEY_ID ??= "minioadmin";
process.env.SOURCE_S3_SECRET_ACCESS_KEY ??= "minioadmin";
process.env.LOG_LEVEL ??= "silent";
