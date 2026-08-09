import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { env } from "./env";
import type { AppVariables } from "./lib/types";
import { sessionMiddleware } from "./middleware/session";
import { authRoutes } from "./routes/auth";
import { filesRoutes } from "./routes/files";
import { healthRoutes } from "./routes/health";
import { meRoutes } from "./routes/me";

/** Exported so integration tests can drive the real stack via `app.request()`. */
export const app = new Hono<{ Variables: AppVariables }>();

app.use("*", logger());
app.use(
	"*",
	cors({
		origin: env.CORS_ORIGIN,
		credentials: true,
	}),
);

app.use("*", sessionMiddleware);

app.route("/", healthRoutes);
app.route("/api/auth", authRoutes);
app.route("/me", meRoutes);
app.route("/files", filesRoutes);

console.log(`API server running on http://localhost:${env.PORT}`);

export default {
	port: env.PORT,
	fetch: app.fetch,
};
