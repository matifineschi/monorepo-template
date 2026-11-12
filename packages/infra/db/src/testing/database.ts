import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { createError } from "@repo/utils/error";

/**
 * Per-run Postgres databases for integration tests.
 *
 * The problem this solves: tests that share one database with the dev stack
 * have to invent their own isolation — run-scoped ids, hand-written cleanup in
 * both `beforeAll` and `afterAll`, and a `--concurrency=1` flag because two
 * suites will otherwise tread on each other. All of that is discipline, which
 * means it decays, and none of it stops a failed run leaving rows behind for
 * the next one to trip over.
 *
 * What happens instead: migrations are applied once into a *template* database
 * named after a fingerprint of the migrations folder, and every run gets its
 * own database cloned from it. `CREATE DATABASE ... TEMPLATE` is a file copy
 * inside Postgres, so a clone costs tens of milliseconds rather than the
 * seconds a fresh migration run would. The template is rebuilt only when a
 * migration changes, because that changes the fingerprint and therefore the
 * name.
 *
 * Deliberately does **not** import `../client`: that module validates env and
 * opens its pool at import time, which would capture the old DATABASE_URL
 * before this has had a chance to point it at the new database.
 */

const migrationsFolder = fileURLToPath(
	new URL("../../migrations", import.meta.url),
);

const IDENTIFIER_PATTERN = /^[a-z0-9_]+$/;
const TEMPLATE_PREFIX = "repo_tmpl_";
const RUN_PREFIX = "repo_test_";
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
/** Postgres truncates identifiers at 63 bytes; a longer name silently collides. */
const MAX_IDENTIFIER_LENGTH = 63;

const DEFAULT_ADMIN_URL =
	"postgres://postgres:postgres@localhost:54322/postgres";

function adminUrl(): string {
	return process.env.TEST_DATABASE_ADMIN_URL ?? DEFAULT_ADMIN_URL;
}

/**
 * Identifiers here are built from a fingerprint and a label, never from
 * anything a test supplies verbatim, but DDL cannot be parameterised — so the
 * check is the only thing between a label and `DROP DATABASE`.
 */
function quoteIdentifier(name: string): string {
	if (!IDENTIFIER_PATTERN.test(name) || name.length > MAX_IDENTIFIER_LENGTH) {
		throw createError("Refusing to use an unsafe database identifier", {
			context: { name },
		});
	}
	return `"${name}"`;
}

function withDatabase(url: string, database: string): string {
	const parsed = new URL(url);
	parsed.pathname = `/${database}`;
	return parsed.toString();
}

function slug(value: string, maxLength: number): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, maxLength);
}

/**
 * A stable digest of every migration file's name and contents.
 *
 * Names alone would not do: editing a migration in place during development is
 * normal, and a template built from the old contents would then be wrong in a
 * way nothing detects.
 */
async function migrationsFingerprint(): Promise<string> {
	const entries = (await readdir(migrationsFolder))
		.filter((name) => name.endsWith(".sql"))
		.sort();

	if (entries.length === 0) {
		throw createError("No migrations found to build a test template from", {
			context: { migrationsFolder },
		});
	}

	const hash = createHash("sha256");
	for (const name of entries) {
		hash.update(name);
		hash.update(await readFile(`${migrationsFolder}/${name}`));
	}

	return hash.digest("hex").slice(0, 16);
}

