import { shouldSkipEnvValidation } from "@repo/env";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const databaseEnv = createEnv({
	emptyStringAsUndefined: true,
	runtimeEnv: process.env,
	server: {
		DATABASE_URL: z.url(),
	},
	skipValidation: shouldSkipEnvValidation(),
});
