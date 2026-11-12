import { afterAll } from "bun:test";

import { provisionTestBucket } from "./src/testing/bucket";

/**
 * Preloaded by `test:integration` only. Points this run at the test MinIO in
 * docker-compose.test.yml and gives it a bucket of its own — these suites
 * delete every object under a prefix, which must never be the dev bucket.
 */
process.env.STORAGE_ENDPOINT =
	process.env.TEST_STORAGE_ENDPOINT ?? "http://localhost:59002";
process.env.STORAGE_ACCESS_KEY_ID ??= "minioadmin";
process.env.STORAGE_SECRET_ACCESS_KEY ??= "minioadmin";
process.env.STORAGE_REGION ??= "auto";
process.env.STORAGE_FORCE_PATH_STYLE ??= "true";

// Warnings and errors only, so a failing suite still explains itself while the
// passing ones stay quiet. TEST_LOG_LEVEL=info to see every request.
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? "warn";

const bucket = await provisionTestBucket({ label: "storage" });

afterAll(async () => {
	await bucket.drop();
});
