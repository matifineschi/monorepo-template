import { eq } from "drizzle-orm";

import { type DbOrTx, db, schema } from "../client";

export type AuthUser = {
	id: string;
	name: string;
	email: string | null;
};

export async function getAuthUserById(
	userId: string,
	executor: DbOrTx = db,
): Promise<AuthUser | null> {
	const [user] = await executor
		.select({
			id: schema.userAuthUsers.id,
			name: schema.userAuthUsers.name,
			email: schema.userAuthUsers.email,
		})
		.from(schema.userAuthUsers)
		.where(eq(schema.userAuthUsers.id, userId))
		.limit(1);

	return user ?? null;
}

export async function getAuthUserByEmail(
	email: string,
	executor: DbOrTx = db,
): Promise<AuthUser | null> {
	const [user] = await executor
		.select({
			id: schema.userAuthUsers.id,
			name: schema.userAuthUsers.name,
			email: schema.userAuthUsers.email,
		})
		.from(schema.userAuthUsers)
		.where(eq(schema.userAuthUsers.email, email))
		.limit(1);

	return user ?? null;
}

/**
 * Deletes the better-auth user row. The public.users row references this one
 * with ON DELETE RESTRICT, so delete that first (see operations/users.ts).
 */
export async function deleteAuthUserById(
	userId: string,
	executor: DbOrTx = db,
): Promise<void> {
	await executor
		.delete(schema.userAuthUsers)
		.where(eq(schema.userAuthUsers.id, userId));
}

export async function createAuthUser(
	input: {
		id: string;
		name: string;
		email: string;
	},
	executor: DbOrTx = db,
): Promise<void> {
	await executor.insert(schema.userAuthUsers).values({
		id: input.id,
		name: input.name,
		email: input.email,
		emailVerified: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}
