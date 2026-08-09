import { QUEUE_NAMES } from "@repo/queues";
import {
	createUploadUrl,
	isOwnedBy,
	listObjects,
	uploadKey,
	userPrefix,
} from "@repo/storage";
import { Hono } from "hono";
import { z } from "zod";
import { fileQueue } from "../lib/queues";
import type { AppVariables } from "../lib/types";

/** Keep in step with any bucket-side policy; the browser PUTs directly. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set([
	"application/json",
	"application/pdf",
	"application/zip",
	"image/avif",
	"image/gif",
	"image/jpeg",
	"image/png",
	"image/svg+xml",
	"image/webp",
	"text/csv",
	"text/markdown",
	"text/plain",
	"video/mp4",
	"video/webm",
]);

const uploadUrlSchema = z.object({
	filename: z.string().min(1).max(255),
	contentType: z.string().refine((value) => ALLOWED_CONTENT_TYPES.has(value), {
		message: "Unsupported content type",
	}),
	sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export const filesRoutes = new Hono<{ Variables: AppVariables }>();

/**
 * Hands the browser a short-lived presigned PUT so bucket credentials never
 * reach the client. The key is derived from the session user — never accepted
 * from the request — which is what keeps one user out of another's objects.
 *
 * Nothing is persisted: this template has no files table on purpose. Return the
 * key to the caller and record it in your own schema if you need to.
 */
filesRoutes.post("/upload-url", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);

	const parsed = uploadUrlSchema.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid request", issues: z.treeifyError(parsed.error) },
			400,
		);
	}

	const key = uploadKey(user.id, parsed.data.filename);
	const { uploadUrl, expiresAt } = await createUploadUrl({
		key,
		contentType: parsed.data.contentType,
	});

	return c.json({ key, uploadUrl, expiresAt: expiresAt.toISOString() });
});

filesRoutes.get("/", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);

	const files = await listObjects(userPrefix(user.id));

	return c.json({
		files: files.map((file) => ({
			key: file.key,
			size: file.size,
			lastModified: file.lastModified?.toISOString() ?? null,
		})),
	});
});

/**
 * Drops the object asynchronously: bucket deletes are slow and fail
 * independently of this request, so the response shouldn't block on one.
 */
filesRoutes.delete("/", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);

	const key = c.req.query("key");
	if (!key) return c.json({ error: "Missing required query parameter: key" }, 400);
	if (!isOwnedBy(key, user.id)) return c.json({ error: "Forbidden" }, 403);

	await fileQueue().add(QUEUE_NAMES.files, { type: "delete-file", key });

	return c.json({ key, status: "deletion-queued" }, 202);
});
