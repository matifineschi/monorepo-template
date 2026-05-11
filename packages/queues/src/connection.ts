import IORedis from "ioredis";

function getRedisUrl(): string {
	const url = process.env.REDIS_URL;
	if (!url) throw new Error("Missing required environment variable: REDIS_URL");
	return url;
}

export function createRedisConnection(): IORedis {
	return new IORedis(getRedisUrl(), {
		maxRetriesPerRequest: null,
	});
}
