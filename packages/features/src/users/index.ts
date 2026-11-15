import type { AuthUser } from "@repo/db/operations/user-auth";
import {
	deleteAuthUserById,
	getAuthUserByEmail,
} from "@repo/db/operations/user-auth";
import type { PublicUser } from "@repo/db/operations/users";
import {
	createUser,
	deleteUserById,
	getUserById,
} from "@repo/db/operations/users";
import { withTransaction } from "@repo/db/transaction";

import { getNameParts } from "./name-parts";

export { displayNameFromEmail, getNameParts } from "./name-parts";
export type { AuthUser as Account, PublicUser as UserProfile };

/**
 * Creates the `public.users` profile for a freshly signed-up account.
 *
 * Idempotent: better-auth's `user.create.after` hook can fire more than once
 * for the same id across retries, and the operation's `onConflictDoNothing`
 * is what keeps that safe.
 */
export async function provisionUser(user: {
	id: string;
	name?: string | null;
	email?: string | null;
}): Promise<{ created: boolean }> {
	return createUser({ id: user.id, ...getNameParts(user) });
}

export async function getUserProfile(
	userId: string,
): Promise<PublicUser | null> {
	return getUserById(userId);
}

export async function findAccountByEmail(
	email: string,
): Promise<AuthUser | null> {
	return getAuthUserByEmail(email);
}

/**
 * Removes the profile and the better-auth account together. The order is
 * forced by the FK: `public.users` references `user_auth.users` with
 * ON DELETE RESTRICT. One transaction, so a failure never leaves an account
 * without a profile.
 */
export async function deleteAccount(userId: string): Promise<void> {
	await withTransaction(async (tx) => {
		await deleteUserById(userId, tx);
		await deleteAuthUserById(userId, tx);
	});
}
