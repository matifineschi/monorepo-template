import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { shouldSkipEnvValidation } from "@repo/env";

export const queuesEnv = createEnv({
	emptyStringAsUndefined: true,
	runtimeEnv: process.env,
	server: {
		REDIS_URL: z.url(),
	},
	skipValidation: shouldSkipEnvValidation(),
});
