import { afterAll } from "bun:test";

import { provisionTestDatabase } from "@repo/db/testing/database";
import { provisionTestQueuePrefix } from "@repo/queues/testing/prefix";

/**
 * Preloaded by `test:integration` only — not by bunfig.toml, so `bun test src`
 * still runs with no docker at all.
 *
 * Points this run at the test stack in docker-compose.test.yml with a database
 * and a Redis key prefix of its own. Nothing here may import a feature or
 * @repo/db / @repo/queues themselves: each reads its env once, at import time,
 * and that must happen after the provisioning below has set it.
 */
process.env.TEST_DATABASE_ADMIN_URL ??=
	"postgres://postgres:postgres@localhost:54322/postgres";
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:63792";

// Warnings and errors only, so a failing suite still explains itself while the
// passing ones stay quiet. TEST_LOG_LEVEL=info to see every request.
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? "warn";

const database = await provisionTestDatabase({ label: "features" });
const queuePrefix = provisionTestQueuePrefix({ label: "features" });

afterAll(async () => {
	await Promise.all([database.drop(), queuePrefix.drop()]);
});
