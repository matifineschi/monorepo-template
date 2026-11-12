import { afterAll } from "bun:test";

import { provisionTestDatabase } from "@repo/db/testing/database";
import { provisionTestQueuePrefix } from "@repo/queues/testing/prefix";
import { provisionTestBucket } from "@repo/storage/testing/bucket";

/**
 * Preloaded by `test:integration` only — not by bunfig.toml, so `bun test src`
 * still runs with no docker at all.
 *
 * The API's suites touch all three external systems, so this run gets its own
 * database, its own bucket and its own Redis key prefix from the test stack in
 * docker-compose.test.yml. That isolation is what lets the integration suites
 * run in parallel rather than under `--concurrency=1`.
 *
 * Order matters: every provision function sets an env var that a package reads
 * once, at import time. Nothing here may import @repo/db, @repo/storage or
 * @repo/queues themselves — only their `testing/*` subpaths, which deliberately
 * do not touch the packages' own env modules.
 */
process.env.TEST_DATABASE_ADMIN_URL ??=
	"postgres://postgres:postgres@localhost:54322/postgres";
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

const database = await provisionTestDatabase({ label: "api" });
const bucket = await provisionTestBucket({ label: "api" });
const queuePrefix = provisionTestQueuePrefix({ label: "api" });

afterAll(async () => {
	await Promise.all([database.drop(), bucket.drop(), queuePrefix.drop()]);
});
