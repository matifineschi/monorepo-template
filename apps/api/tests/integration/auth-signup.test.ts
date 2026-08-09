import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	deleteAuthUserById,
	getAuthUserByEmail,
} from "@repo/db/operations/user-auth";
import { deleteUserById, getUserById } from "@repo/db/operations/users";

import { app } from "../../src/index";

/**
 * The highest-value test in the repo. One sign-up exercises env composition, the
 * Hono mount path, better-auth's Drizzle adapter, the patched user_auth schema,
 * the user.create.after provisioning hook, and the operations DAL.
 *
 * Requires real Postgres. Run-scoped emails so re-runs never collide.
 *
 * Note it reaches the database only through @repo/db/operations/* — the same
 * rule application code follows. Nothing here imports @repo/db/client.
 */
const RUN = Date.now().toString(36);
const EMAIL = `signup-${RUN}@example.test`;
const SESSION_EMAIL = `signup-session-${RUN}@example.test`;
const PASSWORD = "correct-horse-battery-staple";

/** FK order matters: public.users before user_auth.users (ON DELETE RESTRICT). */
async function removeUser(email: string) {
	const authUser = await getAuthUserByEmail(email);
	if (!authUser) return;

	await deleteUserById(authUser.id);
	await deleteAuthUserById(authUser.id);
}

async function cleanup() {
	await removeUser(EMAIL);
	await removeUser(SESSION_EMAIL);
}

beforeAll(cleanup);
afterAll(cleanup);

/**
 * The path must be the full mounted one. better-auth matches the incoming URL
 * against its basePath, so calling authRoutes.request("/sign-up/email")
 * directly would 404 inside better-auth.
 */
function signUp(body: unknown) {
	return app.request("/api/auth/sign-up/email", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /api/auth/sign-up/email", () => {
	test("creates a session and provisions the public user row", async () => {
		const response = await signUp({
			email: EMAIL,
			password: PASSWORD,
			name: "Ada Lovelace",
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("set-cookie")).toContain("better-auth");

		const authUser = await getAuthUserByEmail(EMAIL);
		expect(authUser).not.toBeNull();

		// The user.create.after hook ran and split the name.
		expect(await getUserById(authUser?.id as string)).toMatchObject({
			firstName: "Ada",
			lastName: "Lovelace",
		});
	});

	test("rejects a duplicate email", async () => {
		const response = await signUp({
			email: EMAIL,
			password: PASSWORD,
			name: "Ada Again",
		});

		expect(response.status).toBeGreaterThanOrEqual(400);
	});

	test("rejects a too-short password", async () => {
		const response = await signUp({
			email: `short-${RUN}@example.test`,
			password: "x",
			name: "Ada",
		});

		expect(response.status).toBeGreaterThanOrEqual(400);
	});
});

describe("GET /me", () => {
	test("401s without a session cookie", async () => {
		expect((await app.request("/me")).status).toBe(401);
	});

	test("returns the user when the session cookie is presented", async () => {
		const signUpResponse = await signUp({
			email: SESSION_EMAIL,
			password: PASSWORD,
			name: "Grace Hopper",
		});
		const cookie = signUpResponse.headers.get("set-cookie");
		expect(cookie).toBeTruthy();

		const response = await app.request("/me", {
			headers: { cookie: cookie as string },
		});

		expect(response.status).toBe(200);
		const body = (await response.json()) as { user: { email: string } };
		expect(body.user.email).toBe(SESSION_EMAIL);
	});
});
