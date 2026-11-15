import { sql } from "drizzle-orm";

import { type DbOrTx, db } from "../client";

/**
 * Cheapest possible proof that this process can reach Postgres and get a
 * connection out of the pool.
 *
 * It is an operation rather than something on the client because apps are not
 * allowed to import the client, and a readiness probe is an app concern.
 * `select 1` deliberately touches no table: a probe that queries a real table
 * starts failing for reasons that are not "the database is unreachable".
 */
export async function pingDatabase(executor: DbOrTx = db): Promise<void> {
	await executor.execute(sql`select 1`);
}
