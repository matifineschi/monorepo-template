import { Worker } from "bullmq";

import type { DeleteFileJob } from "@repo/queues";
import { createRedisConnection, QUEUE_NAMES } from "@repo/queues";
import { deleteObject } from "@repo/storage";

/** Injected so the job body is assertable without a bucket. */
export type ObjectDeleter = (key: string) => Promise<void>;

/**
 * The job body, with no BullMQ or S3 anywhere near it.
 *
 * `deleteObject` is idempotent by contract — BullMQ retries, and a delete that
 * threw because the object was already gone would fail the job permanently.
 */
export async function processFileCleanupJob(
	data: DeleteFileJob,
	remove: ObjectDeleter = deleteObject,
): Promise<void> {
	const { type } = data;

	switch (type) {
		case "delete-file": {
			await remove(data.key);
			break;
		}
		default: {
			const _exhaustive: never = type;
			throw new Error(`Unknown file job type: ${String(_exhaustive)}`);
		}
	}
}

export function startFileCleanupWorker(
	options: { concurrency?: number; remove?: ObjectDeleter } = {},
) {
	const worker = new Worker<DeleteFileJob>(
		QUEUE_NAMES.files,
		async (job) => processFileCleanupJob(job.data, options.remove),
		{
			connection: createRedisConnection(),
			concurrency: options.concurrency ?? 5,
		},
	);

	worker.on("completed", (job) => {
		console.log(`[file-cleanup-worker] Job ${job.id} completed`);
	});

	worker.on("failed", (job, err) => {
		console.error(`[file-cleanup-worker] Job ${job?.id} failed:`, err.message);
	});

	return worker;
}
