/**
 * Preloaded by this workspace's bunfig.toml for every `bun test` run here.
 * See apps/api/test-setup.ts for why validation is not skipped.
 */
process.env.STORAGE_ENDPOINT ??= "http://localhost:9000";
process.env.STORAGE_REGION ??= "auto";
process.env.STORAGE_ACCESS_KEY_ID ??= "minioadmin";
process.env.STORAGE_SECRET_ACCESS_KEY ??= "minioadmin";
process.env.STORAGE_BUCKET ??= "app-uploads";
process.env.STORAGE_FORCE_PATH_STYLE ??= "true";
