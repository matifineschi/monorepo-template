import { eq } from "drizzle-orm";

import { db, schema } from "../client";

type PublicUserProvisionInput = {
	id: string;
	name?: string | null;
	email?: string | null;
};

export type PublicUser = {
	id: string;
	firstName: string;
	lastName: string;
	mobile: string | null;
};

/**
 * Exported for testing: this decides what every new user is called, and every
 * branch here is a fallback for a case better-auth can actually produce.
 */
export function getNameParts(
	input: Pick<PublicUserProvisionInput, "email" | "name">,
): {
	firstName: string;
	lastName: string;
} {
	const trimmedName = input.name?.trim();
	const fallbackFromEmail = input.email?.split("@")[0]?.trim();
	const normalized = trimmedName || fallbackFromEmail || "User";
	const [firstName, ...rest] = normalized.split(/\s+/).filter(Boolean);

	return {
		firstName: firstName || "User",
		lastName: rest.join(" ") || "User",
	};
}

/**
 * Idempotent: better-auth's user.create.after hook can fire more than once for
 * the same id across retries, and `onConflictDoNothing` is what keeps that safe.
 */
export async function createUser(
	input: PublicUserProvisionInput,
): Promise<{ created: boolean }> {
	const { firstName, lastName } = getNameParts(input);

	const [createdUser] = await db
		.insert(schema.users)
		.values({
			id: input.id,
			firstName,
			lastName,
		})
		.onConflictDoNothing({ target: schema.users.id })
		.returning({
			id: schema.users.id,
		});

	return { created: Boolean(createdUser?.id) };
}

export async function getUserById(id: string): Promise<PublicUser | null> {
	const [user] = await db
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

export async function deleteUserById(id: string): Promise<void> {
	await db.delete(schema.users).where(eq(schema.users.id, id));
}
