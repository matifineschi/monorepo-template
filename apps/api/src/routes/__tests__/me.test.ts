import { describe, expect, test } from "bun:test";
import { Hono } from "hono";

import type { AppVariables } from "../../lib/types";
import { meRoutes } from "../me";

/**
 * Exercises the route's authorization guard without booting better-auth or
 * Postgres: `meRoutes` only imports a type, so a wrapper that sets the same
 * context variables the real session middleware would is a faithful stand-in.
 */
function withSession(user: unknown, session: unknown) {
	const app = new Hono<{ Variables: AppVariables }>();
	app.use("*", async (c, next) => {
		c.set("user", user as AppVariables["user"]);
		c.set("session", session as AppVariables["session"]);
		await next();
	});
	app.route("/me", meRoutes);
	return app;
}

describe("GET /me", () => {
	test("401s with no session", async () => {
		const response = await withSession(null, null).request("/me");

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Unauthorized" });
	});

	test("echoes the user and session when authenticated", async () => {
		const user = { id: "user-1", email: "ada@example.test" };
		const session = { id: "session-1", userId: "user-1" };

		const response = await withSession(user, session).request("/me");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ user, session });
	});
});
