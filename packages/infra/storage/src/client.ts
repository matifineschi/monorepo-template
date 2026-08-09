import { S3Client } from "@aws-sdk/client-s3";

import { storageEnv } from "./env";

/**
 * Lazy singleton. Constructing the client eagerly would run at import time —
 * including during typecheck and unit-test module loading, where no bucket
 * exists and no credentials are configured.
 */
let client: S3Client | null = null;

export function s3Client(): S3Client {
	if (!client) {
		client = new S3Client({
			endpoint: storageEnv.STORAGE_ENDPOINT,
			region: storageEnv.STORAGE_REGION,
			forcePathStyle: storageEnv.STORAGE_FORCE_PATH_STYLE,
			credentials: {
				accessKeyId: storageEnv.STORAGE_ACCESS_KEY_ID,
				secretAccessKey: storageEnv.STORAGE_SECRET_ACCESS_KEY,
			},
		});
	}
	return client;
}

export function bucket(): string {
	return storageEnv.STORAGE_BUCKET;
}
