import {
	CreateBucketCommand,
	DeleteBucketCommand,
	DeleteObjectsCommand,
	ListObjectsV2Command,
	S3Client,
} from "@aws-sdk/client-s3";

import { createError } from "@repo/utils/error";

/**
 * A bucket of its own for each integration test run.
 *
 * Nothing truncates a bucket between runs the way a database can be dropped,
 * so a shared bucket only ever grows: every leaked object from every failed run
 * stays until somebody notices. Worse, two suites listing the same prefix at
 * once see each other's objects, which is why the shared-bucket version of this
 * needed `--concurrency=1`.
 *
 * Deliberately does not import `../env` or `../client`. Both capture the parsed
 * env at import time, so touching them here would freeze `STORAGE_BUCKET` at
 * whatever it was before this function pointed it somewhere else.
 */

const BUCKET_PREFIX = "test-";
/** S3 bucket names: 3-63 chars, lowercase alphanumerics and hyphens. */
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
/** DeleteObjects takes at most 1000 keys per request. */
const DELETE_BATCH_SIZE = 1000;

function requiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw createError("Missing storage env for the test bucket", {
			context: { name },
		});
	}
	return value;
}

function testClient(): S3Client {
	return new S3Client({
		endpoint: requiredEnv("STORAGE_ENDPOINT"),
		region: process.env.STORAGE_REGION ?? "auto",
		forcePathStyle: true,
		credentials: {
			accessKeyId: requiredEnv("STORAGE_ACCESS_KEY_ID"),
			secretAccessKey: requiredEnv("STORAGE_SECRET_ACCESS_KEY"),
		},
		// MinIO rejects the SDK's default trailing CRC32 checksums on several
		// operations. Keep this in step with ../client.ts.
		requestChecksumCalculation: "WHEN_REQUIRED",
		responseChecksumValidation: "WHEN_REQUIRED",
	});
}

function slug(value: string, maxLength: number): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, maxLength);
}

async function emptyBucket(client: S3Client, bucket: string): Promise<void> {
	let continuationToken: string | undefined;

	do {
		const page = await client.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				ContinuationToken: continuationToken,
			}),
		);

		const keys = (page.Contents ?? [])
			.map((object) => object.Key)
			.filter((key): key is string => Boolean(key));

		for (let index = 0; index < keys.length; index += DELETE_BATCH_SIZE) {
			const batch = keys.slice(index, index + DELETE_BATCH_SIZE);
			await client.send(
				new DeleteObjectsCommand({
					Bucket: bucket,
					Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
				}),
			);
		}

		continuationToken = page.IsTruncated
			? page.NextContinuationToken
			: undefined;
	} while (continuationToken);
}

export type ProvisionedBucket = {
	name: string;
	/** Empties and removes it. Safe to call twice. */
	drop: () => Promise<void>;
};

/**
 * Creates a bucket for this run and points `STORAGE_BUCKET` at it.
 *
 * Call it from a preload, before anything imports `@repo/storage`.
 *
 * @example
 * // test-setup.integration.ts
 * const bucket = await provisionTestBucket({ label: "api" });
 * process.on("exit", () => void bucket.drop());
 */
export async function provisionTestBucket(
	options: { label?: string } = {},
): Promise<ProvisionedBucket> {
	const label = slug(options.label ?? "run", 16) || "run";
	const name = `${BUCKET_PREFIX}${label}-${Date.now().toString(36)}-${Math.random()
		.toString(16)
		.slice(2, 8)}`;

	if (!BUCKET_PATTERN.test(name)) {
		throw createError("Generated an invalid test bucket name", {
			context: { name },
		});
	}

	const client = testClient();
	await client.send(new CreateBucketCommand({ Bucket: name }));
	process.env.STORAGE_BUCKET = name;

	let dropped = false;

	return {
		name,
		drop: async () => {
			if (dropped) return;
			dropped = true;
			// A bucket must be empty before it can be removed.
			await emptyBucket(client, name);
			await client.send(new DeleteBucketCommand({ Bucket: name }));
			client.destroy();
		},
	};
}
