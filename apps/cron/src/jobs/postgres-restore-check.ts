import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { logger } from "@repo/logger";
import { createError } from "@repo/utils/error";

import { env } from "../env";
import { execOrThrow } from "../lib/exec";
import { connect, pgEnv, withDatabase } from "../lib/postgres";
import { backupPath, listBackupObjects, rcloneOrThrow } from "../lib/rclone";

/**
 * Restores the newest dump into a throwaway database and checks it is real.
 *
 * A dump nobody has restored is a file, not a backup: truncation, a role that
 * could not read the schema, or client/server version skew all leave a
 * plausible-looking object in the bucket and only show up on restore.
 *
 * Restores into RESTORE_CHECK_DATABASE_URL's server when set, otherwise the
 * production server. The connecting role needs CREATEDB there.
 */

const STALE_AFTER_HOURS = 48;
const SCRATCH_PREFIX = "restore_check_";

export async function postgresRestoreCheck(): Promise<{
	key: string;
	tables: number;
}> {
	const [newest] = await listBackupObjects(env.POSTGRES_BACKUP_PREFIX);
	if (!newest) {
		throw createError("No backup found to check", {
			context: { prefix: env.POSTGRES_BACKUP_PREFIX },
		});
	}

	const ageHours = (Date.now() - newest.modTime.getTime()) / 3_600_000;
	if (ageHours > STALE_AFTER_HOURS) {
		throw createError("Newest backup is stale", {
			context: { ageHours: Math.round(ageHours), key: newest.path },
		});
	}

	if (!env.RESTORE_CHECK_DATABASE_URL) {
		logger.info(
			"RESTORE_CHECK_DATABASE_URL is unset; restoring into the production server",
		);
	}
	const targetServer = env.RESTORE_CHECK_DATABASE_URL ?? env.DATABASE_URL;
	const scratchDb = `${SCRATCH_PREFIX}${Date.now().toString(36)}`;
	const directory = await mkdtemp(
		join(env.WORK_DIR ?? tmpdir(), "postgres-restore-check-"),
	);
	const file = join(directory, "backup.dump");
	const admin = connect(withDatabase(targetServer, "postgres"));

	try {
		await rcloneOrThrow(["copyto", backupPath(newest.path), file]);

		// scratchDb is generated above from a fixed prefix and base36 digits.
		await admin.unsafe(`create database "${scratchDb}"`);

		// --dbname takes the name only; the connection comes from PG* env vars.
		await execOrThrow(
			"pg_restore",
			["--no-owner", "--no-privileges", "--dbname", scratchDb, file],
			{ env: pgEnv(withDatabase(targetServer, scratchDb)) },
		);

		const [restored, live] = await Promise.all([
			tableNames(withDatabase(targetServer, scratchDb)),
			tableNames(env.DATABASE_URL),
		]);

		if (restored.size === 0) {
			throw createError("Restored database contains no tables", {
				context: { key: newest.path },
			});
		}

		// Production having tables the dump lacks is normal (a migration ran after
		// the dump). The reverse is drift worth a look, but not a failure.
		const onlyInBackup = [...restored].filter((name) => !live.has(name));
		if (onlyInBackup.length > 0) {
			logger.warn(
				{ key: newest.path, tables: onlyInBackup },
				"Backup has tables production does not",
			);
		}

		logger.info(
			{
				ageHours: Math.round(ageHours),
				key: newest.path,
				tables: restored.size,
			},
			"Restore check passed",
		);
		return { key: newest.path, tables: restored.size };
	} finally {
		await admin
			.unsafe(`drop database if exists "${scratchDb}" with (force)`)
			.catch((error: unknown) =>
				logger.error(
					{ err: error, scratchDb },
					"Failed to drop scratch database",
				),
			);
		await admin.end({ timeout: 5 });
		await rm(directory, { force: true, recursive: true });
	}
}

async function tableNames(url: string): Promise<Set<string>> {
	const sql = connect(url);
	try {
		const rows = await sql<{ name: string }[]>`
			select table_schema || '.' || table_name as name
			from information_schema.tables
			where table_schema not in ('pg_catalog', 'information_schema')
				and table_type = 'BASE TABLE'
		`;
		return new Set(rows.map((row) => row.name));
	} finally {
		await sql.end({ timeout: 5 });
	}
}
