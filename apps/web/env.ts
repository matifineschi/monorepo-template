import { authEnv } from "@repo/auth/env";
import { databaseEnv } from "@repo/db/env";
import { shouldSkipEnvValidation } from "@repo/env";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Client env is separate because Next inlines NEXT_PUBLIC_* at build time, and
 * it can only do that from a literal `process.env.NEXT_PUBLIC_X` reference —
 * hence the explicit runtimeEnv map rather than passing `process.env`.
 *
 * Consequence: changing one of these needs a rebuild, not just a restart.
 */
export const clientEnv = createEnv({
	emptyStringAsUndefined: true,
	client: {
		NEXT_PUBLIC_APP_URL: z.url(),
	},
	runtimeEnv: {
		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
	},
	skipValidation: shouldSkipEnvValidation(),
});

/**
 * No storageEnv here on purpose: the browser uploads to a presigned URL it gets
 * from the API, so the web server never holds bucket credentials. Adding them
 * would defeat the point of presigning.
 */
export const env = createEnv({
	emptyStringAsUndefined: true,
	extends: [clientEnv, authEnv, databaseEnv],
	server: {
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
	},
	experimental__runtimeEnv: process.env,
	skipValidation: shouldSkipEnvValidation(),
});
