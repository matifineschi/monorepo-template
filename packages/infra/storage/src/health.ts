import { HeadBucketCommand } from "@aws-sdk/client-s3";

import { bucket, s3Client } from "./client";

/**
 * Proves the endpoint resolves, the credentials are accepted, and the bucket
 * exists. `HeadBucket` is the only call that checks all three without reading
 * or writing an object.
 */
export async function pingBucket(): Promise<void> {
	await s3Client().send(new HeadBucketCommand({ Bucket: bucket() }));
}
