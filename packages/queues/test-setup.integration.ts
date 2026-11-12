import { afterAll } from "bun:test";

import { provisionTestQueuePrefix } from "./src/testing/prefix";

/**
 * Preloaded by `test:integration` only. Points this run at the test Redis in
 * docker-compose.test.yml under a key prefix of its own, so `obliterate` here
 * can never reach a queue the dev stack is serving.
 */
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:63792";

// Warnings and errors only, so a failing suite still explains itself while the
// passing ones stay quiet. TEST_LOG_LEVEL=info to see every request.
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? "warn";

const queuePrefix = provisionTestQueuePrefix({ label: "queues" });

afterAll(async () => {
	await queuePrefix.drop();
});
