import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { authEnv } from "@repo/auth/env";
import { databaseEnv } from "@repo/db/env";
import { shouldSkipEnvValidation } from "@repo/env";
import { baseEnv } from "@repo/env/base";
import { queuesEnv } from "@repo/queues/env";
import { storageEnv } from "@repo/storage/env";

export const env = createEnv({
	emptyStringAsUndefined: true,
	extends: [baseEnv, databaseEnv, authEnv, queuesEnv, storageEnv],
	runtimeEnv: process.env,
	server: {
		PORT: z.coerce.number().int().positive().default(3001),
		/**
		 * Required with no default: a fallback here would silently ship a
		 * dev-only CORS policy to production.
		 */
		CORS_ORIGIN: z.url(),
	},
	skipValidation: shouldSkipEnvValidation(),
});
