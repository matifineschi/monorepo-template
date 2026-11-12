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
			/**
			 * Recent AWS SDK versions send a trailing CRC32 checksum on every
			 * upload by default. Real S3 accepts it; MinIO and several other
			 * S3-compatible services reject it outright, and the error you get
			 * back ("XAmzContentChecksumMismatch", or a bare 400) says nothing
			 * about checksums.
			 *
			 * `WHEN_REQUIRED` keeps checksums for the operations that genuinely
			 * need them and drops them elsewhere. Scoped to a custom endpoint so a
			 * deployment pointing at real S3 keeps the stricter default.
			 */
			...(isCustomEndpoint()
				? {
						requestChecksumCalculation: "WHEN_REQUIRED" as const,
						responseChecksumValidation: "WHEN_REQUIRED" as const,
					}
				: {}),
		});
	}
	return client;
}

/** True unless STORAGE_ENDPOINT points at AWS S3 itself. */
function isCustomEndpoint(): boolean {
	return !/(^|\.)amazonaws\.com$/.test(
		new URL(storageEnv.STORAGE_ENDPOINT).hostname,
	);
}

export function bucket(): string {
	return storageEnv.STORAGE_BUCKET;
}
