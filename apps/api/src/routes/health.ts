import { Hono } from "hono";

import { pingDatabase } from "@repo/db/operations/health";
import { logger } from "@repo/logger";
import { pingRedis } from "@repo/queues";
import { pingBucket } from "@repo/storage";
import { withTimeout } from "@repo/utils/timeout";

export const healthRoutes = new Hono();

/**
 * A dependency check that hangs is worse than one that fails: the orchestrator
 * learns nothing either way, and meanwhile the probe is holding a connection.
 * Short enough that a slow dependency reads as unready.
 */
const CHECK_TIMEOUT_MS = 2_000;

/**
 * Liveness: is this process running and able to answer?
 *
 * Deliberately checks nothing else. A liveness probe that checks dependencies
 * gets the process *killed* when the database blips — the orchestrator restarts
 * a container that was working fine, and a brief database hiccup turns into a
 * rolling restart of every instance. Dependency state belongs in readiness.
 */
healthRoutes.get("/health", (c) =>
	c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

const CHECKS = {
	database: pingDatabase,
	redis: pingRedis,
	bucket: pingBucket,
} satisfies Record<string, () => Promise<unknown>>;

/**
 * Readiness: should this instance be sent traffic?
 *
 * Returns 503 with the failing check named when a dependency is unreachable,
 * so a load balancer drains this instance instead of serving errors from it.
 *
 * The response names which check failed but never why — the underlying error
 * can contain a host, a bucket name or a connection string, and this endpoint
 * is reachable by whoever can reach the service. The detail goes to the log.
 */
healthRoutes.get("/ready", async (c) => {
	const names = Object.keys(CHECKS) as (keyof typeof CHECKS)[];

	const results = await Promise.all(
		names.map(async (name) => {
			try {
				await withTimeout(CHECKS[name](), CHECK_TIMEOUT_MS, name);
				return [name, true] as const;
			} catch (error) {
				logger.error({ check: name, err: error }, "Readiness check failed");
				return [name, false] as const;
			}
		}),
	);

	const checks = Object.fromEntries(results);
	const ready = results.every(([, ok]) => ok);

	return c.json(
		{ status: ready ? "ready" : "not-ready", checks },
		ready ? 200 : 503,
	);
});
