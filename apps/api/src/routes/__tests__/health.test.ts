import { describe, expect, test } from "bun:test";

import { healthRoutes } from "../health";

/**
 * The canary for the whole `app.request()` testing style: it imports nothing
 * env-validated, so if this fails the harness is wrong, not the route.
 */
describe("GET /health", () => {
	test("returns ok with a parseable timestamp", async () => {
		const response = await healthRoutes.request("/health");

		expect(response.status).toBe(200);

		const body = (await response.json()) as {
			status: string;
			timestamp: string;
		};
		expect(body.status).toBe("ok");
		expect(Number.isFinite(Date.parse(body.timestamp))).toBe(true);
	});

	test("404s an unknown path", async () => {
		expect((await healthRoutes.request("/nope")).status).toBe(404);
	});
});
