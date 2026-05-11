import { startEmailWorker } from "./workers/email.worker";

const workers = [startEmailWorker()];

console.log(`[workers] Started ${workers.length} workers`);

async function shutdown() {
	console.log("[workers] Shutting down...");
	await Promise.all(workers.map((w) => w.close()));
	process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
