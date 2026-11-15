import { Worker } from "bullmq";

import type { Deliver } from "@repo/features/email";
import { processEmailJob } from "@repo/features/email";
import { childLogger } from "@repo/logger";
import type { SendWelcomeEmailJob } from "@repo/queues";
import { QUEUE_NAMES, queueConnectionOptions } from "@repo/queues";

const log = childLogger({ worker: QUEUE_NAMES.email });

/**
 * BullMQ wiring only. What a job does — render the template, send it through
 * Resend, decide whether a failure is worth a retry — is
 * `processEmailJob` in `@repo/features/email`.
 */
export function startEmailWorker(
	options: { concurrency?: number; deliver?: Deliver } = {},
) {
	const worker = new Worker<SendWelcomeEmailJob>(
		QUEUE_NAMES.email,
		async (job) => processEmailJob(job.data, options.deliver),
		{
			...queueConnectionOptions(),
			concurrency: options.concurrency ?? 5,
		},
	);

	worker.on("completed", (job) => {
		log.debug({ jobId: job.id }, "Job completed");
	});

	worker.on("failed", (job, error) => {
		// `attemptsMade` is the field that distinguishes a transient failure
		// BullMQ will retry from the final one that gives up.
		log.error(
			{ jobId: job?.id, attemptsMade: job?.attemptsMade, err: error },
			"Job failed",
		);
	});

	return worker;
}
