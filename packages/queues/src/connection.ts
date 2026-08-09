import IORedis from "ioredis";

import { queuesEnv } from "./env";

export function createRedisConnection(): IORedis {
	return new IORedis(queuesEnv.REDIS_URL, {
		maxRetriesPerRequest: null,
	});
}
