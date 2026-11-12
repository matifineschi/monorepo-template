import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { shouldSkipEnvValidation } from "@repo/env";

export const loggerEnv = createEnv({
	emptyStringAsUndefined: true,
	runtimeEnv: process.env,
	server: {
		/**
		 * `silent` is here so a test run can turn the logger off entirely. It is
		 * not a level you would set in a deployed environment — if you want fewer
		 * logs there, raise the floor to `warn` rather than going dark.
		 */
		LOG_LEVEL: z
			.enum(["silent", "debug", "info", "warn", "error"])
			.default("info"),
	},
	skipValidation: shouldSkipEnvValidation(),
});
