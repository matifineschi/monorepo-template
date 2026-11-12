import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { shouldSkipEnvValidation } from "@repo/env";

export const queuesEnv = createEnv({
	emptyStringAsUndefined: true,
	runtimeEnv: process.env,
	server: {
		REDIS_URL: z.url(),
		/**
		 * Namespaces every BullMQ key in Redis. `bull` is BullMQ's own default and
		 * what production should stay on — changing it in a deployed environment
		 * orphans every job already enqueued, exactly like renaming a queue.
		 *
		 * It exists so an integration run can have queues of its own in a shared
		 * Redis: two suites on the same queue name otherwise consume each other's
		 * jobs, which is the kind of failure that only shows up under load.
		 */
		QUEUE_PREFIX: z.string().min(1).default("bull"),
	},
	skipValidation: shouldSkipEnvValidation(),
});
