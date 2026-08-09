import { z } from "zod";

/**
 * Scripts that must not fail on missing env: they never open a connection, they
 * only read or type-check source. `gen:schema` boots better-auth to introspect
 * its config, so it needs the skip too (that script also sets
 * SKIP_ENV_VALIDATION explicitly — belt and braces).
 *
 * Deliberately NOT here:
 *
 * - `db:generate` / `db:migrate` / `db:push` need a real DATABASE_URL, and a
 *   named validation error beats drizzle-kit's connection error. If a schema
 *   file ever imports an env-reading module, add them back rather than
 *   unpicking drizzle.config.ts.
 * - `test` — skipping validation returns `runtimeEnv` raw, so zod defaults and
 *   transforms never run and a value typed `boolean` is really the string
 *   "true" at runtime. Tests would then exercise types production never sees.
 *   Each workspace's `test-setup.ts` supplies local docker defaults instead, so
 *   validation genuinely runs and the parsed values match production.
 */
const SKIP_LIFECYCLE_EVENTS = new Set([
	"format",
	"format:check",
	"lint",
	"typecheck",
	"knip",
	"gen:schema",
]);

/** Skip env validation during lint/typecheck/test and better-auth codegen. */
export function shouldSkipEnvValidation(): boolean {
	if (process.env.SKIP_ENV_VALIDATION === "1") return true;
	const lifecycleEvent = process.env.npm_lifecycle_event ?? "";
	return SKIP_LIFECYCLE_EVENTS.has(lifecycleEvent);
}

/** Parses env booleans without z.coerce.boolean() ("false" would be true). */
export function booleanFlag(defaultValue = false) {
	return z
		.string()
		.optional()
		.transform((value) => {
			if (value === undefined) return defaultValue;
			const normalized = value.trim().toLowerCase();
			if (normalized === "true" || normalized === "1") return true;
			if (normalized === "false" || normalized === "0") return false;
			return defaultValue;
		});
}
