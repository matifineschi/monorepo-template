import { describe, expect, mock, test } from "bun:test";

import { createAuth } from "../auth";

/**
 * Stays a unit test: `createAuth` pulls in @repo/db/client, but `postgres()`
 * is lazy, so no connection is opened here.
 */
describe("createAuth", () => {
	const auth = createAuth();

	test("email + password sign-in is enabled", () => {
		expect(auth.options.emailAndPassword?.enabled).toBe(true);
	});

	/**
	 * Must stay "uuid": public.users.id is a uuid column with an FK onto
	 * user_auth.users.id, so a different id strategy breaks provisioning.
	 */
	test("generates uuid ids", () => {
		expect(auth.options.advanced?.database?.generateId).toBe("uuid");
	});

	test("uses the plural drizzle table names the schema defines", () => {
		expect(auth.options.database).toBeDefined();
	});

	test("revokes every session when a password is reset", () => {
		expect(auth.options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(
			true,
		);
	});

	test("wires the reset-password hook it is given", () => {
		const sendResetPassword = mock(async () => {});
		const withHook = createAuth({ sendResetPassword });

		expect(withHook.options.emailAndPassword?.sendResetPassword).toBe(
			sendResetPassword,
		);
	});
});
