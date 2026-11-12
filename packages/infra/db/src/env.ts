import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { shouldSkipEnvValidation } from "@repo/env";

export const databaseEnv = createEnv({
	emptyStringAsUndefined: true,
	runtimeEnv: process.env,
	server: {
		DATABASE_URL: z.url(),
		/**
		 * Connections per process, not per deployment. Multiply by the number of
		 * processes you run before comparing it to Postgres' `max_connections`:
		 * web + api + workers at 10 each is 30, and a serverless platform that
		 * scales the web app to 20 instances is 200.
		 */
		DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
		/** Seconds an idle connection is kept. 0 disables the timeout. */
		DATABASE_IDLE_TIMEOUT: z.coerce.number().int().nonnegative().default(20),
		DATABASE_CONNECT_TIMEOUT: z.coerce.number().int().positive().default(30),
		/**
		 * Tags connections in `pg_stat_activity` so you can tell which service is
		 * holding one. Set it per deployment; most platforms expose a service name.
		 */
		DATABASE_APP_NAME: z.string().min(1).default("app"),
	},
	skipValidation: shouldSkipEnvValidation(),
});
