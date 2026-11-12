import { afterAll } from "bun:test";

import { provisionTestDatabase } from "./src/testing/database";

/**
 * Preloaded by `test:integration` only — not by bunfig.toml, so `bun test src`
 * still runs with no docker at all.
 *
 * Points this run at the test stack in docker-compose.test.yml (never the dev
 * stack: these suites drop databases) and gives it a database of its own,
 * cloned from the migrated template. See src/testing/database.ts for why.
 */
process.env.TEST_DATABASE_ADMIN_URL ??=
	"postgres://postgres:postgres@localhost:54322/postgres";

// Warnings and errors only, so a failing suite still explains itself while the
// passing ones stay quiet. TEST_LOG_LEVEL=info to see every request.
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? "warn";

const database = await provisionTestDatabase({ label: "db" });

afterAll(async () => {
	await database.drop();
});
