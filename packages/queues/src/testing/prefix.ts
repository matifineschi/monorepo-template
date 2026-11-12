import IORedis from "ioredis";

/**
 * A BullMQ key namespace of its own for each integration test run.
 *
 * Queue *names* are part of the application — renaming one orphans enqueued
 * jobs — so tests cannot simply use different names. The prefix is the seam
 * BullMQ provides for exactly this, and isolating on it removes two hazards at
 * once: a suite consuming another suite's jobs, and a suite that enqueues
 * without running a worker leaving a job for a later suite's worker to pick up.
 *
 * Sets `QUEUE_PREFIX`, so call it from a preload before anything imports
 * `@repo/queues`.
 */

const PREFIX_ROOT = "test";
/** SCAN page size; large enough that a test run's keys come back in one or two. */
const SCAN_COUNT = 500;

function slug(value: string, maxLength: number): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, maxLength);
}

export type ProvisionedQueuePrefix = {
	prefix: string;
	/** Removes every key under the prefix. Safe to call twice. */
	drop: () => Promise<void>;
};

export function provisionTestQueuePrefix(
	options: { label?: string } = {},
): ProvisionedQueuePrefix {
	const label = slug(options.label ?? "run", 16) || "run";
	const prefix = `${PREFIX_ROOT}-${label}-${Date.now().toString(36)}-${Math.random()
		.toString(16)
		.slice(2, 8)}`;

	process.env.QUEUE_PREFIX = prefix;

	let dropped = false;

	return {
		prefix,
		drop: async () => {
			if (dropped) return;
			dropped = true;

			const redis = new IORedis(
				process.env.REDIS_URL ?? "redis://localhost:63792",
				{ maxRetriesPerRequest: null },
			);
			try {
				// SCAN rather than KEYS: KEYS blocks the server for the whole sweep,
				// which is a bad habit to teach even against a test instance.
				let cursor = "0";
				do {
					const [next, keys] = await redis.scan(
						cursor,
						"MATCH",
						`${prefix}:*`,
						"COUNT",
						SCAN_COUNT,
					);
					cursor = next;
					if (keys.length > 0) await redis.unlink(...keys);
				} while (cursor !== "0");
			} finally {
				await redis.quit();
			}
		},
	};
}
