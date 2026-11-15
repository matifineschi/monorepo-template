import { logger } from "@repo/logger";
import { createError } from "@repo/utils/error";

import { env } from "../env";
import {
	backupPath,
	RCLONE_DURATION_EXCEEDED,
	rclone,
	sourcePath,
} from "../lib/rclone";

export type BucketBackupResult = { complete: boolean };

/**
 * Copies the application's bucket into the backup bucket.
 *
 * `rclone copy`, never `rclone sync`: sync deletes from the destination to
 * match the source, so an accidental or malicious deletion would propagate
 * into the backup. Copy is additive. An overwrite becomes a new version on
 * the backup bucket; a lifecycle rule there expires noncurrent versions after
 * 90 days. That rule is bucket configuration — see docs/backups.md.
 *
 * When rclone hits the time budget (exit 10) the job logs a warning and
 * succeeds. Progress was made and the next run continues.
 */
export async function bucketBackup(): Promise<BucketBackupResult> {
	const copied = await rclone([
		"copy",
		sourcePath(),
		backupPath(env.BUCKET_BACKUP_PREFIX),
		"--transfers",
		String(env.BUCKET_BACKUP_TRANSFERS),
		"--checkers",
		String(env.BUCKET_BACKUP_TRANSFERS * 2),
		"--max-duration",
		env.BUCKET_BACKUP_MAX_DURATION,
		// Let in-flight transfers finish when the budget runs out.
		"--cutoff-mode",
		"soft",
		"--retries",
		"3",
		"--metadata",
		"--stats",
		"30s",
		"--stats-one-line",
	]);

	if (copied.exitCode === RCLONE_DURATION_EXCEEDED) {
		logger.warn(
			{ maxDuration: env.BUCKET_BACKUP_MAX_DURATION },
			"Bucket copy hit its time budget; the next run continues",
		);
		return { complete: false };
	}
	if (copied.exitCode !== 0) {
		throw createError("Bucket copy failed", {
			context: { exitCode: copied.exitCode, stderr: copied.stderr },
		});
	}

	logger.info("Bucket backup complete");
	return { complete: true };
}
