import {
	DeleteObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { bucket, s3Client } from "./client";

export type StoredObject = {
	key: string;
	size: number;
	lastModified: Date | undefined;
};

export async function putObject(
	key: string,
	body: Uint8Array,
	contentType: string,
): Promise<void> {
	await s3Client().send(
		new PutObjectCommand({
			Bucket: bucket(),
			Key: key,
			Body: body,
			ContentType: contentType,
		}),
	);
}

export async function getObject(
	key: string,
): Promise<{ body: Uint8Array; contentType: string | undefined }> {
	const result = await s3Client().send(
		new GetObjectCommand({ Bucket: bucket(), Key: key }),
	);
	const body = await result.Body?.transformToByteArray();
	if (!body) throw new Error(`Object has no body: ${key}`);
	return { body, contentType: result.ContentType };
}

/** Lists everything under `prefix`. Callers must pass a user-scoped prefix. */
export async function listObjects(prefix: string): Promise<StoredObject[]> {
	const objects: StoredObject[] = [];
	let continuationToken: string | undefined;

	// S3 caps a page at 1000 keys and signals more via IsTruncated.
	do {
		const page = await s3Client().send(
			new ListObjectsV2Command({
				Bucket: bucket(),
				Prefix: prefix,
				ContinuationToken: continuationToken,
			}),
		);

		for (const item of page.Contents ?? []) {
			if (!item.Key) continue;
			objects.push({
				key: item.Key,
				size: item.Size ?? 0,
				lastModified: item.LastModified,
			});
		}

		continuationToken = page.IsTruncated
			? page.NextContinuationToken
			: undefined;
	} while (continuationToken);

	return objects;
}

/**
 * Idempotent by contract. BullMQ retries jobs, so a delete that throws because
 * the object is already gone turns one transient failure into a permanent one.
 */
export async function deleteObject(key: string): Promise<void> {
	try {
		await s3Client().send(
			new DeleteObjectCommand({ Bucket: bucket(), Key: key }),
		);
	} catch (error) {
		if (isNotFound(error)) return;
		throw error;
	}
}

/**
 * Presigned PUT URL the browser uploads to directly, so bucket credentials
 * never leave the server. The URL embeds STORAGE_ENDPOINT — a URL signed
 * against `localhost:9000` only works from the host.
 */
export async function createUploadUrl(options: {
	key: string;
	contentType: string;
	expiresInSeconds?: number;
}): Promise<{ uploadUrl: string; expiresAt: Date }> {
	const expiresIn = options.expiresInSeconds ?? 300;
	const uploadUrl = await getSignedUrl(
		s3Client(),
		new PutObjectCommand({
			Bucket: bucket(),
			Key: options.key,
			ContentType: options.contentType,
		}),
		{ expiresIn },
	);

	return { uploadUrl, expiresAt: new Date(Date.now() + expiresIn * 1000) };
}

function isNotFound(error: unknown): boolean {
	if (error instanceof S3ServiceException) {
		return (
			error.name === "NoSuchKey" ||
			error.name === "NotFound" ||
			error.$metadata.httpStatusCode === 404
		);
	}
	return false;
}
