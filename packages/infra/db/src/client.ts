import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { databaseEnv } from "./env";
import { schema } from "./schema/index";

/**
 * Internal to this package. Apps import `@repo/db/operations/*` and, when they
 * need several operations in one transaction, `@repo/db/transaction` — Biome's
 * `noRestrictedImports` enforces that rather than leaving it to review.
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

/** The top-level client. */
export type DbExecutor = typeof db;

/** The handle `db.transaction(...)` hands its callback. */
export type TransactionExecutor = Parameters<
	Parameters<typeof db.transaction>[0]
>[0];

/**
 * What every operation accepts.
 *
 * Operations default to the pool, so the common call site passes nothing. The
 * parameter exists so two operations can be made to share one transaction
 * without either of them knowing about transactions — see `./transaction`.
 */
export type DbOrTx = DbExecutor | TransactionExecutor;

/**
 * Closes the pool. Only for a script or a test run that must exit cleanly;
 * long-running processes should let the pool live as long as they do.
 */
export async function closePool(): Promise<void> {
	await pool.end({ timeout: 5 });
	globalForDb.__repoDbPool = undefined;
}
