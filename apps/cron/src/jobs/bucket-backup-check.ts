import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { logger } from "@repo/logger";
import { createError } from "@repo/utils/error";

import { env } from "../env";
import { backupPath, rclone, rcloneOrThrow, sourcePath } from "../lib/rclone";
import { createReservoir, isFilesFromSafe } from "../lib/sample";

/**
 * Samples objects from the source and compares the backup copies byte for
 * byte. A copy at the right size can still be wrong; only re-reading content
 * tells you. A sample, not everything: a full re-read would cost more than
 * the backup. A confidence check, not a proof.
 */
export async function bucketBackupCheck(): Promise<{
	checked: number;
	objects: number;
}> {
	const reservoir = createReservoir<string>(
		env.BUCKET_BACKUP_CHECK_SAMPLE_SIZE,
	);
	let unexpressible = 0;
	await rcloneOrThrow(["lsf", sourcePath(), "--recursive", "--files-only"], {
		onStdoutLine: (line) => {
			const path = line.trim();
			if (!path) return;
			if (!isFilesFromSafe(path)) {
				unexpressible += 1;
				return;
			}
			reservoir.offer(path);
		},
	});

	if (unexpressible > 0) {
		// Loud, because it means the check's coverage is smaller than it looks.
		logger.warn(
			{ paths: unexpressible },
			"Some source paths cannot be expressed in --files-from and were left unchecked",
		);
	}

	if (reservoir.seen === 0) {
		logger.warn("Source bucket has no objects — nothing to check");
		return { checked: 0, objects: 0 };
	}

	const directory = await mkdtemp(
		join(env.WORK_DIR ?? tmpdir(), "bucket-backup-check-"),
	);
	try {
		const sampleFile = join(directory, "sample.txt");
		await writeFile(sampleFile, `${reservoir.sample.join("\n")}\n`, "utf8");

		const checked = await rclone([
			"check",
			sourcePath(),
			backupPath(env.BUCKET_BACKUP_PREFIX),
			// The backup legitimately holds objects the source has since deleted.
			"--one-way",
			// Compare content, not size and modtime.
			"--download",
			"--files-from",
			sampleFile,
		]);

		// Exit 1 means "differences found": the backup is not trustworthy.
		if (checked.exitCode !== 0) {
			throw createError("Backup does not match the source", {
				context: {
					exitCode: checked.exitCode,
					sampled: reservoir.sample.length,
					stderr: checked.stderr,
				},
			});
		}

		logger.info(
			{ checked: reservoir.sample.length, objects: reservoir.seen },
			"Bucket backup check passed",
		);
		return {
			checked: reservoir.sample.length,
			objects: reservoir.seen,
		};
	} finally {
		await rm(directory, { force: true, recursive: true });
	}
}
