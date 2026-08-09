import { describe, expect, test } from "bun:test";
import { Hono } from "hono";

import type { AppVariables } from "../../lib/types";
import { filesRoutes } from "../files";

const USER_ID = "3f1c2b4a-0000-4000-8000-000000000001";

function withSession(user: unknown) {
	const app = new Hono<{ Variables: AppVariables }>();
	app.use("*", async (c, next) => {
		c.set("user", user as AppVariables["user"]);
		c.set("session", null);
		await next();
	});
	app.route("/files", filesRoutes);
	return app;
}

const authed = () => withSession({ id: USER_ID, email: "ada@example.test" });

function postUploadUrl(app: Hono<{ Variables: AppVariables }>, body: unknown) {
	return app.request("/files/upload-url", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

/**
 * Request validation and authorization only — no S3 is reached, because every
 * case here is rejected before the route presigns anything.
 */
describe("files routes — authentication", () => {
	const anon = () => withSession(null);

	test("401s POST /files/upload-url", async () => {
		const response = await postUploadUrl(anon(), {
			filename: "a.png",
			contentType: "image/png",
			sizeBytes: 10,
		});
		expect(response.status).toBe(401);
	});

	test("401s GET /files", async () => {
		expect((await anon().request("/files")).status).toBe(401);
	});

	test("401s DELETE /files", async () => {
		const response = await anon().request(
			`/files?key=uploads/${USER_ID}/a.png`,
			{ method: "DELETE" },
		);
		expect(response.status).toBe(401);
	});
});

describe("POST /files/upload-url — validation", () => {
	test("400s an unsupported content type", async () => {
		const response = await postUploadUrl(authed(), {
			filename: "evil.exe",
			contentType: "application/x-msdownload",
			sizeBytes: 10,
		});
		expect(response.status).toBe(400);
	});

	test("400s a file over the size cap", async () => {
		const response = await postUploadUrl(authed(), {
			filename: "big.png",
			contentType: "image/png",
			sizeBytes: 25 * 1024 * 1024 + 1,
		});
		expect(response.status).toBe(400);
	});

	test.each([
		[{ contentType: "image/png", sizeBytes: 10 }, "missing filename"],
		[{ filename: "a.png", sizeBytes: 10 }, "missing contentType"],
		[{ filename: "a.png", contentType: "image/png" }, "missing sizeBytes"],
		[
			{ filename: "a.png", contentType: "image/png", sizeBytes: 0 },
			"zero size",
		],
		[
			{ filename: "a.png", contentType: "image/png", sizeBytes: -1 },
			"negative size",
		],
	])("400s on %o (%s)", async (body) => {
		expect((await postUploadUrl(authed(), body)).status).toBe(400);
	});

	test("400s a malformed body", async () => {
		const response = await authed().request("/files/upload-url", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "not json",
		});
		expect(response.status).toBe(400);
	});
});

/**
 * With no files table, `isOwnedBy` is the only thing standing between a caller
 * and someone else's objects — so the route must reject before it enqueues.
 */
describe("DELETE /files — authorization", () => {
	test("403s a key belonging to another user", async () => {
		const response = await authed().request(
			"/files?key=uploads/someone-else/secret.png",
			{ method: "DELETE" },
		);
		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: "Forbidden" });
	});

	test("403s a traversal key", async () => {
		const response = await authed().request(
			`/files?key=uploads/${USER_ID}/../other/a.png`,
			{ method: "DELETE" },
		);
		expect(response.status).toBe(403);
	});

	test("400s when the key is missing entirely", async () => {
		const response = await authed().request("/files", { method: "DELETE" });
		expect(response.status).toBe(400);
	});
});
