import { env } from "../env";
import { bucketBackup } from "./bucket-backup";
import { bucketBackupCheck } from "./bucket-backup-check";
import { postgresBackup } from "./postgres-backup";
import { postgresRestoreCheck } from "./postgres-restore-check";

export type Job = {
	name: string;
	heartbeatUrl: string | undefined;
	run: () => Promise<unknown>;
};

/**
 * Every job, by the name you pass to main.ts. Scheduling lives on the platform
 * (Railway/Render cron, k8s CronJob, ECS scheduled task), not here.
 *
 * Suggested schedules: postgres-backup and bucket-backup nightly, the two
 * checks weekly, a little after their backup.
 */
export const JOBS: readonly Job[] = [
	{
		heartbeatUrl: env.POSTGRES_BACKUP_HEARTBEAT_URL,
		name: "postgres-backup",
		run: postgresBackup,
	},
	{
		heartbeatUrl: env.POSTGRES_RESTORE_CHECK_HEARTBEAT_URL,
		name: "postgres-restore-check",
		run: postgresRestoreCheck,
	},
	{
		heartbeatUrl: env.BUCKET_BACKUP_HEARTBEAT_URL,
		name: "bucket-backup",
		run: bucketBackup,
	},
	{
		heartbeatUrl: env.BUCKET_BACKUP_CHECK_HEARTBEAT_URL,
		name: "bucket-backup-check",
		run: bucketBackupCheck,
	},
];

export function findJob(name: string): Job | undefined {
	return JOBS.find((job) => job.name === name);
}
