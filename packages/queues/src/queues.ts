import { Queue } from "bullmq";
import { createRedisConnection } from "./connection";
import type { SendWelcomeEmailJob } from "./jobs";
import { QUEUE_NAMES } from "./jobs";

export function createEmailQueue() {
	return new Queue<SendWelcomeEmailJob>(QUEUE_NAMES.email, {
		connection: createRedisConnection(),
		defaultJobOptions: {
			attempts: 3,
			backoff: { type: "exponential", delay: 1000 },
			removeOnComplete: { count: 100 },
			removeOnFail: { count: 500 },
		},
	});
}
