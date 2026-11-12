import { Worker } from "bullmq";

import { childLogger } from "@repo/logger";
import type { DeleteFileJob } from "@repo/queues";
import { createRedisConnection, QUEUE_NAMES } from "@repo/queues";
import { deleteObject } from "@repo/storage";
import { createError } from "@repo/utils/error";

const log = childLogger({ worker: QUEUE_NAMES.files });

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
			throw createError("Unknown file job type", {
				context: { type: String(_exhaustive) },
			});
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
		log.debug({ jobId: job.id }, "Job completed");
	});

	worker.on("failed", (job, error) => {
		log.error(
			{ jobId: job?.id, attemptsMade: job?.attemptsMade, err: error },
			"Job failed",
		);
	});

	return worker;
}
