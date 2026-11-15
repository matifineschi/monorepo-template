import { Hono } from "hono";

import { checkReadiness } from "@repo/features/system";

export const healthRoutes = new Hono();

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

/**
 * Readiness: should this instance be sent traffic?
 *
 * Returns 503 with the failing check named when a dependency is unreachable,
 * so a load balancer drains this instance instead of serving errors from it.
 * Which dependencies count, and how long each may take, is decided by
 * `checkReadiness`.
 */
healthRoutes.get("/ready", async (c) => {
	const { ready, checks } = await checkReadiness();

	return c.json(
		{ status: ready ? "ready" : "not-ready", checks },
		ready ? 200 : 503,
	);
});
