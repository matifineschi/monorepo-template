import { logger } from "@repo/logger";

import { env } from "./env";
import { startEmailWorker } from "./workers/email.worker";
import { startFileCleanupWorker } from "./workers/file-cleanup.worker";

const workers = [
	startEmailWorker({ concurrency: env.WORKER_CONCURRENCY }),
	startFileCleanupWorker({ concurrency: env.WORKER_CONCURRENCY }),
];

logger.info(
	{
		workers: workers.length,
		concurrency: env.WORKER_CONCURRENCY,
		env: env.NODE_ENV,
	},
	"Workers started",
);

/**
 * Closing each worker lets an in-flight job finish and stops BullMQ claiming
 * another. Without it a deploy's SIGTERM kills a job mid-flight; BullMQ only
 * returns it to the queue once its lock expires, so the work stalls for the
 * lock duration instead of being retried immediately.
 */
let shuttingDown = false;

async function shutdown(signal: string) {
	if (shuttingDown) return;
	shuttingDown = true;

	logger.info({ signal }, "Workers shutting down");
	await Promise.all(workers.map((worker) => worker.close()));
	process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
