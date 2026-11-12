import { Worker } from "bullmq";

import { childLogger } from "@repo/logger";
import type { SendWelcomeEmailJob } from "@repo/queues";
import { QUEUE_NAMES, queueConnectionOptions } from "@repo/queues";
import { createError } from "@repo/utils/error";

const log = childLogger({ worker: QUEUE_NAMES.email });

/**
 * Swap this for Resend / Postmark / SES. It is injected rather than imported so
 * the job body stays assertable in a test without a mail provider.
 */
export type EmailSender = (message: {
	to: string;
	subject: string;
	body: string;
}) => Promise<void>;

const loggingEmailSender: EmailSender = async (message) => {
	log.info({ to: message.to, subject: message.subject }, "Email would be sent");
};

/** The job body, with no BullMQ or Redis anywhere near it. */
export async function processEmailJob(
	data: SendWelcomeEmailJob,
	send: EmailSender = loggingEmailSender,
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
			throw createError("Unknown email job type", {
				context: { type: String(_exhaustive) },
			});
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
