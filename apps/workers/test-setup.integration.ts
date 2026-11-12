import { afterAll } from "bun:test";

import { provisionTestQueuePrefix } from "@repo/queues/testing/prefix";
import { provisionTestBucket } from "@repo/storage/testing/bucket";

/**
 * Preloaded by `test:integration` only. The workers consume from Redis and
 * delete from the bucket, so this run gets its own of each from the test stack
 * in docker-compose.test.yml.
 *
 * No database: apps/workers composes queue and storage env only, and a worker
 * that needed the database would be a sign the job body had grown a dependency
 * its `processXJob(data, deps)` signature should be injecting instead.
 */
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:63792";
process.env.STORAGE_ENDPOINT =
	process.env.TEST_STORAGE_ENDPOINT ?? "http://localhost:59002";
process.env.STORAGE_ACCESS_KEY_ID ??= "minioadmin";
process.env.STORAGE_SECRET_ACCESS_KEY ??= "minioadmin";
process.env.STORAGE_REGION ??= "auto";
process.env.STORAGE_FORCE_PATH_STYLE ??= "true";

// Warnings and errors only, so a failing suite still explains itself while the
// passing ones stay quiet. TEST_LOG_LEVEL=info to see every request.
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? "warn";

const bucket = await provisionTestBucket({ label: "workers" });
const queuePrefix = provisionTestQueuePrefix({ label: "workers" });

afterAll(async () => {
	await Promise.all([bucket.drop(), queuePrefix.drop()]);
});
