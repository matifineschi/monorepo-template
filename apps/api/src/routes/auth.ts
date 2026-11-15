import { Hono } from "hono";

import { authHandler } from "@repo/features/auth";

export const authRoutes = new Hono();

authRoutes.on(["GET", "POST"], "/*", (c) => {
	return authHandler(c.req.raw);
});
