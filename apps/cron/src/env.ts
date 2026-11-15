import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { databaseEnv } from "@repo/db/env";
import { booleanFlag, shouldSkipEnvValidation } from "@repo/env";
import { baseEnv } from "@repo/env/base";
import { loggerEnv } from "@repo/logger/env";

/**
 * Deliberately does not extend `storageEnv`: the backup bucket and the
 * application's bucket use different credentials, so a compromise of one side
 * cannot reach the other.
 */
export const env = createEnv({
	emptyStringAsUndefined: true,
	extends: [baseEnv, databaseEnv, loggerEnv],
	runtimeEnv: process.env,
	server: {
		// Backup bucket. Write-limited credentials, ideally another account.
		BACKUP_S3_ENDPOINT: z.url(),
		BACKUP_S3_REGION: z.string().default("auto"),
		BACKUP_S3_BUCKET: z.string().min(1),
		BACKUP_S3_ACCESS_KEY_ID: z.string().min(1),
		BACKUP_S3_SECRET_ACCESS_KEY: z.string().min(1),
		BACKUP_S3_FORCE_PATH_STYLE: booleanFlag(true),

		// The application's bucket, as the source of the file backup. Read-only.
		SOURCE_S3_ENDPOINT: z.url(),
		SOURCE_S3_REGION: z.string().default("auto"),
		SOURCE_S3_BUCKET: z.string().min(1),
		SOURCE_S3_ACCESS_KEY_ID: z.string().min(1),
		SOURCE_S3_SECRET_ACCESS_KEY: z.string().min(1),
		SOURCE_S3_FORCE_PATH_STYLE: booleanFlag(true),

		// postgres-backup / postgres-restore-check
		POSTGRES_BACKUP_PREFIX: z.string().default("postgres"),
		/**
		 * Server the restore check restores into. Unset means the production
		 * server, which is fine for a small database and a real load on a big
		 * one — point it at a separate instance once restores take minutes.
		 */
		RESTORE_CHECK_DATABASE_URL: z.url().optional(),

		// bucket-backup / bucket-backup-check
		BUCKET_BACKUP_PREFIX: z.string().default("files"),
		/** rclone duration. A run that hits it resumes on the next run. */
		BUCKET_BACKUP_MAX_DURATION: z.string().default("1h"),
		BUCKET_BACKUP_TRANSFERS: z.coerce.number().int().positive().default(8),
		BUCKET_BACKUP_CHECK_SAMPLE_SIZE: z.coerce
			.number()
			.int()
			.positive()
			.default(10),

		/** Local scratch space. postgres-backup needs room for one full dump. */
		WORK_DIR: z.string().optional(),

		/**
		 * Dead-man's switch, one URL per job. Pinged at `/start`, on success, and
		 * at `/fail` (healthchecks.io / Better Stack style).
		 */
		POSTGRES_BACKUP_HEARTBEAT_URL: z.url().optional(),
		POSTGRES_RESTORE_CHECK_HEARTBEAT_URL: z.url().optional(),
		BUCKET_BACKUP_HEARTBEAT_URL: z.url().optional(),
		BUCKET_BACKUP_CHECK_HEARTBEAT_URL: z.url().optional(),
	},
	skipValidation: shouldSkipEnvValidation(),
});
