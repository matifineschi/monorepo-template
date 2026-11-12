import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { shouldSkipEnvValidation } from "@repo/env";

export const authEnv = createEnv({
	emptyStringAsUndefined: true,
	runtimeEnv: process.env,
	server: {
		/** Origin that issues the session cookie — the web app, not the API. */
		BETTER_AUTH_URL: z.url(),
		BETTER_AUTH_SECRET: z.string().min(1),
	},
	skipValidation: shouldSkipEnvValidation(),
});
