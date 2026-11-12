import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { shouldSkipEnvValidation } from "@repo/env";
import { baseEnv } from "@repo/env/base";
import { queuesEnv } from "@repo/queues/env";
import { storageEnv } from "@repo/storage/env";

export const env = createEnv({
	emptyStringAsUndefined: true,
	extends: [baseEnv, queuesEnv, storageEnv],
	runtimeEnv: process.env,
	server: {
		/** Jobs processed in parallel per worker. */
		WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
	},
	skipValidation: shouldSkipEnvValidation(),
});
