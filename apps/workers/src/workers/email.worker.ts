import type { SendWelcomeEmailJob } from "@repo/queues";
import { createRedisConnection, QUEUE_NAMES } from "@repo/queues";
import { Worker } from "bullmq";

/**
 * Swap this for Resend / Postmark / SES. It is injected rather than imported so
 * the job body stays assertable in a test without a mail provider.
 */
export type EmailSender = (message: {
	to: string;
	subject: string;
	body: string;
}) => Promise<void>;

const consoleEmailSender: EmailSender = async (message) => {
	console.log(`[email-worker] -> ${message.to}: ${message.subject}`);
};

/** The job body, with no BullMQ or Redis anywhere near it. */
export async function processEmailJob(
	data: SendWelcomeEmailJob,
	send: EmailSender = consoleEmailSender,
): Promise<void> {
	const { type } = data;

	switch (type) {
		case "send-welcome-email": {
			await send({
				to: data.email,
				subject: "Welcome!",
				body: `Welcome, ${data.name}! (user: ${data.userId})`,
			});
			break;
		}
		default: {
			const _exhaustive: never = type;
			throw new Error(`Unknown email job type: ${String(_exhaustive)}`);
		}
	}
}

export function startEmailWorker(
	options: { concurrency?: number; send?: EmailSender } = {},
) {
	const worker = new Worker<SendWelcomeEmailJob>(
		QUEUE_NAMES.email,
		async (job) => processEmailJob(job.data, options.send),
		{
			connection: createRedisConnection(),
			concurrency: options.concurrency ?? 5,
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
