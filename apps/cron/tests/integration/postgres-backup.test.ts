import { describe, expect, test } from "bun:test";

import postgres from "postgres";

import { postgresBackup } from "../../src/jobs/postgres-backup";
import { postgresRestoreCheck } from "../../src/jobs/postgres-restore-check";
import { listBackupObjects } from "../../src/lib/rclone";

/**
 * Round trip against the test stack: dump a real migrated database to a real
 * bucket, restore it into a throwaway database, check the schema.
 *
 * Needs pg_dump/pg_restore (server's major version) and rclone on PATH.
 */
const toolsAvailable =
	Bun.which("pg_dump") !== null && Bun.which("rclone") !== null;

if (!toolsAvailable) {
	// A skip exits 0. On a laptop that is a missing tool; in CI it would be a
	// green run of the only test that dumps and restores a real database.
	const message =
		"postgres backup integration tests need pg_dump and rclone on PATH";
	if (process.env.CI) throw new Error(message);
	console.warn(`\n  SKIPPING ${message}.\n`);
}

describe.skipIf(!toolsAvailable)("postgres backup round trip", () => {
	test("stores a plausibly sized dump", async () => {
		const { key, size } = await postgresBackup();

		expect(key).toMatch(/^postgres\/\d{4}\/\d{2}\/\d{2}\/.*\.dump$/);
		expect(size).toBeGreaterThan(1024);

		const stored = await listBackupObjects("postgres");
		expect(stored.map((object) => object.path)).toContain(key);
	});

	test("the newest dump restores with the production schema", async () => {
		const { key, tables } = await postgresRestoreCheck();

		expect(key).toMatch(/\.dump$/);
		// public.users plus the user_auth tables.
		expect(tables).toBeGreaterThanOrEqual(2);
	});

	test("leaves no scratch database behind", async () => {
		const sql = postgres(
			process.env.TEST_DATABASE_ADMIN_URL ??
				"postgres://postgres:postgres@localhost:54322/postgres",
			{ max: 1, onnotice: () => {} },
		);
		try {
			const rows = await sql<{ datname: string }[]>`
				select datname from pg_database where datname like 'restore_check_%'
			`;
			expect(rows.map((row) => row.datname)).toEqual([]);
		} finally {
			await sql.end({ timeout: 5 });
		}
	});
});
