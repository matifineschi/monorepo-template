import { Queue } from "bullmq";

import { queueConnectionOptions } from "./connection";
import type { DeleteFileJob, SendWelcomeEmailJob } from "./jobs";
import { QUEUE_NAMES } from "./jobs";

/** Retry policy shared by every queue. Override per-queue only with a reason. */
const defaultJobOptions = {
	attempts: 3,
	backoff: { type: "exponential", delay: 1000 },
	removeOnComplete: { count: 100 },
	removeOnFail: { count: 500 },
} as const;

export function createEmailQueue() {
	return new Queue<SendWelcomeEmailJob>(QUEUE_NAMES.email, {
		...queueConnectionOptions(),
		defaultJobOptions,
	});
}

export function createFileQueue() {
	return new Queue<DeleteFileJob>(QUEUE_NAMES.files, {
		...queueConnectionOptions(),
		defaultJobOptions,
	});
}
