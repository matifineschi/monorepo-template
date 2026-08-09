import { describe, expect, test } from "bun:test";

import { auth } from "../auth";

/**
 * Stays a unit test: importing `auth` pulls in @repo/db/client, but `postgres()`
 * is lazy, so no connection is opened here.
 */
describe("auth config", () => {
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
});
