import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { logger } from "@repo/logger";
import { createError } from "@repo/utils/error";

import { env } from "../env";
import { execOrThrow } from "../lib/exec";
import { pgEnv } from "../lib/postgres";
import { backupPath, rcloneOrThrow } from "../lib/rclone";

/**
 * A custom-format dump is a few KB even for an empty database. Smaller means
 * pg_dump produced nothing useful — which it can do while exiting 0, e.g. when
 * the role could read no schemas.
 */
const MIN_PLAUSIBLE_DUMP_BYTES = 1024;

/** `postgres/2026/11/15/2026-11-15T03-00-00-000Z.dump` — sorts chronologically. */
export function postgresBackupKey(
	at: Date,
	prefix = env.POSTGRES_BACKUP_PREFIX,
): string {
	const iso = at.toISOString();
	const [year, month, day] = iso.slice(0, 10).split("-");
	return `${prefix}/${year}/${month}/${day}/${iso.replace(/[:.]/g, "-")}.dump`;
}

/**
 * pg_dump → local file → check → upload.
 *
 * Dumping to a file first (rather than streaming into the upload) is what
 * guarantees a failed pg_dump never reaches the bucket: nothing is uploaded
 * until pg_dump has exited 0 and pg_restore can read the archive back.
 *
 * Needs WORK_DIR (or the OS temp dir) to have room for one compressed dump.
 */
export async function postgresBackup(): Promise<{ key: string; size: number }> {
	const key = postgresBackupKey(new Date());
	const directory = await mkdtemp(
		join(env.WORK_DIR ?? tmpdir(), "postgres-backup-"),
	);
	const file = join(directory, "backup.dump");

	try {
		// --no-owner/--no-privileges: restorable into a database owned by any role,
		// which is what the restore check and a real recovery both do.
		await execOrThrow(
			"pg_dump",
			["--format=custom", "--no-owner", "--no-privileges", "--file", file],
			{ env: pgEnv(env.DATABASE_URL) },
		);

		const { size } = await stat(file);
		if (size < MIN_PLAUSIBLE_DUMP_BYTES) {
			throw createError("Dump is implausibly small", {
				context: { minimum: MIN_PLAUSIBLE_DUMP_BYTES, size },
			});
		}

		// Reads the archive's table of contents: catches a corrupt or truncated file.
		await execOrThrow("pg_restore", ["--list", file]);

		await rcloneOrThrow(["copyto", file, backupPath(key)]);

		logger.info({ key, size }, "Postgres backup stored");
		return { key, size };
	} finally {
		await rm(directory, { force: true, recursive: true });
	}
}
