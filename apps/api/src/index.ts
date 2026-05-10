import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import type { AppVariables } from "./lib/types";
import { sessionMiddleware } from "./middleware/session";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { meRoutes } from "./routes/me";

const app = new Hono<{ Variables: AppVariables }>();

app.use("*", logger());
app.use(
	"*",
	cors({
		origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
		credentials: true,
	}),
);

app.use("*", sessionMiddleware);

app.route("/", healthRoutes);
app.route("/api/auth", authRoutes);
app.route("/me", meRoutes);

const port = Number(process.env.PORT ?? 3001);

console.log(`API server running on http://localhost:${port}`);

export default {
	port,
	fetch: app.fetch,
};
