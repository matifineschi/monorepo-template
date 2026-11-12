import { db, type TransactionExecutor } from "./client";

export type { DbOrTx, TransactionExecutor } from "./client";

/**
 * Runs several operations in one transaction.
 *
 * Every operation in `operations/*` takes an optional executor as its last
 * argument, so composing them is a matter of passing the one this hands you.
 * Rolling back is a throw: return normally and the transaction commits.
 *
 * @example
 * await withTransaction(async (tx) => {
 *   await createUser(input, tx);
 *   await recordSignup(input.id, tx);
 * });
 *
 * Two things to keep in mind. An operation you forget to pass `tx` to runs on
 * the pool instead, outside the transaction, and will not roll back with it —
 * that is the one failure mode this pattern has. And a transaction holds a
 * connection for its whole duration, so do not await an HTTP call inside one.
 */
export async function withTransaction<T>(
	fn: (tx: TransactionExecutor) => Promise<T>,
): Promise<T> {
	return await db.transaction(fn);
}

export { closePool } from "./client";
