/**
 * Preloaded by this workspace's bunfig.toml for every `bun test` run here.
 * See apps/api/test-setup.ts for why validation is not skipped.
 */
process.env.EMAIL_TRANSPORT ??= "log";
process.env.EMAIL_FROM ??= "Acme <onboarding@resend.dev>";
process.env.LOG_LEVEL ??= "silent";
