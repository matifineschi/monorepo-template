import IORedis from "ioredis";

import { queuesEnv } from "./env";

export function createRedisConnection(): IORedis {
	return new IORedis(queuesEnv.REDIS_URL, {
		// BullMQ requires this: its blocking commands must not be retried by the
		// client, because BullMQ does its own retry accounting.
		maxRetriesPerRequest: null,
	});
}

/**
 * The options a `Queue` and its `Worker` must agree on.
 *
 * They are a single export because a queue and a worker that disagree about the
 * prefix do not error — they just quietly use different Redis keys, and the
 * worker waits forever for jobs nobody is putting where it is looking.
 */
export function queueConnectionOptions(): {
	connection: IORedis;
	prefix: string;
} {
	return {
		connection: createRedisConnection(),
		prefix: queuesEnv.QUEUE_PREFIX,
	};
}
