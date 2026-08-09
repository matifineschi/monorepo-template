import { env } from "./env";
import { startEmailWorker } from "./workers/email.worker";
import { startFileCleanupWorker } from "./workers/file-cleanup.worker";

const workers = [
	startEmailWorker({ concurrency: env.WORKER_CONCURRENCY }),
	startFileCleanupWorker({ concurrency: env.WORKER_CONCURRENCY }),
];

console.log(`[workers] Started ${workers.length} workers (${env.NODE_ENV})`);

async function shutdown() {
	console.log("[workers] Shutting down...");
	await Promise.all(workers.map((w) => w.close()));
	process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
