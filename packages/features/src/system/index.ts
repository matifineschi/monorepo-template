import { pingDatabase } from "@repo/db/operations/health";
import { childLogger } from "@repo/logger";
import { closeRedisProbe, pingRedis } from "@repo/queues";
import { pingBucket } from "@repo/storage";
import { withTimeout } from "@repo/utils/timeout";

import { closeQueues } from "../shared/queues";

const log = childLogger({ feature: "system" });

/**
 * A dependency check that hangs is worse than one that fails: the orchestrator
 * learns nothing either way, and meanwhile the probe is holding a connection.
 * Short enough that a slow dependency reads as unready.
 */
const CHECK_TIMEOUT_MS = 2_000;

const CHECKS = {
	database: pingDatabase,
	redis: pingRedis,
	bucket: pingBucket,
} satisfies Record<string, () => Promise<unknown>>;

export type Readiness = {
	ready: boolean;
	checks: Record<keyof typeof CHECKS, boolean>;
};

/**
 * Whether every dependency this deployment serves traffic with is reachable.
 * Failures are named but never explained in the result — the underlying error
 * can contain a host, a bucket name or a connection string. The detail goes to
 * the log.
 *
 * Email is deliberately not a check: a Resend outage must not pull every
 * instance out of rotation, and sends already retry.
 */
export async function checkReadiness(): Promise<Readiness> {
	const names = Object.keys(CHECKS) as (keyof typeof CHECKS)[];

	const results = await Promise.all(
		names.map(async (name) => {
			try {
				await withTimeout(CHECKS[name](), CHECK_TIMEOUT_MS, name);
				return [name, true] as const;
			} catch (error) {
				log.error({ check: name, err: error }, "Readiness check failed");
				return [name, false] as const;
			}
		}),
	);

	return {
		ready: results.every(([, ok]) => ok),
		checks: Object.fromEntries(results) as Readiness["checks"],
	};
}

/**
 * Closes the Redis connections features opened in this process: queue
 * producers and the readiness probe. Call it from the app's shutdown path,
 * after in-flight requests have drained.
 */
export async function closeFeatureConnections(): Promise<void> {
	await Promise.all([closeQueues(), closeRedisProbe()]);
}
