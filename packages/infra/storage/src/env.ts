import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { booleanFlag, shouldSkipEnvValidation } from "@repo/env";

export const storageEnv = createEnv({
	emptyStringAsUndefined: true,
	runtimeEnv: process.env,
	server: {
		STORAGE_ENDPOINT: z.url(),
		STORAGE_REGION: z.string().default("auto"),
		STORAGE_ACCESS_KEY_ID: z.string().min(1),
		STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
		STORAGE_BUCKET: z.string().min(1),
		/**
		 * MinIO and most S3-compatible services need path-style addressing;
		 * real AWS S3 wants virtual-hosted style. Defaults true for the local stack.
		 */
		STORAGE_FORCE_PATH_STYLE: booleanFlag(true),
	},
	skipValidation: shouldSkipEnvValidation(),
});
