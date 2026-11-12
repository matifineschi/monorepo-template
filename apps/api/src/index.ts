import { Hono } from "hono";
import { cors } from "hono/cors";

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

logger.info({ port: env.PORT, env: env.NODE_ENV }, "API server listening");

export default {
	port: env.PORT,
	fetch: app.fetch,
};
