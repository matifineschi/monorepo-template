import { eq } from "drizzle-orm";

import { type DbOrTx, db, schema } from "../client";

/** The names are decided by the caller; this layer only stores them. */
type PublicUserProvisionInput = {
	id: string;
	firstName: string;
	lastName: string;
};

export type PublicUser = {
	id: string;
	firstName: string;
	lastName: string;
	mobile: string | null;
};

/**
 * Idempotent: better-auth's user.create.after hook can fire more than once for
 * the same id across retries, and `onConflictDoNothing` is what keeps that safe.
 *
 * The trailing `executor` is the repo's convention for every operation: it
 * defaults to the pool, and `withTransaction` from `@repo/db/transaction` is
 * what passes something else.
 */
export async function createUser(
	input: PublicUserProvisionInput,
	executor: DbOrTx = db,
): Promise<{ created: boolean }> {
	const [createdUser] = await executor
		.insert(schema.users)
		.values({
			id: input.id,
			firstName: input.firstName,
			lastName: input.lastName,
		})
		.onConflictDoNothing({ target: schema.users.id })
		.returning({
			id: schema.users.id,
		});

	return { created: Boolean(createdUser?.id) };
}

export async function getUserById(
	id: string,
	executor: DbOrTx = db,
): Promise<PublicUser | null> {
	const [user] = await executor
		.select({
			id: schema.users.id,
			firstName: schema.users.firstName,
			lastName: schema.users.lastName,
			mobile: schema.users.mobile,
		})
		.from(schema.users)
		.where(eq(schema.users.id, id))
		.limit(1);

	return user ?? null;
}

export async function deleteUserById(
	id: string,
	executor: DbOrTx = db,
): Promise<void> {
	await executor.delete(schema.users).where(eq(schema.users.id, id));
}
