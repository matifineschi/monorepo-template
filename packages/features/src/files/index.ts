import { z } from "zod";

import type { DeleteFileJob } from "@repo/queues";
import { QUEUE_NAMES } from "@repo/queues";
import { createUploadUrl, deleteObject, listObjects } from "@repo/storage";
import { createError } from "@repo/utils/error";
import { err, ok, type Result } from "@repo/utils/result";

import { fileQueue } from "../shared/queues";
import { isOwnedBy, uploadKey, userPrefix } from "./keys";

/**
 * Files a user uploads straight to the bucket.
 *
 * There is no files table on purpose: the key prefix `uploads/<userId>/` *is*
 * the ownership record (see `./keys`), so every function here takes the user
 * id from the session and derives or checks keys against it. Never pass a
 * client-supplied key to storage without going through `isOwnedBy`.
 */

/** Keep in step with any bucket-side policy; the browser PUTs directly. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_CONTENT_TYPES: ReadonlySet<string> = new Set([
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

export const uploadUrlSchema = z.object({
	filename: z.string().min(1).max(255),
	contentType: z.string().refine((value) => ALLOWED_CONTENT_TYPES.has(value), {
		message: "Unsupported content type",
	}),
	sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export type UploadUrlRequest = z.output<typeof uploadUrlSchema>;

/**
 * A short-lived presigned PUT, so bucket credentials never reach the client.
 * Nothing is persisted: return the key to the caller and record it in your
 * own schema if you need to.
 */
export async function createUserUploadUrl(
	userId: string,
	request: UploadUrlRequest,
): Promise<{ key: string; uploadUrl: string; expiresAt: Date }> {
	const key = uploadKey(userId, request.filename);
	const { uploadUrl, expiresAt } = await createUploadUrl({
		key,
		contentType: request.contentType,
	});
	return { key, uploadUrl, expiresAt };
}

export type UserFile = {
	key: string;
	size: number;
	lastModified: Date | undefined;
};

export async function listUserFiles(userId: string): Promise<UserFile[]> {
	const objects = await listObjects(userPrefix(userId));
	return objects.map((object) => ({
		key: object.key,
		size: object.size,
		lastModified: object.lastModified,
	}));
}

/**
 * Queues the object for deletion rather than deleting it inline: bucket
 * deletes are slow and fail independently of the request, so the caller
 * shouldn't block on one. `apps/workers` runs `processFileJob`.
 */
export async function requestFileDeletion(
	userId: string,
	key: string,
): Promise<Result<{ key: string }, "forbidden">> {
	if (!isOwnedBy(key, userId)) return err("forbidden");

	await fileQueue().add(QUEUE_NAMES.files, { type: "delete-file", key });
	return ok({ key });
}

/** Injected so the job body is assertable without a bucket. */
export type ObjectDeleter = (key: string) => Promise<void>;

/**
 * The file queue's job body, with no BullMQ or S3 anywhere near it.
 *
 * `deleteObject` is idempotent by contract — BullMQ retries, and a delete that
 * threw because the object was already gone would fail the job permanently.
 */
export async function processFileJob(
	data: DeleteFileJob,
	remove: ObjectDeleter = deleteObject,
): Promise<void> {
	const { type } = data;

	switch (type) {
		case "delete-file": {
			await remove(data.key);
			break;
		}
		default: {
			const _exhaustive: never = type;
			throw createError("Unknown file job type", {
				context: { type: String(_exhaustive) },
			});
		}
	}
}
