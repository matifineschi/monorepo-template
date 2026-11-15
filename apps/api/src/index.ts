import { Hono } from "hono";
import { cors } from "hono/cors";

import { closeFeatureConnections } from "@repo/features/system";
import { logger } from "@repo/logger";

import { env } from "./env";
import type { AppVariables } from "./lib/types";
import { requestLogger } from "./middleware/request-logger";
import { sessionMiddleware } from "./middleware/session";
import { authRoutes } from "./routes/auth";
import { filesRoutes } from "./routes/files";
import { healthRoutes } from "./routes/health";
import { meRoutes } from "./routes/me";

/** Exported so integration tests can drive the real stack via `app.request()`. */
export const app = new Hono<{ Variables: AppVariables }>();

app.use("*", requestLogger);
app.use(
	"*",
	cors({
		origin: env.CORS_ORIGIN,
		credentials: true,
	}),
);

app.use("*", sessionMiddleware);

/**
 * Last resort. Without it Hono answers an unhandled throw with a bare 500 and
 * the error never reaches the logger, so the one line that would explain the
 * failure is the one line you do not get.
 */
app.onError((error, c) => {
	logger.error(
		{ err: error, method: c.req.method, path: c.req.path },
		"Unhandled request error",
	);
	return c.json({ error: "Internal Server Error" }, 500);
});

app.route("/", healthRoutes);
app.route("/api/auth", authRoutes);
app.route("/me", meRoutes);
app.route("/files", filesRoutes);

/**
 * How long to let in-flight requests finish before exiting anyway. Must stay
 * under the orchestrator's own grace period (Kubernetes defaults to 30s, most
 * platforms to something similar), or the process is SIGKILLed mid-drain and
 * the drain was pointless.
 */
const DRAIN_TIMEOUT_MS = 10_000;

/**
 * `import.meta.main` is load-bearing. Integration tests import this module for
 * `app`, and binding a port on import would make every test run fight over
 * 3001 — and fail outright when a dev server already holds it.
 */
if (import.meta.main) {
	const server = Bun.serve({ fetch: app.fetch, port: env.PORT });

	logger.info({ env: env.NODE_ENV, port: server.port }, "API server listening");

	let shuttingDown = false;

	/**
	 * Without this, a deploy's SIGTERM kills in-flight requests. The client sees
	 * a connection reset, which is indistinguishable from a network fault, so it
	 * gets diagnosed as flakiness rather than as every deploy dropping requests.
	 */
	async function shutdown(signal: string): Promise<void> {
		if (shuttingDown) return;
		shuttingDown = true;
		logger.info({ signal }, "API server shutting down");

		try {
			// `false`: stop accepting connections but let in-flight requests finish.
			await Promise.race([
				server.stop(false),
				new Promise((resolve) => setTimeout(resolve, DRAIN_TIMEOUT_MS)),
			]);
			await closeFeatureConnections();
		} catch (error) {
			logger.error({ err: error }, "Error during shutdown");
		}

		process.exit(0);
	}

	process.on("SIGTERM", () => void shutdown("SIGTERM"));
	process.on("SIGINT", () => void shutdown("SIGINT"));
}
