import { Worker } from "bullmq";

import type { ObjectDeleter } from "@repo/features/files";
import { processFileJob } from "@repo/features/files";
import { childLogger } from "@repo/logger";
import type { DeleteFileJob } from "@repo/queues";
import { QUEUE_NAMES, queueConnectionOptions } from "@repo/queues";

const log = childLogger({ worker: QUEUE_NAMES.files });

/** BullMQ wiring only; the job body is `processFileJob` in `@repo/features/files`. */
export function startFileCleanupWorker(
	options: { concurrency?: number; remove?: ObjectDeleter } = {},
) {
	const worker = new Worker<DeleteFileJob>(
		QUEUE_NAMES.files,
		async (job) => processFileJob(job.data, options.remove),
		{
			...queueConnectionOptions(),
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