async function withAdminConnection<T>(
	fn: (sql: postgres.Sql) => Promise<T>,
): Promise<T> {
	const sql = postgres(adminUrl(), {
		max: 1,
		idle_timeout: 0,
		onnotice: () => {},
	});
	try {
		return await fn(sql);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

async function databaseExists(
	sql: postgres.Sql,
	name: string,
): Promise<boolean> {
	const rows = await sql<{ one: number }[]>`
		select 1 as one from pg_database where datname = ${name}
	`;
	return rows.length > 0;
}

/**
 * `WITH (FORCE)` terminates other sessions first. Without it a single leftover
 * connection — an editor's database explorer, a crashed previous run — makes
 * the drop fail and the next run inherit a dirty database.
 */
async function dropDatabase(sql: postgres.Sql, name: string): Promise<void> {
	await sql.unsafe(
		`drop database if exists ${quoteIdentifier(name)} with (force)`,
	);
}

/** Sweeps databases from runs that were killed before their cleanup ran. */
async function dropStaleRunDatabases(sql: postgres.Sql): Promise<void> {
	const rows = await sql<{ datname: string }[]>`
		select datname from pg_database where datname like ${`${RUN_PREFIX}%`}
	`;

	for (const { datname } of rows) {
		// repo_test_<label>_<base36 millis>_<hex>
		const createdAt = Number.parseInt(datname.split("_").at(-2) ?? "", 36);
		if (Number.isFinite(createdAt) && Date.now() - createdAt > STALE_AFTER_MS) {
			await dropDatabase(sql, datname);
		}
	}
}

/**
 * Builds the template under a temporary name and renames it into place, so a
 * run that dies mid-migration leaves a `_building` database rather than a
 * half-migrated template that later runs would clone and trust.
 */
async function ensureTemplateDatabase(templateDb: string): Promise<void> {
	const buildingDb = `${templateDb}_building`;

	await withAdminConnection(async (sql) => {
		// One advisory lock for every process racing to build the same template.
		// Several workspaces run `test:integration` at once and the first one
		// through builds it; the rest wait here and then find it already present.
		//
		// `| 0` narrows the digest to a signed 32-bit int. The driver sends a JS
		// number, so staying inside int4 avoids both a bigint parameter it cannot
		// serialize and a silent precision loss above 2^53.
		const lockKey =
			Number.parseInt(
				createHash("sha256").update(templateDb).digest("hex").slice(0, 8),
				16,
			) | 0;
		await sql`select pg_advisory_lock(${lockKey}::bigint)`;

		try {
			if (await databaseExists(sql, templateDb)) return;

			await dropDatabase(sql, buildingDb);
			await sql.unsafe(`create database ${quoteIdentifier(buildingDb)}`);

			const migrationSql = postgres(withDatabase(adminUrl(), buildingDb), {
				max: 1,
				idle_timeout: 0,
				onnotice: () => {},
			});
			try {
				await migrate(drizzle(migrationSql), { migrationsFolder });
			} finally {
				// Postgres refuses CREATE DATABASE ... TEMPLATE while anything is
				// connected to the template, so this close is load-bearing.
				await migrationSql.end({ timeout: 5 });
			}

			await sql.unsafe(
				`alter database ${quoteIdentifier(buildingDb)} rename to ${quoteIdentifier(templateDb)}`,
			);
		} finally {
			await sql`select pg_advisory_unlock(${lockKey}::bigint)`;
		}
	});
}

export type ProvisionedDatabase = {
	/** Connection string for the database created for this run. */
	url: string;
	name: string;
	/** Drops it. Safe to call twice. */
	drop: () => Promise<void>;
};

/**
 * Creates a database for this test run, points `DATABASE_URL` at it, and
 * returns a handle that drops it.
 *
 * Call it from a preload, before anything imports `@repo/db/client`.
 *
 * @example
 * // test-setup.integration.ts
 * const database = await provisionTestDatabase({ label: "api" });
 * process.on("exit", () => void database.drop());
 */
export async function provisionTestDatabase(
	options: { label?: string } = {},
): Promise<ProvisionedDatabase> {
	const fingerprint = await migrationsFingerprint();
	const templateDb = `${TEMPLATE_PREFIX}${fingerprint}`;

	await ensureTemplateDatabase(templateDb);

	const label = slug(options.label ?? "run", 16) || "run";
	const name = `${RUN_PREFIX}${label}_${Date.now().toString(36)}_${Math.random()
		.toString(16)
		.slice(2, 8)}`;

	await withAdminConnection(async (sql) => {
		await dropStaleRunDatabases(sql);
		await sql.unsafe(
			`create database ${quoteIdentifier(name)} template ${quoteIdentifier(templateDb)}`,
		);
	});

	const url = withDatabase(adminUrl(), name);
	process.env.DATABASE_URL = url;

	let dropped = false;

	return {
		url,
		name,
		drop: async () => {
			if (dropped) return;
			dropped = true;
			await withAdminConnection((sql) => dropDatabase(sql, name));
		},
	};
}
