import { authEnv } from "@repo/auth/env";
import { databaseEnv } from "@repo/db/env";
import { shouldSkipEnvValidation } from "@repo/env";
import { queuesEnv } from "@repo/queues/env";
import { storageEnv } from "@repo/storage/env";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	emptyStringAsUndefined: true,
	extends: [databaseEnv, authEnv, queuesEnv, storageEnv],
	runtimeEnv: process.env,
	server: {
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		PORT: z.coerce.number().int().positive().default(3001),
		/**
		 * Required with no default: a fallback here would silently ship a
		 * dev-only CORS policy to production.
		 */
		CORS_ORIGIN: z.url(),
	},
	skipValidation: shouldSkipEnvValidation(),
});
