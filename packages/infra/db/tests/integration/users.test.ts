import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
	createAuthUser,
	deleteAuthUserById,
} from "../../src/operations/user-auth";
import {
	createUser,
	deleteUserById,
	getUserById,
} from "../../src/operations/users";

/**
 * Runs against the real Postgres in docker-compose.
 *
 * Note: this test connects as the `postgres` superuser, which is also the table
 * owner, so the `users_all_own` RLS policy is bypassed entirely. A green run
 * here is NOT evidence that RLS works — see packages/infra/db/README.md.
 */
const RUN = Date.now().toString(36);
const AUTH_USER_ID = crypto.randomUUID();
const email = `db-users-${RUN}@example.test`;

/** FK order matters: public.users references user_auth.users with ON DELETE RESTRICT. */
async function cleanup() {
	await deleteUserById(AUTH_USER_ID);
	await deleteAuthUserById(AUTH_USER_ID);
}

beforeAll(async () => {
	await cleanup();
	await createAuthUser({ id: AUTH_USER_ID, name: "Ada Lovelace", email });
});

afterAll(cleanup);

describe("user provisioning", () => {
	test("creates the public row with split names", async () => {
		expect(
			await createUser({ id: AUTH_USER_ID, name: "Ada Lovelace", email }),
		).toEqual({ created: true });

		expect(await getUserById(AUTH_USER_ID)).toEqual({
			id: AUTH_USER_ID,
			firstName: "Ada",
			lastName: "Lovelace",
			mobile: null,
		});
	});

	/**
	 * The real subject of this file. better-auth's user.create.after hook can
	 * fire twice for the same id across retries, and onConflictDoNothing is the
	 * only thing that keeps that from throwing on a duplicate primary key.
	 */
	test("is idempotent on a repeat call", async () => {
		expect(
			await createUser({ id: AUTH_USER_ID, name: "Ada Lovelace", email }),
		).toEqual({ created: false });

		expect((await getUserById(AUTH_USER_ID))?.firstName).toBe("Ada");
	});

	test("returns null for an unknown id", async () => {
		expect(await getUserById(crypto.randomUUID())).toBeNull();
	});

	test("deletes the public row", async () => {
		await deleteUserById(AUTH_USER_ID);
		expect(await getUserById(AUTH_USER_ID)).toBeNull();

		// Re-create so afterAll's FK-ordered cleanup still has the shape it expects.
		await createUser({ id: AUTH_USER_ID, name: "Ada Lovelace", email });
	});
});
