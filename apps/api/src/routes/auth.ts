import { Hono } from "hono";

import { auth } from "@repo/auth";

export const authRoutes = new Hono();

authRoutes.on(["GET", "POST"], "/*", (c) => {
	return auth.handler(c.req.raw);
});
