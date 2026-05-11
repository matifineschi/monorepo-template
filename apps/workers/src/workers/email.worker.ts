import { createRedisConnection, QUEUE_NAMES } from "@repo/queues";
import { Worker } from "bullmq";
import type { SendWelcomeEmailJob } from "@repo/queues";

export function startEmailWorker() {
	const worker = new Worker<SendWelcomeEmailJob>(
		QUEUE_NAMES.email,
		async (job) => {
			const { type, userId, email, name } = job.data;

			switch (type) {
				case "send-welcome-email": {
					console.log(`[email-worker] Sending welcome email to ${email} (user: ${userId})`);
					// TODO: plug in your email provider (Resend, Postmark, etc.)
					console.log(`[email-worker] Welcome, ${name}!`);
					break;
				}
				default: {
					const _exhaustive: never = type;
					throw new Error(`Unknown email job type: ${String(_exhaustive)}`);
				}
			}
		},
		{
			connection: createRedisConnection(),
			concurrency: 5,
		},
	);

	worker.on("completed", (job) => {
		console.log(`[email-worker] Job ${job.id} completed`);
	});

	worker.on("failed", (job, err) => {
		console.error(`[email-worker] Job ${job?.id} failed:`, err.message);
	});

	return worker;
}
