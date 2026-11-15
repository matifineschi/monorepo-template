import { Hono } from "hono";
import { z } from "zod";

import {
	createUserUploadUrl,
	listUserFiles,
	requestFileDeletion,
	uploadUrlSchema,
} from "@repo/features/files";

import type { AppVariables } from "../lib/types";

/**
 * HTTP for `@repo/features/files`: session check, request parsing, status
 * codes. Key derivation and the ownership check live in the feature, so no
 * route can reach storage with a key the user doesn't own.
 */
export const filesRoutes = new Hono<{ Variables: AppVariables }>();

filesRoutes.post("/upload-url", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);

	const parsed = uploadUrlSchema.safeParse(
		await c.req.json().catch(() => null),
	);
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid request", issues: z.treeifyError(parsed.error) },
			400,
		);
	}

	const { key, uploadUrl, expiresAt } = await createUserUploadUrl(
		user.id,
		parsed.data,
	);

	return c.json({ key, uploadUrl, expiresAt: expiresAt.toISOString() });
});

filesRoutes.get("/", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);

	const files = await listUserFiles(user.id);

	return c.json({
		files: files.map((file) => ({
			key: file.key,
			size: file.size,
			lastModified: file.lastModified?.toISOString() ?? null,
		})),
	});
});

filesRoutes.delete("/", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);

	const key = c.req.query("key");
	if (!key)
		return c.json({ error: "Missing required query parameter: key" }, 400);

	const queued = await requestFileDeletion(user.id, key);
	if (!queued.ok) return c.json({ error: "Forbidden" }, 403);

	return c.json({ key, status: "deletion-queued" }, 202);
});
