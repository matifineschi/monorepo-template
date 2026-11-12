import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { shouldSkipEnvValidation } from "./index";

/**
 * The variables every workspace agrees on, declared once.
 *
 * Kept in its own subpath rather than in `index.ts` so that importing
 * `shouldSkipEnvValidation` stays free of side effects — `createEnv` validates
 * at module load, and the helper is imported by every `src/env.ts` in the repo,
 * including the ones that run before anything is configured.
 */
export const baseEnv = createEnv({
	emptyStringAsUndefined: true,
	runtimeEnv: process.env,
	server: {
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
	},
	skipValidation: shouldSkipEnvValidation(),
});
