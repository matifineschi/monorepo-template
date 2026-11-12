import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { databaseEnv } from "./env";
import { schema } from "./schema/index";

/**
 * Internal to this package. Apps import `@repo/db/operations/*`.
 *
 * The pool is cached on `globalThis` because module identity is not stable in
 * development. Next's HMR and `bun --hot` both re-evaluate a changed module and
 * everything that imports it, so a module-level `postgres(...)` opens a fresh
 * pool on every save; after an afternoon's work the connection limit is gone and
 * the failure looks like a database problem rather than a dev-server one.
 */
const globalForDb = globalThis as unknown as {
	__repoDbPool?: ReturnType<typeof postgres>;
};

const pool =
	globalForDb.__repoDbPool ??
	postgres(databaseEnv.DATABASE_URL, {
		connect_timeout: databaseEnv.DATABASE_CONNECT_TIMEOUT,
		connection: { application_name: databaseEnv.DATABASE_APP_NAME },
		idle_timeout: databaseEnv.DATABASE_IDLE_TIMEOUT,
		max: databaseEnv.DATABASE_POOL_MAX,
		// Recycles connections every 30 minutes. A long-lived connection behind a
		// proxy or load balancer can be silently dropped at one end and look open
		// at the other; capping its lifetime turns that into a reconnect.
		max_lifetime: 60 * 30,
	});

globalForDb.__repoDbPool = pool;

export const db = drizzle<typeof schema>(pool, {
	casing: "snake_case",
	schema,
});

export { schema };
