import IORedis from "ioredis";

import { queuesEnv } from "./env";

/**
 * A connection of its own, configured the opposite way to the BullMQ one.
 *
 * BullMQ needs `maxRetriesPerRequest: null` so its blocking commands are never
 * retried by the client — which means a command issued while Redis is down
 * queues up and waits indefinitely. That is correct for a worker and useless
 * for a probe, so this connection fails fast instead: no offline queue, one
 * retry, short connect timeout.
 */
let probe: IORedis | null = null;

function probeConnection(): IORedis {
	if (!probe) {
		probe = new IORedis(queuesEnv.REDIS_URL, {
			connectTimeout: 2_000,
			// Without this, a command issued while disconnected is buffered rather
			// than rejected, and the probe hangs instead of reporting.
			enableOfflineQueue: false,
			lazyConnect: true,
			maxRetriesPerRequest: 1,
			retryStrategy: () => null,
		});
		// An unhandled 'error' event on an ioredis client crashes the process.
		probe.on("error", () => {});
	}
	return probe;
}

/**
 * Statuses from which a command cannot be issued and `connect()` is valid.
 *
 * `wait` is the one that matters and the one easy to miss: with `lazyConnect`
 * the client starts there, so the *first* probe after boot is issued on an
 * unconnected socket. With the offline queue disabled that rejects rather than
 * waits, so the first readiness check of a new container fails for no reason —
 * which, on a platform with a low readiness threshold, fails the deploy.
 */
const UNCONNECTED = new Set(["wait", "end", "close"]);

export async function pingRedis(): Promise<void> {
	const client = probeConnection();
	if (UNCONNECTED.has(client.status)) {
		// Resolves once the connection is ready, not merely initiated.
		await client.connect();
	}
	const reply = await client.ping();
	if (reply !== "PONG") {
		throw new Error(`Unexpected PING reply from Redis: ${reply}`);
	}
}

/** Closes the probe connection. For shutdown paths and tests. */
export async function closeRedisProbe(): Promise<void> {
	if (!probe) return;
	await probe.quit().catch(() => probe?.disconnect());
	probe = null;
}
